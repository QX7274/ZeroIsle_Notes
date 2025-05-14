"""
自定义认证中间件
处理UUID和数字ID格式转换
"""

import logging
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject
from django.contrib.auth.middleware import AuthenticationMiddleware
from django.contrib import auth
import uuid

logger = logging.getLogger(__name__)

def get_user(request):
    """
    自定义get_user函数，处理UUID和数字ID格式
    """
    if not hasattr(request, '_cached_user'):
        try:
            # 尝试获取会话中的用户ID
            user_id = request.session.get(auth.SESSION_KEY)
            logger.debug(f"从会话中获取用户ID: {user_id}, 类型: {type(user_id)}")
            
            if user_id is None:
                request._cached_user = AnonymousUser()
                return request._cached_user
            
            # 获取用户模型
            User = get_user_model()
            user = None
            
            # 尝试直接使用ID查找用户
            try:
                user = User.objects.get(pk=user_id)
                logger.debug(f"通过ID直接找到用户: {user.username}")
            except (User.DoesNotExist, ValueError):
                # 如果是数字ID，尝试查找具有该ID的旧用户
                try:
                    if isinstance(user_id, str) and user_id.isdigit():
                        # 尝试通过username查找用户
                        # 这里假设旧的数字ID对应的用户名可能是相同的数字
                        user = User.objects.filter(username=user_id).first()
                        if user:
                            logger.debug(f"通过username找到用户: {user.username}")
                            # 更新会话中的用户ID
                            request.session[auth.SESSION_KEY] = str(user.id)
                            request.session.modified = True
                except Exception as e:
                    logger.warning(f"查找旧用户失败: {str(e)}")
            
            # 如果找不到用户，返回匿名用户
            if user is None:
                logger.warning(f"未找到用户ID: {user_id}")
                request._cached_user = AnonymousUser()
            else:
                request._cached_user = user
        except Exception as e:
            logger.error(f"获取用户失败: {str(e)}", exc_info=True)
            request._cached_user = AnonymousUser()
    
    return request._cached_user

class CustomAuthenticationMiddleware(AuthenticationMiddleware):
    """
    自定义认证中间件，处理UUID和数字ID格式
    """
    def process_request(self, request):
        request.user = SimpleLazyObject(lambda: get_user(request))
