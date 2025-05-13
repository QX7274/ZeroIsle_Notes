"""用户视图

提供用户相关的API接口
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from mongoengine.queryset.visitor import Q
from users.serializers import UserSerializer, UserDetailSerializer
from users.permissions import IsOwnerOrAdmin
from users.mongodb_models import User as MongoUser

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    """
    用户视图集
    提供用户的CRUD操作
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        """根据操作选择序列化器"""
        if self.action in ['retrieve', 'me']:
            return UserDetailSerializer
        return UserSerializer

    def get_permissions(self):
        """根据操作设置权限"""
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        """根据用户角色过滤查询集"""
        user = self.request.user
        # 管理员可以查看所有用户
        if user.is_staff or user.is_superuser:
            return User.objects.all()
        # 普通用户只能查看自己
        return User.objects.filter(id=user.id)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """获取当前用户信息"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """搜索用户

        可以通过用户名、昵称、邮箱等字段搜索用户
        """
        keyword = request.query_params.get('keyword', '')
        if not keyword:
            return Response({'error': '搜索关键词不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 只有管理员可以搜索所有用户
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': '没有权限执行此操作'}, status=status.HTTP_403_FORBIDDEN)

        # 使用MongoDB查询
        mongo_users = MongoUser.objects(
            Q(username__icontains=keyword) |
            Q(nickname__icontains=keyword) |
            Q(email__icontains=keyword)
        )[:20]  # 限制返回数量

        # 获取对应的Django用户
        user_ids = [str(user.django_user_id) for user in mongo_users]
        users = User.objects.filter(id__in=user_ids)

        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)