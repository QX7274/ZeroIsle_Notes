"""
开发模式认证中间件
在开发环境中允许使用简单的开发令牌，无需JWT验证
仅在DEBUG=True时启用
"""

import logging
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject
from users.mongodb_models import User
import uuid

logger = logging.getLogger(__name__)


def get_dev_user(request):
    """
    开发模式下获取或创建开发用户
    """
    # 检查是否在开发模式下
    if not settings.DEBUG:
        return AnonymousUser()
    
    # 检查是否有Authorization头
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    
    # 检查是否是开发令牌
    if not auth_header.startswith('Bearer '):
        return AnonymousUser()
    
    token = auth_header.replace('Bearer ', '').strip()
    
    # 检查是否是开发令牌（dev-token, simple-auth, 等）
    if not (token.startswith('dev-token') or token.startswith('simple-auth')):
        return AnonymousUser()
    
    try:
        # 查找或创建开发用户
        dev_user_id = 'dev-user-001'  # 固定的开发用户ID
        
        try:
            # 尝试获取现有的开发用户
            dev_user = User.objects.get(username='developer')
            logger.debug(f'找到现有开发用户: {dev_user.username}')
        except User.DoesNotExist:
            # 创建新的开发用户
            logger.info('创建新的开发用户')
            dev_user = User(
                id=uuid.UUID(dev_user_id) if isinstance(dev_user_id, str) and len(dev_user_id) == 36 else uuid.uuid4(),
                username='developer',
                email='dev@zeroislenotes.com',
                nickname='开发者',
                is_active=True,
                is_staff=True,
                is_superuser=True,
            )
            # 设置一个简单的密码
            dev_user.set_password('developer123')
            dev_user.save()
            logger.info(f'开发用户创建成功: {dev_user.username}')
        
        # 标记为开发用户
        dev_user.is_dev_user = True
        return dev_user
        
    except Exception as e:
        logger.error(f'开发模式认证失败: {str(e)}', exc_info=True)
        return AnonymousUser()


class DevAuthMiddleware:
    """
    开发模式认证中间件
    在开发环境中拦截请求，允许使用简单的开发令牌
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 仅在开发模式下启用
        if settings.DEBUG:
            # 检查是否使用开发令牌
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                token = auth_header.replace('Bearer ', '').strip()
                
                # 如果是开发令牌，设置开发用户
                if token.startswith('dev-token') or token.startswith('simple-auth'):
                    request.user = SimpleLazyObject(lambda: get_dev_user(request))
                    logger.debug(f'开发模式: 使用开发令牌认证，用户: {request.user}')
        
        response = self.get_response(request)
        return response



