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
from users.models import UserProfile, SocialAccount

logger = logging.getLogger(__name__)
User = get_user_model()

class GDPRService:
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

        # Fetch Profile (Mongo)
        try:
            profile = UserProfile.objects(user_id=str(user.id)).first()
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
        """
        logger.info(f"User {user.id} requested account deletion. Reason: {reason}")
        # Logic to mark user for deletion or delete immediately
        # user.is_active = False
        # user.save()
        return True
