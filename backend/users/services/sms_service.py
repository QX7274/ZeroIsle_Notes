"""
短信服务
"""

import logging
import requests
from django.conf import settings

logger = logging.getLogger('backend')

class SmsService:
    """
    短信服务类
    处理所有短信发送相关功能
    """
    
    @staticmethod
    def send_sms(phone, content):
        """
        发送短信
        
        Args:
            phone: 手机号
            content: 短信内容
            
        Returns:
            bool: 发送结果
        """
        # 这里使用示例短信服务API，实际使用时需要替换为真实的短信服务
        api_key = settings.SMS_API_KEY
        api_secret = settings.SMS_API_SECRET
        
        if not api_key or not api_secret:
            logger.warning("短信服务API密钥未配置")
            return False
        
        try:
            # 示例请求，实际使用时需要替换为真实的短信服务API
            response = requests.post(
                'https://api.example.com/sms/send',
                json={
                    'api_key': api_key,
                    'api_secret': api_secret,
                    'phone': phone,
                    'content': content
                }
            )
            
            if response.status_code == 200:
                logger.info(f"短信已发送至 {phone}")
                return True
            else:
                logger.error(f"短信发送失败: {response.text}")
                return False
        except Exception as e:
            logger.error(f"短信发送失败: {e}")
            return False
    
    @staticmethod
    def send_verification_code(phone, code, purpose):
        """
        发送验证码短信
        
        Args:
            phone: 手机号
            code: 验证码
            purpose: 用途
            
        Returns:
            bool: 发送结果
        """
        purpose_map = {
            'register': '注册',
            'login': '登录',
            'reset_password': '重置密码',
            'change_phone': '变更手机号',
        }
        
        purpose_text = purpose_map.get(purpose, purpose)
        content = f'【零屿笔记】您的{purpose_text}验证码是：{code}，15分钟内有效，请勿泄露给他人。'
        
        return SmsService.send_sms(phone, content)
    
    @staticmethod
    def send_login_notification(phone, time, ip, device):
        """
        发送登录通知短信
        
        Args:
            phone: 手机号
            time: 登录时间
            ip: 登录IP
            device: 登录设备
            
        Returns:
            bool: 发送结果
        """
        content = f'【零屿笔记】您的账号于{time}在{device}设备上登录，登录IP为{ip}。如非本人操作，请立即修改密码。'
        
        return SmsService.send_sms(phone, content)
