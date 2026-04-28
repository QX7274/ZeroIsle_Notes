"""
密码重置服务

提供用户密码重置功能，通过邮箱或手机号发送验证码
"""

import logging
import random
import string
import requests
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from users.models import UserProfile, VerificationCode

logger = logging.getLogger(__name__)

class PasswordService:
    """
    密码重置服务类
    处理用户密码重置相关功能
    """

    @staticmethod
    def generate_verification_code(length=6):
        """
        生成数字验证码

        Args:
            length: 验证码长度，默认6位

        Returns:
            str: 生成的验证码
        """
        return ''.join(random.choices(string.digits, k=length))

    @staticmethod
    def send_reset_code_by_email(user_id, request_source='system'):
        """
        通过邮箱发送重置密码验证码

        Args:
            user_id: 用户ID
            request_source: 请求来源，默认为system

        Returns:
            dict: 包含结果信息的字典
        """
        try:
            # 查找用户
            try:
                user = UserProfile.objects.get(id=user_id)
            except UserProfile.DoesNotExist:
                logger.error(f"用户不存在: {user_id}")
                return {
                    'status': 'error',
                    'message': '用户不存在'
                }

            # 检查用户是否有邮箱
            if not user.email:
                logger.error(f"用户没有绑定邮箱: {user.username}")
                return {
                    'status': 'error',
                    'message': '用户没有绑定邮箱'
                }

            # 生成验证码
            code = PasswordService.generate_verification_code()

            # 创建验证码记录
            verification = VerificationCode(
                user=user,
                email=user.email,
                code=code,
                purpose='reset_password',
                expires_at=timezone.now() + timedelta(minutes=15),
                created_by=f'system_{request_source}'
            )
            verification.save()

            # 调用主应用的邮件服务发送验证码
            try:
                # 构建请求数据
                email_data = {
                    'email': user.email,
                    'code': code,
                    'purpose': 'reset_password'
                }

                # 调用主应用的邮件服务API
                response = requests.post(
                    f"{settings.MAIN_APP_API_URL}/api/users/send-email-verification/",
                    json=email_data,
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {settings.MAIN_APP_API_KEY}'
                    }
                )

                if response.status_code != 200:
                    logger.error(f"调用邮件服务失败: {response.text}")
                    return {
                        'status': 'error',
                        'message': '发送验证码邮件失败，请稍后重试'
                    }
            except Exception as email_error:
                logger.error(f"调用邮件服务出错: {str(email_error)}")
                return {
                    'status': 'error',
                    'message': '发送验证码邮件失败，请稍后重试'
                }

            logger.info(f"系统为用户 {user.username} 发送了密码重置验证码到邮箱")

            return {
                'status': 'success',
                'message': '验证码已发送到邮箱',
                'email': user.email,
                'expires_at': verification.expires_at
            }

        except Exception as e:
            logger.error(f"发送邮箱验证码失败: {str(e)}")
            return {
                'status': 'error',
                'message': f'发送邮箱验证码失败: {str(e)}'
            }

    @staticmethod
    def send_reset_code_by_phone(user_id, request_source='system'):
        """
        通过手机发送重置密码验证码

        Args:
            user_id: 用户ID
            request_source: 请求来源，默认为system

        Returns:
            dict: 包含结果信息的字典
        """
        try:
            # 查找用户
            try:
                user = UserProfile.objects.get(id=user_id)
            except UserProfile.DoesNotExist:
                logger.error(f"用户不存在: {user_id}")
                return {
                    'status': 'error',
                    'message': '用户不存在'
                }

            # 检查用户是否有手机号
            if not user.phone:
                logger.error(f"用户没有绑定手机号: {user.username}")
                return {
                    'status': 'error',
                    'message': '用户没有绑定手机号'
                }

            # 生成验证码
            code = PasswordService.generate_verification_code()

            # 创建验证码记录
            verification = VerificationCode(
                user=user,
                phone=user.phone,
                code=code,
                purpose='reset_password',
                expires_at=timezone.now() + timedelta(minutes=15),
                created_by=f'system_{request_source}'
            )
            verification.save()

            # 调用主应用的短信服务发送验证码
            try:
                # 构建请求数据
                sms_data = {
                    'phone': user.phone,
                    'code': code,
                    'purpose': 'reset_password'
                }

                # 调用主应用的短信服务API
                response = requests.post(
                    f"{settings.MAIN_APP_API_URL}/api/users/send-sms-verification/",
                    json=sms_data,
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {settings.MAIN_APP_API_KEY}'
                    }
                )

                if response.status_code != 200:
                    logger.error(f"调用短信服务失败: {response.text}")
                    return {
                        'status': 'error',
                        'message': '发送验证码短信失败，请稍后重试'
                    }
            except Exception as sms_error:
                logger.error(f"调用短信服务出错: {str(sms_error)}")
                return {
                    'status': 'error',
                    'message': '发送验证码短信失败，请稍后重试'
                }

            logger.info(f"系统为用户 {user.username} 发送了密码重置验证码到手机")

            return {
                'status': 'success',
                'message': '验证码已发送到手机',
                'phone': user.phone,
                'expires_at': verification.expires_at
            }

        except Exception as e:
            logger.error(f"发送手机验证码失败: {str(e)}")
            return {
                'status': 'error',
                'message': f'发送手机验证码失败: {str(e)}'
            }

    @staticmethod
    def verify_reset_code(user_id, code, reset_type):
        """
        验证重置密码验证码

        Args:
            user_id: 用户ID
            code: 验证码
            reset_type: 重置类型（email或phone）

        Returns:
            dict: 包含验证结果的字典
        """
        try:
            # 查找用户
            try:
                user = UserProfile.objects.get(id=user_id)
            except UserProfile.DoesNotExist:
                logger.error(f"用户不存在: {user_id}")
                return {
                    'status': 'error',
                    'message': '用户不存在'
                }

            # 构建查询条件
            query = {
                'user': user,
                'code': code,
                'purpose': 'reset_password',
                'is_used': False,
                'expires_at__gt': timezone.now()
            }

            # 根据重置类型添加条件
            if reset_type == 'email':
                query['email'] = user.email
            elif reset_type == 'phone':
                query['phone'] = user.phone
            else:
                return {
                    'status': 'error',
                    'message': '无效的重置类型'
                }

            # 查找验证码
            try:
                verification = VerificationCode.objects.get(**query)
            except VerificationCode.DoesNotExist:
                logger.error(f"验证码无效或已过期: {code}")
                return {
                    'status': 'error',
                    'message': '验证码无效或已过期'
                }

            # 验证成功
            return {
                'status': 'success',
                'message': '验证码验证成功',
                'verification_id': str(verification.id)
            }

        except Exception as e:
            logger.error(f"验证重置码失败: {str(e)}")
            return {
                'status': 'error',
                'message': f'验证重置码失败: {str(e)}'
            }

    @staticmethod
    def reset_password(user_id, verification_id, new_password, request_source='system'):
        """
        重置用户密码

        Args:
            user_id: 用户ID
            verification_id: 验证码ID
            new_password: 新密码
            request_source: 请求来源，默认为system

        Returns:
            dict: 包含重置结果的字典
        """
        try:
            # 查找用户
            try:
                user = UserProfile.objects.get(id=user_id)
            except UserProfile.DoesNotExist:
                logger.error(f"用户不存在: {user_id}")
                return {
                    'status': 'error',
                    'message': '用户不存在'
                }

            # 查找验证码
            try:
                verification = VerificationCode.objects.get(
                    id=verification_id,
                    user=user,
                    purpose='reset_password',
                    is_used=False,
                    expires_at__gt=timezone.now()
                )
            except VerificationCode.DoesNotExist:
                logger.error(f"验证码无效或已过期: {verification_id}")
                return {
                    'status': 'error',
                    'message': '验证码无效或已过期'
                }

            # 标记验证码为已使用
            verification.is_used = True
            verification.save()

            # 调用主应用的密码更新API
            try:
                # 构建请求数据
                password_data = {
                    'user_id': str(user.id),
                    'new_password': new_password
                }

                # 调用主应用的密码更新API
                response = requests.post(
                    f"{settings.MAIN_APP_API_URL}/api/users/reset-password/",
                    json=password_data,
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {settings.MAIN_APP_API_KEY}'
                    }
                )

                if response.status_code != 200:
                    logger.error(f"调用密码更新API失败: {response.text}")
                    return {
                        'status': 'error',
                        'message': '重置密码失败，请稍后重试'
                    }
            except Exception as api_error:
                logger.error(f"调用密码更新API出错: {str(api_error)}")
                return {
                    'status': 'error',
                    'message': '重置密码失败，请稍后重试'
                }

            # 更新用户密码重置记录
            user.password_reset_at = timezone.now()
            user.password_reset_by = f'system_{request_source}'
            user.save()

            # 记录密码重置日志
            logger.info(f"用户 {user.username} 的密码已重置")

            return {
                'status': 'success',
                'message': '密码重置成功'
            }

        except Exception as e:
            logger.error(f"重置密码失败: {str(e)}")
            return {
                'status': 'error',
                'message': f'重置密码失败: {str(e)}'
            }
