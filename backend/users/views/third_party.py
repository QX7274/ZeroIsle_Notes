"""第三方认证视图

提供第三方登录认证相关的API接口
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from users.models import ThirdPartyAccount
from users.serializers import ThirdPartyAccountSerializer
from users.permissions import IsOwnerOrAdmin
from users.services.auth_service import AuthService

User = get_user_model()

class ThirdPartyAuthViewSet(viewsets.ModelViewSet):
    """
    第三方认证视图集
    提供第三方账号的CRUD操作和认证功能
    """
    queryset = ThirdPartyAccount.objects.all()
    serializer_class = ThirdPartyAccountSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    
    def get_queryset(self):
        """根据用户角色过滤查询集"""
        user = self.request.user
        # 管理员可以查看所有第三方账号
        if user.is_staff or user.is_superuser:
            return ThirdPartyAccount.objects.all()
        # 普通用户只能查看自己的第三方账号
        return ThirdPartyAccount.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建时自动关联当前用户"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_accounts(self, request):
        """获取当前用户的所有第三方账号"""
        accounts = ThirdPartyAccount.objects.filter(user=request.user)
        serializer = self.get_serializer(accounts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        """第三方登录
        
        处理第三方登录请求，如果账号不存在则自动创建
        """
        provider = request.data.get('provider')
        provider_user_id = request.data.get('provider_user_id')
        user_data = request.data.get('user_data', {})
        
        if not provider or not provider_user_id:
            return Response({'error': '提供商和用户ID不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 使用AuthService处理第三方登录
            result = AuthService.third_party_login(
                provider=provider,
                provider_user_id=provider_user_id,
                user_data=user_data,
                request=request
            )
            
            return Response({
                'user': result['user'].username,
                'refresh': result['refresh'],
                'access': result['access'],
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'])
    def unbind(self, request, pk=None):
        """解绑第三方账号"""
        account = self.get_object()
        account.delete()
        return Response({'status': '账号已解绑'}, status=status.HTTP_204_NO_CONTENT)