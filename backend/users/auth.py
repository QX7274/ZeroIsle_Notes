"""
自定义认证后端
使用MongoDB作为用户存储
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.conf import settings
from mongoengine.django.auth import User as MongoUser
from .mongodb_models import User as MongoDBUser

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
            # 尝试通过ID查找用户
            user = MongoDBUser.objects(id=user_id).first()
            if user:
                # 创建Django用户对象
                django_user = self._get_django_user(user)
                return django_user
        except Exception as e:
            print(f"MongoDB获取用户错误: {str(e)}")
            return None
        
        return None
    
    def _get_django_user(self, mongo_user):
        """
        将MongoDB用户转换为Django用户
        """
        # 创建一个MongoUser实例
        django_user = MongoUser()
        
        # 复制属性
        django_user.id = str(mongo_user.id)
        django_user.username = mongo_user.username
        django_user.email = mongo_user.email
        django_user.first_name = mongo_user.first_name
        django_user.last_name = mongo_user.last_name
        django_user.is_active = mongo_user.is_active
        django_user.is_staff = mongo_user.is_staff
        django_user.is_superuser = mongo_user.is_superuser
        django_user.last_login = mongo_user.last_login
        django_user.date_joined = mongo_user.date_joined
        
        # 设置密码哈希
        django_user.password = mongo_user.password
        
        return django_user
