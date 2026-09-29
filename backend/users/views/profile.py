"""用户资料视图

提供用户资料相关的API接口。

RISK-BE-012：UserProfile 统一为 users.mongodb_models.UserProfile（user_profiles 集合的
唯一 Document），且其 user 引用是 **MongoUser**。这里显式把 Django 用户解析成 MongoUser，
避免把 Django User 直接塞进 ReferenceField（旧实现的 profile 路径因此根本跑不通）。
"""

import logging

from django.http import Http404
from mongoengine.errors import (
    InvalidQueryError,
    ValidationError as MongoValidationError,
)
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from users.models import UserProfile
from users.mongodb_models import User as MongoUser
from users.serializers import UserProfileSerializer
from users.permissions import IsOwnerOrAdmin

logger = logging.getLogger(__name__)


def _resolve_mongo_user(django_user):
    """把 Django 用户解析成 MongoDB 用户（只读，不做 create）。

    信号 users/signals.py 已在 Django 用户创建时镜像出 MongoUser + UserProfile，
    因此这里优先按 django_user_id 查找，回退按 username。
    """
    if not django_user or not getattr(django_user, 'is_authenticated', False):
        return None
    return (
        MongoUser.objects(django_user_id=str(django_user.id)).first()
        or MongoUser.objects(username=django_user.username).first()
    )


class UserProfileViewSet(viewsets.ModelViewSet):
    """
    用户资料视图集
    提供用户资料的CRUD操作
    """
    # 避免在模块导入阶段触发 MongoDB 连接（例如 manage.py check）
    queryset = None
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        """根据用户角色过滤查询集"""
        try:
            user = self.request.user
            logger.debug(f"获取用户资料查询集, 用户ID: {user.id}, 类型: {type(user.id)}")

            # 管理员可以查看所有用户资料
            if user.is_staff or user.is_superuser:
                return UserProfile.objects.all()

            mongo_user = _resolve_mongo_user(user)
            if mongo_user is None:
                logger.warning(f"未找到 Django 用户 {user.id} 对应的 MongoDB 用户")
                return UserProfile.objects.none()

            # 普通用户只能查看自己的资料
            return UserProfile.objects.filter(user=mongo_user)
        except Exception as e:
            logger.error(f"获取用户资料查询集失败: {str(e)}", exc_info=True)
            # 返回空查询集
            return UserProfile.objects.none()

    def get_object(self):
        """按 mongoengine 语义取单个对象（RISK-BE-016）。

        DRF 的 get_object_or_404 假设 ORM queryset（内部访问 queryset.model.DoesNotExist），
        对 mongoengine QuerySet 会抛 AttributeError —— 非 owner 访问详情路由时表现为 500。
        这里改为显式查询：取不到（或 pk 非法）就 404，保持「不泄露对象是否存在」语义；
        取到后照样执行对象级权限检查（owner/admin 放行，其余 403）。
        """
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs.get(lookup_url_kwarg)

        try:
            obj = queryset.filter(**{self.lookup_field: lookup_value}).first()
        except (MongoValidationError, InvalidQueryError):
            # pk 不是合法 ObjectId 等：按「不存在」处理，不要 500
            raise Http404

        if obj is None:
            raise Http404

        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        """创建时自动关联当前用户（MongoUser）"""
        mongo_user = _resolve_mongo_user(self.request.user)
        if mongo_user is None:
            raise ValidationError('未找到当前用户对应的 MongoDB 用户')
        serializer.save(user=mongo_user)

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """获取当前用户的资料"""
        mongo_user = _resolve_mongo_user(request.user)
        if mongo_user is None:
            return Response(
                {'detail': '未找到当前用户对应的 MongoDB 用户'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            profile = UserProfile.objects.get(user=mongo_user)
        except UserProfile.DoesNotExist:
            # 如果用户资料不存在，则创建一个（并补上 django_user_id 映射字段）
            profile = UserProfile.objects.create(
                user=mongo_user, django_user_id=str(request.user.id)
            )
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'])
    def update_my_profile(self, request):
        """更新当前用户的资料"""
        mongo_user = _resolve_mongo_user(request.user)
        if mongo_user is None:
            return Response(
                {'detail': '未找到当前用户对应的 MongoDB 用户'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            profile = UserProfile.objects.get(user=mongo_user)
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.create(
                user=mongo_user, django_user_id=str(request.user.id)
            )

        serializer = self.get_serializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
