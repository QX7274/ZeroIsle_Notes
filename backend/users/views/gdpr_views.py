"""
GDPR Compliance Views
Endpoints for data export and account deletion.
"""

import json
import logging
import zipfile
from io import BytesIO
from datetime import datetime

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from bson import json_util

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_user_data(request):
    """
    Export all user data as a ZIP file (GDPR Article 20 - Right to Data Portability).
    
    GET /api/v1/auth/gdpr/export/
    
    Returns:
        ZIP file containing:
        - user_profile.json - Basic profile info
        - notes.json - All user notes
        - settings.json - User settings
        - activity.json - Account activity log
    """
    user = request.user
    user_id = str(user.id)
    
    logger.info(f"GDPR Data Export requested by user: {user_id}")
    
    try:
        export_data = {}
        
        # 1. User Profile
        export_data['user_profile'] = {
            'id': user_id,
            'username': user.username,
            'email': getattr(user, 'email', ''),
            'phone': getattr(user, 'phone', ''),
            'created_at': str(getattr(user, 'created_at', '')),
            'last_login': str(getattr(user, 'last_login', '')),
        }
        
        # 2. User Settings
        try:
            from users.mongodb_models import UserSettings
            settings_doc = UserSettings.objects(user_id=user_id).first()
            if settings_doc:
                export_data['settings'] = json.loads(settings_doc.to_json())
        except Exception as e:
            logger.warning(f"Could not export settings: {e}")
            export_data['settings'] = {}
        
        # 3. Notes
        try:
            from notes.mongodb_models import Note
            notes = Note.objects(user_id=user_id, is_deleted__ne=True)
            export_data['notes'] = json.loads(notes.to_json())
        except Exception as e:
            logger.warning(f"Could not export notes: {e}")
            export_data['notes'] = []
        
        # 4. Login Activity
        try:
            from users.models import LoginAttempt
            attempts = LoginAttempt.objects(user_id=user_id).order_by('-timestamp').limit(100)
            export_data['login_activity'] = json.loads(attempts.to_json())
        except Exception as e:
            logger.warning(f"Could not export login activity: {e}")
            export_data['login_activity'] = []
        
        # 5. AI Conversations (if exists)
        try:
            from ai_assistant.mongodb_models import Conversation
            conversations = Conversation.objects(user_id=user_id)
            export_data['ai_conversations'] = json.loads(conversations.to_json())
        except Exception as e:
            logger.warning(f"Could not export AI conversations: {e}")
            export_data['ai_conversations'] = []
        
        # Create ZIP file
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for key, data in export_data.items():
                json_content = json.dumps(data, indent=2, default=str, ensure_ascii=False)
                zip_file.writestr(f'{key}.json', json_content)
            
            # Add metadata
            metadata = {
                'export_date': datetime.utcnow().isoformat(),
                'user_id': user_id,
                'format_version': '1.0',
            }
            zip_file.writestr('_metadata.json', json.dumps(metadata, indent=2))
        
        zip_buffer.seek(0)
        
        # Create response
        response = HttpResponse(zip_buffer.read(), content_type='application/zip')
        filename = f'zeroislenotes_data_export_{datetime.utcnow().strftime("%Y%m%d")}.zip'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        logger.info(f"GDPR Data Export completed for user: {user_id}")
        return response
        
    except Exception as e:
        logger.error(f"GDPR Data Export failed: {e}")
        return JsonResponse({'error': '数据导出失败，请稍后重试'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_account_deletion(request):
    """
    Request account deletion (GDPR Article 17 - Right to be Forgotten).
    
    POST /api/v1/auth/gdpr/delete/
    
    Request Body:
        confirmation: str - Must be "DELETE" to confirm
        password: str - Current password for verification
        reason: str (optional) - Reason for deletion
    
    Note: This initiates a 30-day deletion period. User can cancel within this time.
    """
    user = request.user
    user_id = str(user.id)
    
    confirmation = request.data.get('confirmation', '')
    password = request.data.get('password', '')
    reason = request.data.get('reason', '')
    
    # Validate confirmation
    if confirmation != 'DELETE':
        return JsonResponse({
            'error': '请输入 "DELETE" 以确认删除账户'
        }, status=400)
    
    # Verify password
    if not user.check_password(password):
        return JsonResponse({
            'error': '密码验证失败'
        }, status=401)
    
    logger.warning(f"Account deletion requested by user: {user_id}, reason: {reason}")
    
    try:
        # Mark user for deletion (soft delete with 30-day grace period)
        user.is_active = False
        user.deletion_requested_at = datetime.utcnow()
        user.deletion_reason = reason
        user.save()
        
        # Log the deletion request
        try:
            from users.models import LoginAttempt
            LoginAttempt.record_attempt(
                ip_address=request.META.get('REMOTE_ADDR', 'unknown'),
                success=True,
                username=user.username,
                user_id=user_id,
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                failure_reason='ACCOUNT_DELETION_REQUESTED'
            )
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'message': '账户删除请求已提交。您的账户将在30天后永久删除。在此期间，您可以登录以取消删除。',
            'deletion_date': (datetime.utcnow().replace(day=datetime.utcnow().day + 30)).isoformat(),
        })
        
    except Exception as e:
        logger.error(f"Account deletion request failed: {e}")
        return JsonResponse({'error': '删除请求失败，请稍后重试'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_account_deletion(request):
    """
    Cancel a pending account deletion request.
    
    POST /api/v1/auth/gdpr/delete/cancel/
    """
    user = request.user
    user_id = str(user.id)
    
    if not hasattr(user, 'deletion_requested_at') or not user.deletion_requested_at:
        return JsonResponse({
            'error': '没有待处理的删除请求'
        }, status=400)
    
    logger.info(f"Account deletion cancelled by user: {user_id}")
    
    try:
        user.is_active = True
        user.deletion_requested_at = None
        user.deletion_reason = None
        user.save()
        
        return JsonResponse({
            'success': True,
            'message': '账户删除请求已取消'
        })
        
    except Exception as e:
        logger.error(f"Cancel deletion failed: {e}")
        return JsonResponse({'error': '取消失败，请稍后重试'}, status=500)
