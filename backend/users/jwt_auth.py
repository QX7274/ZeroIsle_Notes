"""
自定义JWT认证类
处理UUID格式的用户ID
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions
import uuid
import logging

from .mongodb_models import User as MongoDBUser

logger = logging.getLogger(__name__)

class CustomJWTAuthentication(JWTAuthentication):
    """
    自定义JWT认证类，处理UUID格式的用户ID
    """

    def get_user(self, validated_token):
        """
        重写get_user方法，处理UUID格式的用户ID
        """
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
            logger.debug(f"从JWT令牌获取用户ID: {user_id}, 类型: {type(user_id)}")
        except KeyError:
            logger.error(f"JWT令牌中没有用户ID声明: {api_settings.USER_ID_CLAIM}")
            raise exceptions.AuthenticationFailed(_('Token contained no recognizable user identification'))

        try:
            # 获取Django用户模型
            User = self.user_model
            django_user = None

            # 1. 首先尝试直接使用ID查找Django用户
            try:
                # 如果是字符串ID，尝试转换为UUID
                if isinstance(user_id, str):
                    try:
                        user_id_uuid = uuid.UUID(user_id)
                        logger.debug(f"将字符串用户ID转换为UUID: {user_id_uuid}")
                        django_user = User.objects.filter(id=user_id_uuid).first()
                    except ValueError:
                        logger.warning(f"无效的UUID格式用户ID: {user_id}")
                        # 尝试作为字符串ID查找
                        django_user = User.objects.filter(id=user_id).first()
                else:
                    # 直接使用ID查找
                    django_user = User.objects.filter(id=user_id).first()

                if django_user:
                    logger.debug(f"通过ID直接找到Django用户: {django_user.username}")
                    return django_user
            except Exception as e:
                logger.warning(f"通过ID查找Django用户失败: {str(e)}")

            # 2. 尝试通过ID查找MongoDB用户
            mongo_user = None
            try:
                # 尝试直接使用ID
                mongo_user = MongoDBUser.objects(id=user_id).first()

                # 如果是字符串，尝试转换为UUID
                if not mongo_user and isinstance(user_id, str):
                    try:
                        user_id_uuid = uuid.UUID(user_id)
                        mongo_user = MongoDBUser.objects(id=user_id_uuid).first()
                    except ValueError:
                        pass

                # 如果找到MongoDB用户，尝试查找或创建对应的Django用户
                if mongo_user:
                    logger.debug(f"找到MongoDB用户: {mongo_user.username}")

                    # 尝试通过mongo_id查找Django用户
                    django_user = User.objects.filter(mongo_id=mongo_user.id).first()
                    if django_user:
                        logger.debug(f"通过mongo_id找到Django用户: {django_user.username}")
                        return django_user

                    # 尝试通过username查找Django用户
                    django_user = User.objects.filter(username=mongo_user.username).first()
                    if django_user:
                        logger.debug(f"通过username找到Django用户: {django_user.username}")
                        # 更新mongo_id
                        if not django_user.mongo_id:
                            django_user.mongo_id = mongo_user.id
                            django_user.save(update_fields=['mongo_id'])
                            logger.debug(f"更新Django用户的mongo_id: {django_user.username} -> {mongo_user.id}")
                        return django_user

                    # 如果没有找到Django用户，创建一个新用户
                    logger.debug(f"创建新Django用户: {mongo_user.username}")
                    django_user = User(
                        id=uuid.uuid4(),  # 生成新的UUID
                        mongo_id=mongo_user.id,
                        username=mongo_user.username,
                        email=mongo_user.email,
                        first_name=mongo_user.first_name,
                        last_name=mongo_user.last_name,
                        is_active=mongo_user.is_active,
                        is_staff=getattr(mongo_user, 'is_staff', False),
                        is_superuser=getattr(mongo_user, 'is_superuser', False),
                        last_login=mongo_user.last_login,
                        date_joined=mongo_user.date_joined
                    )
                    # 设置密码哈希
                    django_user.password = mongo_user.password
                    django_user.save()
                    return django_user
            except Exception as e:
                logger.warning(f"查找MongoDB用户失败: {str(e)}")

            # 如果所有尝试都失败，抛出异常
            if not django_user:
                logger.error(f"未找到用户ID: {user_id}")
                raise exceptions.AuthenticationFailed(_('User not found'))

            return django_user
        except Exception as e:
            logger.error(f"获取用户失败: {str(e)}", exc_info=True)
            raise exceptions.AuthenticationFailed(_('Invalid token or user not found'))
