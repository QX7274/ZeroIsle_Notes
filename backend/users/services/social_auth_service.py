"""
第三方登录服务
支持微信、Google、Apple登录
"""

import logging
import requests
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from django.conf import settings
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


class OAuthProviderBase:
    """OAuth提供商基类"""
    
    def __init__(self):
        self.name = "base"
    
    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """获取授权URL"""
        raise NotImplementedError
    
    def exchange_code_for_token(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """用授权码换取token"""
        raise NotImplementedError
    
    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """获取用户信息"""
        raise NotImplementedError


class WeChatOAuth(OAuthProviderBase):
    """微信OAuth登录"""
    
    def __init__(self):
        super().__init__()
        self.name = "wechat"
        self.app_id = getattr(settings, 'WECHAT_APP_ID', '')
        self.app_secret = getattr(settings, 'WECHAT_APP_SECRET', '')
        self.authorize_url = "https://open.weixin.qq.com/connect/qrconnect"
        self.token_url = "https://api.weixin.qq.com/sns/oauth2/access_token"
        self.userinfo_url = "https://api.weixin.qq.com/sns/userinfo"
    
    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        return (
            f"{self.authorize_url}?"
            f"appid={self.app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope=snsapi_login&"
            f"state={state}#wechat_redirect"
        )
    
    def exchange_code_for_token(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        try:
            response = requests.get(
                self.token_url,
                params={
                    'appid': self.app_id,
                    'secret': self.app_secret,
                    'code': code,
                    'grant_type': 'authorization_code',
                },
                timeout=10
            )
            data = response.json()
            
            if 'errcode' in data:
                logger.error(f"微信token交换失败: {data}")
                return {'error': data.get('errmsg', 'Unknown error')}
            
            return {
                'access_token': data.get('access_token'),
                'refresh_token': data.get('refresh_token'),
                'openid': data.get('openid'),
                'unionid': data.get('unionid'),
                'expires_in': data.get('expires_in', 7200),
            }
        except Exception as e:
            logger.error(f"微信token交换异常: {e}")
            return {'error': str(e)}
    
    def get_user_info(self, access_token: str, openid: str = '') -> Dict[str, Any]:
        try:
            response = requests.get(
                self.userinfo_url,
                params={
                    'access_token': access_token,
                    'openid': openid,
                },
                timeout=10
            )
            data = response.json()
            
            if 'errcode' in data:
                return {'error': data.get('errmsg', 'Unknown error')}
            
            return {
                'provider': 'wechat',
                'provider_user_id': data.get('unionid') or data.get('openid'),
                'nickname': data.get('nickname', ''),
                'avatar': data.get('headimgurl', ''),
                'gender': data.get('sex', 0),
                'country': data.get('country', ''),
                'province': data.get('province', ''),
                'city': data.get('city', ''),
            }
        except Exception as e:
            logger.error(f"获取微信用户信息异常: {e}")
            return {'error': str(e)}


class GoogleOAuth(OAuthProviderBase):
    """Google OAuth登录"""
    
    def __init__(self):
        super().__init__()
        self.name = "google"
        self.client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
        self.client_secret = getattr(settings, 'GOOGLE_CLIENT_SECRET', '')
        self.authorize_url = "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = "https://oauth2.googleapis.com/token"
        self.userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
    
    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        return (
            f"{self.authorize_url}?"
            f"client_id={self.client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope=openid email profile&"
            f"state={state}&"
            f"access_type=offline"
        )
    
    def exchange_code_for_token(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        try:
            response = requests.post(
                self.token_url,
                data={
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'code': code,
                    'redirect_uri': redirect_uri,
                    'grant_type': 'authorization_code',
                },
                timeout=10
            )
            data = response.json()
            
            if 'error' in data:
                logger.error(f"Google token交换失败: {data}")
                return {'error': data.get('error_description', 'Unknown error')}
            
            return {
                'access_token': data.get('access_token'),
                'refresh_token': data.get('refresh_token'),
                'id_token': data.get('id_token'),
                'expires_in': data.get('expires_in', 3600),
            }
        except Exception as e:
            logger.error(f"Google token交换异常: {e}")
            return {'error': str(e)}
    
    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        try:
            response = requests.get(
                self.userinfo_url,
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10
            )
            data = response.json()
            
            if 'error' in data:
                return {'error': data.get('error_description', 'Unknown error')}
            
            return {
                'provider': 'google',
                'provider_user_id': data.get('sub'),
                'email': data.get('email'),
                'email_verified': data.get('email_verified', False),
                'nickname': data.get('name', ''),
                'avatar': data.get('picture', ''),
                'given_name': data.get('given_name', ''),
                'family_name': data.get('family_name', ''),
                'locale': data.get('locale', ''),
            }
        except Exception as e:
            logger.error(f"获取Google用户信息异常: {e}")
            return {'error': str(e)}


class AppleOAuth(OAuthProviderBase):
    """Apple Sign In"""
    
    def __init__(self):
        super().__init__()
        self.name = "apple"
        self.client_id = getattr(settings, 'APPLE_CLIENT_ID', '')  # Service ID
        self.team_id = getattr(settings, 'APPLE_TEAM_ID', '')
        self.key_id = getattr(settings, 'APPLE_KEY_ID', '')
        self.private_key = getattr(settings, 'APPLE_PRIVATE_KEY', '')
        self.authorize_url = "https://appleid.apple.com/auth/authorize"
        self.token_url = "https://appleid.apple.com/auth/token"
    
    def _generate_client_secret(self) -> str:
        """生成Apple client_secret (JWT)"""
        headers = {
            'alg': 'ES256',
            'kid': self.key_id,
        }
        payload = {
            'iss': self.team_id,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(days=180),
            'aud': 'https://appleid.apple.com',
            'sub': self.client_id,
        }
        return jwt.encode(payload, self.private_key, algorithm='ES256', headers=headers)
    
    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        return (
            f"{self.authorize_url}?"
            f"client_id={self.client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code id_token&"
            f"scope=name email&"
            f"response_mode=form_post&"
            f"state={state}"
        )
    
    def exchange_code_for_token(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        try:
            client_secret = self._generate_client_secret()
            response = requests.post(
                self.token_url,
                data={
                    'client_id': self.client_id,
                    'client_secret': client_secret,
                    'code': code,
                    'redirect_uri': redirect_uri,
                    'grant_type': 'authorization_code',
                },
                timeout=10
            )
            data = response.json()
            
            if 'error' in data:
                logger.error(f"Apple token交换失败: {data}")
                return {'error': data.get('error_description', 'Unknown error')}
            
            return {
                'access_token': data.get('access_token'),
                'refresh_token': data.get('refresh_token'),
                'id_token': data.get('id_token'),
                'expires_in': data.get('expires_in', 3600),
            }
        except Exception as e:
            logger.error(f"Apple token交换异常: {e}")
            return {'error': str(e)}
    
    def get_user_info(self, id_token: str, user_data: Dict = None) -> Dict[str, Any]:
        try:
            # 解码id_token (不验证签名，仅用于获取信息)
            decoded = jwt.decode(id_token, options={"verify_signature": False})
            
            result = {
                'provider': 'apple',
                'provider_user_id': decoded.get('sub'),
                'email': decoded.get('email'),
                'email_verified': decoded.get('email_verified', False),
            }
            
            # Apple只在首次登录时返回用户名
            if user_data:
                name = user_data.get('name', {})
                result['given_name'] = name.get('firstName', '')
                result['family_name'] = name.get('lastName', '')
                result['nickname'] = f"{result['given_name']} {result['family_name']}".strip()
            
            return result
        except Exception as e:
            logger.error(f"解析Apple id_token异常: {e}")
            return {'error': str(e)}


class SocialAuthService:
    """社交登录统一服务"""
    
    PROVIDERS = {
        'wechat': WeChatOAuth,
        'google': GoogleOAuth,
        'apple': AppleOAuth,
    }
    
    @classmethod
    def get_provider(cls, provider_name: str) -> Optional[OAuthProviderBase]:
        """获取OAuth提供商实例"""
        provider_class = cls.PROVIDERS.get(provider_name.lower())
        if provider_class:
            return provider_class()
        return None
    
    @classmethod
    def get_or_create_user(cls, provider_info: Dict[str, Any]) -> tuple:
        """
        根据第三方登录信息获取或创建用户
        
        Returns:
            tuple: (user, created)
        """
        from users.models import SocialAccount
        
        provider = provider_info.get('provider')
        provider_user_id = provider_info.get('provider_user_id')
        
        if not provider or not provider_user_id:
            return None, False
        
        # 查找已有关联
        try:
            social_account = SocialAccount.objects.get(
                provider=provider,
                provider_user_id=provider_user_id
            )
            return social_account.user, False
        except SocialAccount.DoesNotExist:
            pass
        
        # 通过邮箱查找用户
        email = provider_info.get('email')
        user = None
        created = False
        
        if email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                pass
        
        # 创建新用户
        if not user:
            username = cls._generate_username(provider_info)
            user = User.objects.create_user(
                username=username,
                email=email or f"{provider_user_id}@{provider}.social",
                password=None,  # 第三方登录用户无密码
            )
            user.first_name = provider_info.get('given_name', '')
            user.last_name = provider_info.get('family_name', '')
            user.save()
            created = True
        
        # 创建社交账号关联
        SocialAccount.objects.create(
            user=user,
            provider=provider,
            provider_user_id=provider_user_id,
            extra_data=provider_info,
        )
        
        return user, created
    
    @classmethod
    def _generate_username(cls, provider_info: Dict[str, Any]) -> str:
        """生成唯一用户名"""
        base = (
            provider_info.get('nickname') or
            provider_info.get('given_name') or
            provider_info.get('provider_user_id', '')[:8]
        )
        # 确保唯一性
        username = base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}_{counter}"
            counter += 1
        return username
