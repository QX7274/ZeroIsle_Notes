"""用户设备视图

提供用户设备相关的API接口
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from users.models import UserDevice
from users.serializers import UserDeviceSerializer
from users.permissions import IsOwnerOrAdmin

User = get_user_model()

class UserDeviceViewSet(viewsets.ModelViewSet):
    """
    用户设备视图集
    提供用户设备的CRUD操作
    """
    queryset = UserDevice.objects.all()
    serializer_class = UserDeviceSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    
    def get_queryset(self):
        """根据用户角色过滤查询集"""
        user = self.request.user
        # 管理员可以查看所有用户设备
        if user.is_staff or user.is_superuser:
            return UserDevice.objects.all()
        # 普通用户只能查看自己的设备
        return UserDevice.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建时自动关联当前用户"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_devices(self, request):
        """获取当前用户的所有设备"""
        devices = UserDevice.objects.filter(user=request.user)
        serializer = self.get_serializer(devices, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """停用设备"""
        device = self.get_object()
        device.is_active = False
        device.save()
        return Response({'status': '设备已停用'}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活设备"""
        device = self.get_object()
        device.is_active = True
        device.save()
        return Response({'status': '设备已激活'}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'])
    def update_push_token(self, request):
        """更新推送令牌
        
        用于更新当前设备的推送令牌
        """
        device_id = request.data.get('device_id')
        push_token = request.data.get('push_token')
        
        if not device_id or not push_token:
            return Response({'error': '设备ID和推送令牌不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            device = UserDevice.objects.get(user=request.user, device_id=device_id)
            device.push_token = push_token
            device.save()
            return Response({'status': '推送令牌已更新'}, status=status.HTTP_200_OK)
        except UserDevice.DoesNotExist:
            return Response({'error': '设备不存在'}, status=status.HTTP_404_NOT_FOUND)