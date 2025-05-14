"""用户设置视图

提供用户设置相关的API接口
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from users.models import UserSettings
from users.serializers import UserSettingsSerializer
from users.permissions import IsOwnerOrAdmin

User = get_user_model()

class UserSettingsViewSet(viewsets.ModelViewSet):
    """
    用户设置视图集
    提供用户设置的CRUD操作
    """
    queryset = UserSettings.objects.all()
    serializer_class = UserSettingsSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        """根据用户角色过滤查询集"""
        try:
            import logging
            logger = logging.getLogger(__name__)

            user = self.request.user
            logger.debug(f"获取用户设置查询集, 用户ID: {user.id}, 类型: {type(user.id)}")

            # 管理员可以查看所有用户设置
            if user.is_staff or user.is_superuser:
                return UserSettings.objects.all()
            # 普通用户只能查看自己的设置
            return UserSettings.objects.filter(user=user)
        except Exception as e:
            logger.error(f"获取用户设置查询集失败: {str(e)}", exc_info=True)
            # 返回空查询集
            return UserSettings.objects.none()

    def perform_create(self, serializer):
        """创建时自动关联当前用户"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def my_settings(self, request):
        """获取当前用户的设置"""
        try:
            import logging
            logger = logging.getLogger(__name__)

            logger.debug(f"获取当前用户的设置, 用户ID: {request.user.id}, 类型: {type(request.user.id)}")
            try:
                settings = UserSettings.objects.get(user=request.user)
                logger.debug(f"找到用户设置, ID: {settings.id}")
                serializer = self.get_serializer(settings)
                return Response(serializer.data)
            except UserSettings.DoesNotExist:
                # 如果用户设置不存在，则创建一个默认设置
                logger.debug(f"用户设置不存在, 创建默认设置")
                settings = UserSettings.objects.create(user=request.user)
                serializer = self.get_serializer(settings)
                return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取当前用户的设置失败: {str(e)}", exc_info=True)
            return Response({'error': f'获取设置失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['put', 'patch'])
    def update_my_settings(self, request):
        """更新当前用户的设置"""
        try:
            import logging
            logger = logging.getLogger(__name__)

            logger.debug(f"更新当前用户的设置, 用户ID: {request.user.id}, 类型: {type(request.user.id)}")
            try:
                settings = UserSettings.objects.get(user=request.user)
                logger.debug(f"找到用户设置, ID: {settings.id}")
            except UserSettings.DoesNotExist:
                logger.debug(f"用户设置不存在, 创建默认设置")
                settings = UserSettings.objects.create(user=request.user)

            serializer = self.get_serializer(settings, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                logger.debug(f"用户设置已更新")
                return Response(serializer.data)
            logger.warning(f"用户设置更新失败: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"更新当前用户的设置失败: {str(e)}", exc_info=True)
            return Response({'error': f'更新设置失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)