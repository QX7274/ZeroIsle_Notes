"""
社交登录API视图
"""

import logging
import secrets
from django.http import JsonResponse
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from users.services.social_auth_service import SocialAuthService

logger = logging.getLogger(__name__)


# 存储OAuth state (生产环境应使用Redis)
oauth_states = {}


@api_view(['GET'])
@permission_classes([AllowAny])
def get_oauth_url(request, provider):
    """
    获取OAuth授权URL
    
    GET /api/auth/social/{provider}/authorize/
    
    Query Parameters:
        redirect_uri: 回调URL
    """
    oauth_provider = SocialAuthService.get_provider(provider)
    if not oauth_provider:
        return JsonResponse({'error': f'不支持的登录方式: {provider}'}, status=400)
    
    redirect_uri = request.GET.get('redirect_uri', '')
    if not redirect_uri:
        return JsonResponse({'error': '缺少redirect_uri参数'}, status=400)
    
    # 生成state防止CSRF
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        'provider': provider,
        'redirect_uri': redirect_uri,
    }
    
    auth_url = oauth_provider.get_authorization_url(redirect_uri, state)
    
    return JsonResponse({
        'authorization_url': auth_url,
        'state': state,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def oauth_callback(request, provider):
    """
    OAuth回调处理
    
    POST /api/auth/social/{provider}/callback/
    
    Request Body:
        code: 授权码
        state: 状态码
        user_data: Apple登录时的用户数据（可选）
    """
    code = request.data.get('code')
    state = request.data.get('state')
    user_data = request.data.get('user_data')
    
    if not code:
        return JsonResponse({'error': '缺少授权码'}, status=400)
    
    # 验证state
    state_data = oauth_states.pop(state, None)
    if not state_data or state_data['provider'] != provider:
        return JsonResponse({'error': '无效的state'}, status=400)
    
    redirect_uri = state_data['redirect_uri']
    
    # 获取provider
    oauth_provider = SocialAuthService.get_provider(provider)
    if not oauth_provider:
        return JsonResponse({'error': f'不支持的登录方式: {provider}'}, status=400)
    
    # 交换token
    token_result = oauth_provider.exchange_code_for_token(code, redirect_uri)
    if 'error' in token_result:
        return JsonResponse({'error': token_result['error']}, status=400)
    
    # 获取用户信息
    if provider == 'wechat':
        user_info = oauth_provider.get_user_info(
            token_result['access_token'],
            token_result.get('openid', '')
        )
    elif provider == 'apple':
        user_info = oauth_provider.get_user_info(
            token_result.get('id_token', ''),
            user_data
        )
    else:
        user_info = oauth_provider.get_user_info(token_result['access_token'])
    
    if 'error' in user_info:
        return JsonResponse({'error': user_info['error']}, status=400)
    
    # 获取或创建用户
    user, created = SocialAuthService.get_or_create_user(user_info)
    if not user:
        return JsonResponse({'error': '用户创建失败'}, status=500)
    
    # 生成JWT token
    refresh = RefreshToken.for_user(user)
    
    return JsonResponse({
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'user': {
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'is_new': created,
        },
        'social_info': {
            'provider': provider,
            'nickname': user_info.get('nickname', ''),
            'avatar': user_info.get('avatar', ''),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_connected_accounts(request):
    """
    列出用户已连接的社交账号
    
    GET /api/auth/social/connected/
    """
    from users.models import SocialAccount
    
    accounts = SocialAccount.objects.filter(user=request.user)
    
    return JsonResponse({
        'accounts': [
            {
                'id': str(account.id),
                'provider': account.provider,
                'provider_name': dict(SocialAccount.PROVIDER_CHOICES).get(account.provider),
                'nickname': account.nickname,
                'avatar': account.avatar,
                'connected_at': account.created_at.isoformat(),
            }
            for account in accounts
        ]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect_account(request, provider):
    """
    连接新的社交账号到当前用户
    
    POST /api/auth/social/{provider}/connect/
    """
    code = request.data.get('code')
    redirect_uri = request.data.get('redirect_uri')
    
    if not code or not redirect_uri:
        return JsonResponse({'error': '缺少必要参数'}, status=400)
    
    oauth_provider = SocialAuthService.get_provider(provider)
    if not oauth_provider:
        return JsonResponse({'error': f'不支持的登录方式: {provider}'}, status=400)
    
    # 交换token
    token_result = oauth_provider.exchange_code_for_token(code, redirect_uri)
    if 'error' in token_result:
        return JsonResponse({'error': token_result['error']}, status=400)
    
    # 获取用户信息
    if provider == 'wechat':
        user_info = oauth_provider.get_user_info(
            token_result['access_token'],
            token_result.get('openid', '')
        )
    else:
        user_info = oauth_provider.get_user_info(token_result['access_token'])
    
    if 'error' in user_info:
        return JsonResponse({'error': user_info['error']}, status=400)
    
    # 检查是否已被其他用户绑定
    from users.models import SocialAccount
    
    existing = SocialAccount.objects.filter(
        provider=provider,
        provider_user_id=user_info['provider_user_id']
    ).first()
    
    if existing:
        if existing.user == request.user:
            return JsonResponse({'error': '此账号已绑定到您的账户'}, status=400)
        else:
            return JsonResponse({'error': '此账号已绑定到其他用户'}, status=400)
    
    # 创建关联
    account = SocialAccount.objects.create(
        user=request.user,
        provider=provider,
        provider_user_id=user_info['provider_user_id'],
        extra_data=user_info,
    )
    
    return JsonResponse({
        'success': True,
        'account': {
            'id': str(account.id),
            'provider': provider,
            'nickname': user_info.get('nickname', ''),
            'avatar': user_info.get('avatar', ''),
        }
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def disconnect_account(request, provider):
    """
    解绑社交账号
    
    DELETE /api/auth/social/{provider}/disconnect/
    """
    from users.models import SocialAccount
    
    # 确保用户还有其他登录方式
    has_password = request.user.has_usable_password()
    account_count = SocialAccount.objects.filter(user=request.user).count()
    
    if not has_password and account_count <= 1:
        return JsonResponse({
            'error': '无法解绑最后一个登录方式，请先设置密码'
        }, status=400)
    
    deleted, _ = SocialAccount.objects.filter(
        user=request.user,
        provider=provider
    ).delete()
    
    if deleted == 0:
        return JsonResponse({'error': '未找到此绑定'}, status=404)
    
    return JsonResponse({'success': True})
