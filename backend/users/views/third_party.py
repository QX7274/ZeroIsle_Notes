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

    @action(detail=False, methods=['post'])
    def wechat_login(self, request):
        """
        微信登录

        接收微信授权信息，处理登录或注册，返回用户信息和令牌
        """
        code = request.data.get('code')
        if not code:
            return Response({'error': '微信授权码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 微信用户信息
        user_info = request.data.get('user_info', {})

        # 提取微信头像URL
        avatar_url = user_info.get('avatarUrl') or user_info.get('headimgurl')

        # 构建用户数据
        user_data = {
            'nickname': user_info.get('nickname') or user_info.get('nickName', ''),
            'avatar': avatar_url,  # 保存微信头像URL
            'gender': user_info.get('gender', ''),
            'country': user_info.get('country', ''),
            'province': user_info.get('province', ''),
            'city': user_info.get('city', ''),
            'language': user_info.get('language', ''),
            'access_token': user_info.get('access_token', ''),
            'refresh_token': user_info.get('refresh_token', ''),
            'expires_at': user_info.get('expires_at'),
        }

        try:
            # 使用AuthService处理第三方登录
            result = AuthService.third_party_login(
                provider='wechat',
                provider_user_id=user_info.get('openid') or user_info.get('unionid'),
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

    @action(detail=False, methods=['post'])
    def qq_login(self, request):
        """
        QQ登录

        接收QQ授权信息，处理登录或注册，返回用户信息和令牌
        """
        code = request.data.get('code')
        if not code:
            return Response({'error': 'QQ授权码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # QQ用户信息
        user_info = request.data.get('user_info', {})

        # 提取QQ头像URL
        avatar_url = user_info.get('figureurl_qq_2') or user_info.get('figureurl_qq_1') or user_info.get('figureurl_2')

        # 构建用户数据
        user_data = {
            'nickname': user_info.get('nickname', ''),
            'avatar': avatar_url,  # 保存QQ头像URL
            'gender': user_info.get('gender', ''),
            'year': user_info.get('year', ''),
            'province': user_info.get('province', ''),
            'city': user_info.get('city', ''),
            'access_token': user_info.get('access_token', ''),
            'refresh_token': user_info.get('refresh_token', ''),
            'expires_at': user_info.get('expires_at'),
        }

        try:
            # 使用AuthService处理第三方登录
            result = AuthService.third_party_login(
                provider='qq',
                provider_user_id=user_info.get('openid'),
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