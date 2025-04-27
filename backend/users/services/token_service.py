from datetime import datetime, timedelta
import jwt
from django.conf import settings

class TokenService:
    """
    JWT令牌服务
    
    功能：
    1. 生成访问令牌和刷新令牌
    2. 验证令牌有效性
    3. 自动刷新访问令牌
    """
    
    @staticmethod
    def generate_access_token(user):
        payload = {
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(minutes=settings.JWT['ACCESS_TOKEN_LIFETIME']),
            'iat': datetime.utcnow(),
            'token_type': 'access'
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

    @staticmethod
    def generate_refresh_token(user):
        payload = {
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=settings.JWT['REFRESH_TOKEN_LIFETIME']),
            'iat': datetime.utcnow(),
            'token_type': 'refresh'
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

    @staticmethod
    def verify_token(token):
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError('Token expired')
        except jwt.InvalidTokenError:
            raise ValueError('Invalid token')

    @classmethod
    def refresh_tokens(cls, refresh_token):
        """
        使用刷新令牌获取新访问令牌
        """
        payload = cls.verify_token(refresh_token)
        if payload.get('token_type') != 'refresh':
            raise ValueError('Invalid token type')
        
        user = User.objects.get(id=payload['user_id'])
        return {
            'access': cls.generate_access_token(user),
            'refresh': cls.generate_refresh_token(user)
        }