"""
邮件服务
"""

import logging
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags

logger = logging.getLogger('backend')

class EmailService:
    """
    邮件服务类
    处理所有邮件发送相关功能
    """
    
    @staticmethod
    def send_email(to_email, subject, html_content, from_email=None):
        """
        发送邮件
        
        Args:
            to_email: 收件人邮箱，可以是字符串或列表
            subject: 邮件主题
            html_content: HTML格式的邮件内容
            from_email: 发件人邮箱，默认使用设置中的默认发件人
            
        Returns:
            bool: 发送结果
        """
        if not from_email:
            from_email = settings.DEFAULT_FROM_EMAIL
            
        # 转换为纯文本内容
        plain_content = strip_tags(html_content)
        
        try:
            send_mail(
                subject=subject,
                message=plain_content,
                from_email=from_email,
                recipient_list=[to_email] if isinstance(to_email, str) else to_email,
                html_message=html_content,
                fail_silently=False
            )
            logger.info(f"邮件已发送至 {to_email}")
            return True
        except Exception as e:
            logger.error(f"邮件发送失败: {e}")
            return False
    
    @staticmethod
    def send_verification_code(to_email, code, purpose):
        """
        发送验证码邮件
        
        Args:
            to_email: 收件人邮箱
            code: 验证码
            purpose: 用途
            
        Returns:
            bool: 发送结果
        """
        purpose_map = {
            'register': '注册',
            'login': '登录',
            'reset_password': '重置密码',
            'change_email': '变更邮箱',
        }
        
        purpose_text = purpose_map.get(purpose, purpose)
        subject = f'零屿笔记 - {purpose_text}验证码'
        
        html_content = render_to_string('emails/verification_code.html', {
            'code': code,
            'purpose': purpose_text,
            'expire_minutes': 15
        })
        
        return EmailService.send_email(to_email, subject, html_content)
    
    @staticmethod
    def send_welcome_email(user):
        """
        发送欢迎邮件
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 发送结果
        """
        subject = '欢迎加入零屿笔记'
        
        html_content = render_to_string('emails/welcome.html', {
            'user': user,
        })
        
        return EmailService.send_email(user.email, subject, html_content)
    
    @staticmethod
    def send_password_changed_notification(user):
        """
        发送密码修改通知
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 发送结果
        """
        subject = '零屿笔记 - 密码已修改'
        
        html_content = render_to_string('emails/password_changed.html', {
            'user': user,
        })
        
        return EmailService.send_email(user.email, subject, html_content)
    
    @staticmethod
    def send_password_reset_notification(user):
        """
        发送密码重置通知
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 发送结果
        """
        subject = '零屿笔记 - 密码已重置'
        
        html_content = render_to_string('emails/password_reset.html', {
            'user': user,
        })
        
        return EmailService.send_email(user.email, subject, html_content)
