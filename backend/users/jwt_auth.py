"""
自定义JWT认证类
处理UUID格式的用户ID
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from rest_framework import exceptions
import uuid
import logging

from django.contrib.auth import get_user_model
from .mongodb_models import User as MongoDBUser
from .services.token_service import TokenBlacklistService

logger = logging.getLogger(__name__)
DjangoUser = get_user_model()

class CustomJWTAuthentication(JWTAuthentication):
    """
    自定义JWT认证类，处理UUID格式的用户ID
    在开发模式下支持简单的开发令牌
    同时检查Access Token是否被加入黑名单
    """
    
    def authenticate(self, request):
        """
        重写authenticate方法：
        1) 走标准JWT解析流程
        2) 校验令牌是否在黑名单中（基于JTI）
        3) 返回(user, validated_token)
        """
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        # 验证并解析JWT
        validated_token = self.get_validated_token(raw_token)

        # 黑名单校验：若在黑名单中则拒绝
        try:
            if TokenBlacklistService and TokenBlacklistService.is_blacklisted(validated_token):
                logger.warning('访问令牌命中黑名单，拒绝访问')
                raise exceptions.AuthenticationFailed(_('Token is blacklisted'))
        except Exception as e:
            logger.error(f'黑名单校验失败: {e}')
            # 出于安全考虑，校验异常时也拒绝
            raise exceptions.AuthenticationFailed(_('Token validation error'))

        user = self.get_user(validated_token)
        return (user, validated_token)
    
    def get_user(self, validated_token):
        """
        重写get_user方法，直接从MongoDB获取用户。
        """
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            logger.error(f"JWT令牌中没有用户ID声明: {api_settings.USER_ID_CLAIM}")
            raise exceptions.AuthenticationFailed(_('Token contained no recognizable user identification'))

        try:
            user_id_str = str(user_id)
            normalized_user_id = user_id_str.replace('-', '')

            # 优先直接通过JWT中的user_id查询Mongo用户（兼容带/不带连字符）
            user = MongoDBUser.objects(id__in=[user_id_str, normalized_user_id]).first()

            # 若未命中，则兼容“JWT user_id=django user.id”的场景，转映射到mongo_id
            if user is None:
                django_user = DjangoUser.objects.filter(id__in=[user_id_str, normalized_user_id]).first()
                if django_user and getattr(django_user, 'mongo_id', None):
                    mongo_id = str(django_user.mongo_id)
                    user = MongoDBUser.objects(id__in=[mongo_id, mongo_id.replace('-', '')]).first()

            if user is None:
                logger.warning(f"在MongoDB中未找到用户ID: {user_id}")
                raise MongoDBUser.DoesNotExist

        except MongoDBUser.DoesNotExist:
            raise exceptions.AuthenticationFailed(_('User not found'))
        except Exception as e:
            logger.error(f"通过JWT获取用户时发生异常: {e}")
            raise exceptions.AuthenticationFailed(_('Invalid token or user not found'))

        if not user.is_active:
            raise exceptions.AuthenticationFailed(_('User is inactive'))

        return user
