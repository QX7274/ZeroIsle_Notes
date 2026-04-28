"""用户视图 (MongoEngine版本)

提供用户相关的API接口，完全基于MongoEngine。
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from mongoengine.queryset.visitor import Q
from users.mongodb_models import User as MongoUser
from users.serializers.mongo_auth import (
    MongoUserSerializer,
    MongoUserDetailSerializer,
    MongoUserUpdateSerializer
)
from users.permissions import IsOwnerOrAdmin
import logging

logger = logging.getLogger(__name__)

class UserViewSet(viewsets.ViewSet):
    """
    用户视图集 (MongoEngine)
    提供用户的CRUD操作
    """
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_serializer_class(self):
        """根据操作选择序列化器"""
        if self.action in ['retrieve', 'me']:
            return MongoUserDetailSerializer
        if self.action in ['update', 'partial_update']:
            return MongoUserUpdateSerializer
        return MongoUserSerializer

    def get_permissions(self):
        """根据操作设置权限"""
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrAdmin()]
        return super().get_permissions()

    def list(self, request):
        """获取用户列表 (仅管理员)"""
        user = request.user
        if not (user.is_staff or user.is_superuser):
            return Response({'error': '没有权限执行此操作'}, status=status.HTTP_403_FORBIDDEN)

        queryset = MongoUser.objects.all()
        serializer = MongoUserSerializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, id=None):
        """获取单个用户详情"""
        try:
            user = MongoUser.objects.get(id=id)
            self.check_object_permissions(request, user)
            serializer = MongoUserDetailSerializer(user)
            return Response(serializer.data)
        except MongoUser.DoesNotExist:
            return Response({'error': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

    def update(self, request, id=None):
        """更新用户信息"""
        try:
            user = MongoUser.objects.get(id=id)
            self.check_object_permissions(request, user)
            serializer = MongoUserUpdateSerializer(data=request.data)
            if serializer.is_valid():
                serializer.update(user, serializer.validated_data)
                return Response(MongoUserDetailSerializer(user).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except MongoUser.DoesNotExist:
            return Response({'error': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

    def partial_update(self, request, id=None):
        """部分更新用户信息"""
        return self.update(request, id)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """获取当前用户信息"""
        serializer = MongoUserDetailSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """搜索用户 (仅管理员)"""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': '没有权限执行此操作'}, status=status.HTTP_403_FORBIDDEN)

        keyword = request.query_params.get('keyword', '')
        if not keyword:
            return Response({'error': '搜索关键词不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        users = MongoUser.objects(
            Q(username__icontains=keyword) |
            Q(nickname__icontains=keyword) |
            Q(email__icontains=keyword)
        )[:20]

        serializer = MongoUserSerializer(users, many=True)
        return Response(serializer.data)