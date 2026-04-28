"""
自定义JWT令牌视图，实现令牌轮换和黑名单机制
"""

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..services.token_service import TokenBlacklistService

DjangoUser = get_user_model()

class CustomTokenRefreshView(TokenRefreshView):
    """
    自定义的令牌刷新视图，增加了令牌轮换和黑名单检查。
    """
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            # 捕获所有令牌相关的错误，包括黑名单检查失败
            raise InvalidToken(e.args[0])

        # 校验传入的refresh是否已在黑名单中
        try:
            old_refresh = RefreshToken(request.data.get('refresh'))
            if TokenBlacklistService.is_blacklisted(old_refresh):
                raise InvalidToken('Refresh token is blacklisted')
        except Exception:
            # 如果无法解析refresh，则按无效处理
            raise InvalidToken('Invalid refresh token')

        # 调用父类方法获取新的access token
        response = super().post(request, *args, **kwargs)
        new_access_token = response.data.get('access')

        # --- 实现令牌轮换 ---
        # 1. 基于旧refresh中的user_id创建新的refresh token
        user_id = old_refresh.get(api_settings.USER_ID_CLAIM)
        if not user_id:
            raise InvalidToken('Refresh token missing user_id')

        normalized_user_id = str(user_id).replace('-', '')
        django_user = DjangoUser.objects.filter(id__in=[str(user_id), normalized_user_id]).first()
        if not django_user:
            raise InvalidToken('User not found for refresh token')

        new_refresh = RefreshToken.for_user(django_user)

        # 2. 将旧的refresh token加入黑名单
        TokenBlacklistService.add_to_blacklist(old_refresh, reason='rotated')

        # 3. 在响应中返回新的access token和新的refresh token
        response.data['refresh'] = str(new_refresh)
        response.data['access'] = str(new_refresh.access_token)

        return response

class CustomLogoutView(APIView):
    """
    自定义登出视图：
    1) 将refresh token加入黑名单（使其无法再刷新）
    2) 尝试将当前access token加入黑名单（立即失效）
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({"error": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 拉黑refresh token
            refresh = RefreshToken(refresh_token)
            TokenBlacklistService.add_to_blacklist(refresh, user=getattr(request, 'user', None), reason='logout')

            # 可选：尝试拉黑当前access token
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION')
                if auth_header and auth_header.startswith('Bearer '):
                    raw_access = auth_header.split(' ')[1]
                    access = AccessToken(raw_access)
                    TokenBlacklistService.add_to_blacklist(access, user=getattr(request, 'user', None), reason='logout')
            except Exception:
                # 如果无法解析access token，忽略，不影响登出主流程
                pass

            return Response({"detail": "Logout successful."}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({"error": "Invalid or expired refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
