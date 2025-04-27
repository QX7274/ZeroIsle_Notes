"""用户资料视图

提供用户资料相关的API接口
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from users.models import UserProfile
from users.serializers import UserProfileSerializer
from users.permissions import IsOwnerOrAdmin

User = get_user_model()

class UserProfileViewSet(viewsets.ModelViewSet):
    """
    用户资料视图集
    提供用户资料的CRUD操作
    """
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    
    def get_queryset(self):
        """根据用户角色过滤查询集"""
        user = self.request.user
        # 管理员可以查看所有用户资料
        if user.is_staff or user.is_superuser:
            return UserProfile.objects.all()
        # 普通用户只能查看自己的资料
        return UserProfile.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建时自动关联当前用户"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """获取当前用户的资料"""
        try:
            profile = UserProfile.objects.get(user=request.user)
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        except UserProfile.DoesNotExist:
            # 如果用户资料不存在，则创建一个
            profile = UserProfile.objects.create(user=request.user)
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
    
    @action(detail=False, methods=['put', 'patch'])
    def update_my_profile(self, request):
        """更新当前用户的资料"""
        try:
            profile = UserProfile.objects.get(user=request.user)
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.create(user=request.user)
        
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)