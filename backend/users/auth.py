"""
自定义认证后端
使用MongoDB作为用户存储
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.conf import settings
import uuid
import logging
from .mongodb_models import User as MongoDBUser

logger = logging.getLogger(__name__)

class MongoDBUserBackend(ModelBackend):
    """
    MongoDB用户认证后端
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        使用MongoDB验证用户
        """
        try:
            # 尝试通过用户名查找用户
            user = MongoDBUser.objects(username=username).first()
            if user and user.check_password(password):
                # 创建Django用户对象
                django_user = self._get_django_user(user)
                return django_user
        except Exception as e:
            print(f"MongoDB认证错误: {str(e)}")
            return None

        return None

    def get_user(self, user_id):
        """
        通过用户ID获取用户
        """
        try:
            logger.debug(f"尝试获取用户, ID: {user_id}, 类型: {type(user_id)}")

            # 尝试不同的方式查找用户
            user = None

            # 1. 尝试直接使用ID查找
            try:
                user = MongoDBUser.objects(id=user_id).first()
                if user:
                    logger.debug(f"通过原始ID找到用户: {user.username}")
            except Exception as e:
                logger.debug(f"通过原始ID查找用户失败: {str(e)}")

            # 2. 如果是字符串，尝试将其转换为UUID
            if not user and isinstance(user_id, str):
                try:
                    uuid_id = uuid.UUID(user_id)
                    logger.debug(f"将字符串ID转换为UUID: {uuid_id}")
                    user = MongoDBUser.objects(id=uuid_id).first()
                    if user:
                        logger.debug(f"通过UUID找到用户: {user.username}")
                except (ValueError, TypeError) as e:
                    logger.debug(f"UUID转换失败: {str(e)}")

            # 3. 如果是UUID，尝试将其转换为字符串
            if not user and isinstance(user_id, uuid.UUID):
                try:
                    str_id = str(user_id)
                    logger.debug(f"将UUID转换为字符串: {str_id}")
                    user = MongoDBUser.objects(id=str_id).first()
                    if user:
                        logger.debug(f"通过字符串ID找到用户: {user.username}")
                except Exception as e:
                    logger.debug(f"字符串转换失败: {str(e)}")

            # 如果找到用户，创建Django用户对象
            if user:
                django_user = self._get_django_user(user)
                return django_user
            else:
                logger.warning(f"未找到用户ID: {user_id}")
                return None

        except Exception as e:
            logger.error(f"MongoDB获取用户错误: {str(e)}", exc_info=True)
            return None

    def _get_django_user(self, mongo_user):
        """
        将MongoDB用户转换为Django用户
        """
        # 获取Django用户模型
        User = get_user_model()

        # 尝试查找现有用户
        try:
            # 首先尝试通过mongo_id查找
            django_user = User.objects.filter(mongo_id=mongo_user.id).first()
            if django_user:
                logger.debug(f"通过mongo_id找到Django用户: {django_user.username}")
                return django_user

            # 然后尝试通过username查找
            django_user = User.objects.get(username=mongo_user.username)

            # 如果找到用户但mongo_id为空，更新它
            if not django_user.mongo_id:
                django_user.mongo_id = mongo_user.id
                django_user.save(update_fields=['mongo_id'])
                logger.debug(f"更新Django用户的mongo_id: {django_user.username} -> {mongo_user.id}")

        except User.DoesNotExist:
            # 创建新用户
            logger.debug(f"创建新Django用户: {mongo_user.username}, MongoDB ID: {mongo_user.id}")
            django_user = User(
                id=uuid.uuid4(),  # 生成新的UUID
                mongo_id=mongo_user.id,  # 存储MongoDB的ID
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
