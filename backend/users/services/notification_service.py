"""
通知服务
"""

import logging
from django.utils import timezone
from users.models import UserDevice
from users.services.email_service import EmailService
from users.services.sms_service import SmsService

logger = logging.getLogger('backend')

class NotificationService:
    """
    通知服务类
    处理所有用户通知相关功能
    """
    
    @staticmethod
    def send_push_notification(user, title, body, data=None):
        """
        发送推送通知
        
        Args:
            user: 用户对象
            title: 通知标题
            body: 通知内容
            data: 附加数据
            
        Returns:
            bool: 发送结果
        """
        # 获取用户活跃设备
        devices = UserDevice.objects.filter(user=user, is_active=True, push_token__isnull=False)
        
        if not devices.exists():
            logger.info(f"用户 {user.id} 没有可用的推送设备")
            return False
        
        success_count = 0
        for device in devices:
            try:
                # 这里需要根据不同的推送服务实现具体的推送逻辑
                # 例如FCM、APNs等
                if device.device_type == 'ios':
                    success = NotificationService._send_apns_notification(
                        device.push_token, title, body, data
                    )
                elif device.device_type == 'android':
                    success = NotificationService._send_fcm_notification(
                        device.push_token, title, body, data
                    )
                else:
                    success = False
                
                if success:
                    success_count += 1
            except Exception as e:
                logger.error(f"向设备 {device.id} 发送推送通知失败: {e}")
        
        return success_count > 0
    
    @staticmethod
    def _send_apns_notification(token, title, body, data):
        """
        发送APNs推送通知（iOS）
        
        Args:
            token: 设备令牌
            title: 通知标题
            body: 通知内容
            data: 附加数据
            
        Returns:
            bool: 发送结果
        """
        # 这里需要实现APNs推送逻辑
        logger.info(f"向iOS设备 {token} 发送推送通知")
        return True
    
    @staticmethod
    def _send_fcm_notification(token, title, body, data):
        """
        发送FCM推送通知（Android）
        
        Args:
            token: 设备令牌
            title: 通知标题
            body: 通知内容
            data: 附加数据
            
        Returns:
            bool: 发送结果
        """
        # 这里需要实现FCM推送逻辑
        logger.info(f"向Android设备 {token} 发送推送通知")
        return True
    
    @staticmethod
    def send_login_notification(user, ip, device_info):
        """
        发送登录通知
        
        Args:
            user: 用户对象
            ip: 登录IP
            device_info: 设备信息
            
        Returns:
            bool: 发送结果
        """
        # 推送通知
        title = "新设备登录"
        body = f"您的账号于{timezone.now().strftime('%Y-%m-%d %H:%M:%S')}在新设备上登录"
        NotificationService.send_push_notification(user, title, body, {
            'type': 'login_notification',
            'ip': ip,
            'device': device_info
        })
        
        # 邮件通知
        if user.email:
            EmailService.send_email(
                user.email,
                "零屿笔记 - 新设备登录",
                f"您的账号于{timezone.now().strftime('%Y-%m-%d %H:%M:%S')}在新设备上登录，IP地址为{ip}。如非本人操作，请立即修改密码。"
            )
        
        # 短信通知
        if user.phone:
            SmsService.send_login_notification(
                user.phone,
                timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                ip,
                device_info
            )
        
        return True
    
    @staticmethod
    def send_password_changed_notification(user):
        """
        发送密码修改通知
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 发送结果
        """
        # 推送通知
        title = "密码已修改"
        body = "您的账号密码已成功修改"
        NotificationService.send_push_notification(user, title, body, {
            'type': 'password_changed'
        })
        
        # 邮件通知
        if user.email:
            EmailService.send_password_changed_notification(user)
        
        return True
    
    @staticmethod
    def send_password_reset_notification(user):
        """
        发送密码重置通知
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 发送结果
        """
        # 推送通知
        title = "密码已重置"
        body = "您的账号密码已成功重置"
        NotificationService.send_push_notification(user, title, body, {
            'type': 'password_reset'
        })
        
        # 邮件通知
        if user.email:
            EmailService.send_password_reset_notification(user)
        
        return True
