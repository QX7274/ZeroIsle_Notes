"""
Push Notification Service (FCM)

Handles sending push notifications to mobile/web devices using Firebase Cloud Messaging.
"""

import logging
import firebase_admin
from firebase_admin import messaging, credentials
from django.conf import settings
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class PushService:
    """
    Firebase Cloud Messaging (FCM) Service
    """
    
    _initialized = False
    
    def __init__(self):
        self._initialize()
    
    def _initialize(self):
        """Initialize Firebase Admin SDK"""
        if self._initialized:
            return
            
        try:
            # Check if already initialized by another service
            if not firebase_admin._apps:
                cred_path = getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None)
                if cred_path:
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                    self._initialized = True
                    logger.info("Firebase Admin initialized successfully")
                else:
                    logger.warning("FIREBASE_CREDENTIALS_PATH not set, PushService disabled")
            else:
                self._initialized = True
                
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")

    def send_to_user(self, user_id: str, title: str, body: str, data: Dict = None) -> bool:
        """
        Send push notification to all active devices of a user.
        
        Args:
            user_id: User ID
            title: Notification Title
            body: Notification Body
            data: Optional data payload
            
        Returns:
            bool: Success status
        """
        if not self._initialized:
            return False
            
        # circular import avoidance
        from users.mongodb_models import UserDevice
        
        try:
            # Fetch user devices with FCM tokens
            devices = UserDevice.objects.filter(user=user_id, is_active=True, push_token__exists=True)
            tokens = [d.push_token for d in devices if d.push_token]
            
            if not tokens:
                logger.info(f"No active push tokens for user {user_id}")
                return False
                
            return self.send_multicast(tokens, title, body, data)
            
        except Exception as e:
            logger.error(f"Failed to send push to user {user_id}: {e}")
            return False

    def send_multicast(self, tokens: List[str], title: str, body: str, data: Dict = None) -> bool:
        """
        Send message to multiple devices
        """
        if not self._initialized or not tokens:
            return False
            
        try:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                tokens=tokens,
            )
            
            response = messaging.send_multicast(message)
            logger.info(f"FCM Multicast sent: {response.success_count} success, {response.failure_count} failure")
            
            if response.failure_count > 0:
                self._handle_failed_tokens(tokens, response)
                
            return True
            
        except Exception as e:
            logger.error(f"FCM Send Error: {e}")
            return False
            
    def _handle_failed_tokens(self, tokens, response):
        """Clean up invalid tokens"""
        from users.mongodb_models import UserDevice
        
        for idx, resp in enumerate(response.responses):
            if not resp.success:
                # remove invalid tokens
                if resp.exception.code == 'NOT_FOUND' or resp.exception.code == 'INVALID_ARGUMENT':
                    token = tokens[idx]
                    UserDevice.objects.filter(push_token=token).update(is_active=False)
                    logger.info(f"Deactivated invalid token: {token}")

# Singleton
push_service = PushService()
