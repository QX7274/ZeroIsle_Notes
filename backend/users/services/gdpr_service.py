"""
GDPR Service
Handles data export and deletion requests for privacy compliance.
"""

import json
import zipfile
import io
import logging
from typing import Dict, Any

from django.contrib.auth import get_user_model
from users.models import SocialAccount
from users.mongodb_models import User as MongoUser, UserProfile

logger = logging.getLogger(__name__)
User = get_user_model()

class GDPRService:
    @staticmethod
    def _get_mongo_profile(user):
        """按 Django 用户解析 MongoDB 资料文档（RISK-BE-012）。

        旧实现是 UserProfile.objects(user_id=str(user.id))，而两个 UserProfile
        Document 都没有 user_id 字段，运行必抛 InvalidQueryError（又被 except 吞掉，
        结果导出永远拿不到资料）。现在按真实字段解析：
        1) django_user_id 优先（signals/utils 写入的规范映射字段）；
        2) 回退到 user 引用（兼容历史上未回写 django_user_id 的旧记录）。
        只读查找，不创建任何文档。
        """
        if user is None or not getattr(user, 'id', None):
            return None

        profile = UserProfile.objects(django_user_id=str(user.id)).first()
        if profile:
            return profile

        mongo_user = MongoUser.objects(django_user_id=str(user.id)).first()
        username = getattr(user, 'username', None)
        if mongo_user is None and username:
            mongo_user = MongoUser.objects(username=username).first()
        if mongo_user is not None:
            return UserProfile.objects(user=mongo_user).first()
        return None

    @staticmethod
    def export_user_data(user):
        """
        Export all data associated with a user.
        Returns a dictionary or bytes (for file download).
        """
        data = {
            'account': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'date_joined': str(user.date_joined),
            },
            'profile': {},
            'social_accounts': [],
            'notes_metadata': [], # Placeholder: In real app, query Notes service
        }

        # Fetch Profile (Mongo)：RISK-BE-012 用真实字段解析（django_user_id / user 引用）
        try:
            profile = GDPRService._get_mongo_profile(user)
            if profile:
                data['profile'] = json.loads(profile.to_json())
        except Exception as e:
            logger.error(f"Error fetching profile for export: {e}")

        # Fetch Social Accounts (Django)
        try:
            social_accounts = SocialAccount.objects.filter(user=user)
            for acc in social_accounts:
                data['social_accounts'].append({
                    'provider': acc.provider,
                    'provider_user_id': acc.provider_user_id,
                    'nickname': acc.nickname,
                    'created_at': str(acc.created_at),
                })
        except Exception as e:
            logger.error(f"Error fetching social accounts for export: {e}")

        # In a real implementation, we would also fetch all Notes from MongoDB
        # For now, we return what we have.
        
        return data

    @staticmethod
    def delete_user_account(user, reason=None):
        """
        Initiate user account deletion.
        In a real system, this might schedule a deletion job after 30 days.

        RISK-BE-012：删除路径同样要能定位待清理的 MongoDB 资料，且必须使用真实字段查询。
        当前语义仍是「记录 + 异步删除」，因此这里只解析并记录，不做物理删除。
        """
        logger.info(f"User {user.id} requested account deletion. Reason: {reason}")
        try:
            profile = GDPRService._get_mongo_profile(user)
            logger.info("待清理的 MongoDB 资料: %s", profile.id if profile else '未找到')
        except Exception as e:
            logger.error(f"Error resolving profile for deletion: {e}")
        return True
