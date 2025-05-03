"""
密码重置API视图
提供给管理系统调用的密码重置相关API
"""

import logging
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes
from users.services.email_service import EmailService
from users.services.sms_service import SmsService
from users.services.notification_service import NotificationService
from users.models import VerificationCode

logger = logging.getLogger(__name__)
User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def send_email_verification(request):
    """
    发送邮箱验证码
    
    请求参数:
    - email: 邮箱地址
    - code: 验证码
    - purpose: 用途
    
    返回:
    - 发送结果
    """
    try:
        email = request.data.get('email')
        code = request.data.get('code')
        purpose = request.data.get('purpose', 'reset_password')
        
        if not email or not code:
            return Response({
                'status': 'error',
                'message': '邮箱和验证码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 发送验证码邮件
        result = EmailService.send_verification_code(email, code, purpose)
        
        if result:
            logger.info(f"发送验证码邮件成功: {email}, 用途: {purpose}")
            return Response({
                'status': 'success',
                'message': '验证码邮件发送成功'
            })
        else:
            logger.error(f"发送验证码邮件失败: {email}")
            return Response({
                'status': 'error',
                'message': '验证码邮件发送失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        logger.error(f"发送验证码邮件出错: {str(e)}")
        return Response({
            'status': 'error',
            'message': f'发送验证码邮件出错: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def send_sms_verification(request):
    """
    发送短信验证码
    
    请求参数:
    - phone: 手机号
    - code: 验证码
    - purpose: 用途
    
    返回:
    - 发送结果
    """
    try:
        phone = request.data.get('phone')
        code = request.data.get('code')
        purpose = request.data.get('purpose', 'reset_password')
        
        if not phone or not code:
            return Response({
                'status': 'error',
                'message': '手机号和验证码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 发送验证码短信
        result = SmsService.send_verification_code(phone, code, purpose)
        
        if result:
            logger.info(f"发送验证码短信成功: {phone}, 用途: {purpose}")
            return Response({
                'status': 'success',
                'message': '验证码短信发送成功'
            })
        else:
            logger.error(f"发送验证码短信失败: {phone}")
            return Response({
                'status': 'error',
                'message': '验证码短信发送失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        logger.error(f"发送验证码短信出错: {str(e)}")
        return Response({
            'status': 'error',
            'message': f'发送验证码短信出错: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    重置用户密码
    
    请求参数:
    - user_id: 用户ID
    - new_password: 新密码
    
    返回:
    - 重置结果
    """
    try:
        user_id = request.data.get('user_id')
        new_password = request.data.get('new_password')
        
        if not user_id or not new_password:
            return Response({
                'status': 'error',
                'message': '用户ID和新密码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 查找用户
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.error(f"用户不存在: {user_id}")
            return Response({
                'status': 'error',
                'message': '用户不存在'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 设置新密码
        user.set_password(new_password)
        user.save()
        
        # 发送密码重置通知
        NotificationService.send_password_reset_notification(user)
        
        logger.info(f"用户密码重置成功: {user.username}")
        
        return Response({
            'status': 'success',
            'message': '密码重置成功'
        })
        
    except Exception as e:
        logger.error(f"重置用户密码出错: {str(e)}")
        return Response({
            'status': 'error',
            'message': f'重置用户密码出错: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
