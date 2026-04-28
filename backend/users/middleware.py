"""
自定义认证中间件
处理UUID和数字ID格式转换，并注入MongoDB用户对象
"""

import logging
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject
from django.contrib.auth.middleware import AuthenticationMiddleware
from django.contrib import auth
import uuid

logger = logging.getLogger(__name__)


def get_mongo_user(django_user):
    """
    根据Django用户获取对应的MongoDB用户对象
    这个函数被中间件使用，也可以在其他地方直接调用

    Args:
        django_user: Django User对象

    Returns:
        MongoUser对象或None

    Note:
        推荐使用 users.utils.get_mongo_user_from_django 工具函数
        该函数提供了更完整的文档和类型提示
    """
    if not django_user or django_user.is_anonymous:
        return None

    # 使用utils模块中的工具函数
    try:
        from .utils import get_mongo_user_from_django
        return get_mongo_user_from_django(django_user)
    except ImportError:
        # 如果utils模块不可用，使用降级方案
        logger.warning("无法导入users.utils，使用降级方案")
        return _get_mongo_user_fallback(django_user)


def _get_mongo_user_fallback(django_user):
    """
    获取MongoDB用户的降级方案
    仅在utils模块不可用时使用
    
    优化: 使用 transaction.atomic() 确保 Django 和 MongoDB 操作的原子性
    """
    from django.db import transaction
    
    try:
        from .mongodb_models import User as MongoUser, UserProfile

        # 优先通过 django_user_id 映射读取
        profile = UserProfile.objects(django_user_id=str(django_user.id)).first()
        if profile and profile.user:
            return profile.user

        # 回退：通过 django_user_id / username 查找 MongoUser
        mongo_user = (
            MongoUser.objects(django_user_id=str(django_user.id)).first()
            or MongoUser.objects(username=django_user.username).first()
        )

        # 不存在则创建新的 MongoUser
        if not mongo_user:
            with transaction.atomic():
                mongo_user = MongoUser(
                    username=django_user.username,
                    email=django_user.email or None,
                    password=getattr(django_user, 'password', ''),
                    is_active=django_user.is_active,
                    django_user_id=str(django_user.id),
                )
                mongo_user.save()

        # 创建/更新 UserProfile 映射
        with transaction.atomic():
            if not profile:
                profile = UserProfile(
                    user=mongo_user,
                    django_user_id=str(django_user.id),
                )
            else:
                profile.user = mongo_user
                profile.django_user_id = str(django_user.id)
            profile.save()

        logger.info(f"为Django用户 {django_user.username} 建立MongoDB映射成功")
        return mongo_user


    except Exception as e:
        logger.error(f"获取MongoDB用户失败: {str(e)}", exc_info=True)
        return None

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
    自定义认证中间件，处理UUID和数字ID格式，并注入MongoDB用户对象
    """
    def process_request(self, request):
        # 设置Django用户
        request.user = SimpleLazyObject(lambda: get_user(request))

        # 延迟加载MongoDB用户
        request.mongo_user = SimpleLazyObject(
            lambda: get_mongo_user(request.user) if hasattr(request, 'user') else None
        )
