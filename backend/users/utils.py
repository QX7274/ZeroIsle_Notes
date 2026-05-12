"""
用户模块工具函数
提供用户相关的辅助功能
"""

import logging
from typing import Optional

from bson.dbref import DBRef
from mongoengine.errors import DoesNotExist as MongoDoesNotExist

logger = logging.getLogger(__name__)


def _extract_reference_id(raw_ref):
    if raw_ref is None:
        return None
    if isinstance(raw_ref, DBRef):
        return raw_ref.id
    if hasattr(raw_ref, 'pk'):
        return raw_ref.pk
    if hasattr(raw_ref, 'id'):
        return raw_ref.id
    return raw_ref


def get_mongo_user_from_django(django_user):
    """
    根据Django用户获取对应的MongoDB用户对象
    这是一个独立的工具函数，可以在任何地方使用
    
    Args:
        django_user: Django User对象
        
    Returns:
        MongoUser对象或None
        
    Example:
        from users.utils import get_mongo_user_from_django
        
        mongo_user = get_mongo_user_from_django(request.user)
        if mongo_user:
            # 使用mongo_user进行操作
            notes = Note.objects(user=mongo_user)
    """
    if not django_user or not hasattr(django_user, 'is_authenticated') or not django_user.is_authenticated:
        return None
    
    try:
        # 注意：这里必须使用 mongodb_models.UserProfile（含 django_user_id 字段）
        from .mongodb_models import User as MongoUser, UserProfile

        profile = UserProfile.objects(django_user_id=str(django_user.id)).first()
        if profile:
            try:
                if profile.user:
                    return profile.user
            except MongoDoesNotExist:
                logger.warning(
                    "Django 用户 %s 的 Mongo profile 映射已失效，转入回退查找逻辑",
                    getattr(django_user, 'username', django_user),
                )
                raw_user_ref = getattr(profile, '_data', {}).get('user')
                raw_user_id = _extract_reference_id(raw_user_ref)
                if raw_user_id is not None:
                    mongo_user = MongoUser.objects(id=raw_user_id).first()
                    if mongo_user:
                        return mongo_user

        # 如果映射不存在，先按 django_user_id / username 尝试查找 Mongo 用户
        mongo_user = (
            MongoUser.objects(django_user_id=str(django_user.id)).first()
            or MongoUser.objects(username=django_user.username).first()
        )

        if not mongo_user:
            # 创建新的 Mongo 用户（密码字段必填，沿用 Django 已哈希密码）
            mongo_user = MongoUser(
                username=django_user.username,
                email=django_user.email or None,
                password=getattr(django_user, 'password', ''),
                is_active=django_user.is_active,
                django_user_id=str(django_user.id),
            )
            mongo_user.save()

        # 建立或修复映射关系
        if not profile:
            # 优先复用已存在的 user 唯一映射，避免 duplicate key(user_1)
            profile = UserProfile.objects(user=mongo_user).first()
            if not profile:
                profile = UserProfile(user=mongo_user)

        profile.user = mongo_user
        profile.django_user_id = str(django_user.id)
        profile.save()

        return mongo_user

    except Exception as e:
        logger.error(f"获取MongoDB用户失败: {str(e)}", exc_info=True)
        return None


def get_mongo_user_by_id(django_user_id: str):
    """
    根据Django用户ID获取对应的MongoDB用户对象
    
    Args:
        django_user_id: Django User的ID（字符串格式）
        
    Returns:
        MongoUser对象或None
    """
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        django_user = User.objects.get(id=django_user_id)
        return get_mongo_user_from_django(django_user)
    except Exception as e:
        logger.error(f"根据ID获取MongoDB用户失败: {str(e)}", exc_info=True)
        return None


def ensure_user_profile_mapping(django_user, mongo_user) -> bool:
    """
    确保Django用户和MongoDB用户之间的映射关系存在
    """
    try:
        from .mongodb_models import UserProfile

        profile = UserProfile.objects(django_user_id=str(django_user.id)).first()
        if not profile:
            profile = UserProfile(
                user=mongo_user,
                django_user_id=str(django_user.id),
            )
        else:
            profile.user = mongo_user
            profile.django_user_id = str(django_user.id)
        profile.save()
        return True
    except Exception as e:
        logger.error(f"创建用户映射失败: {str(e)}", exc_info=True)
        return False
