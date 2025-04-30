"""认证服务

提供用户认证相关的服务功能，包括：
1. 用户注册
2. 用户登录
3. 密码重置
4. 第三方登录
"""

import logging
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import VerificationCode, ThirdPartyAccount, UserDevice
from users.services.email_service import EmailService
from users.services.notification_service import NotificationService
from common.utils import get_client_ip

logger = logging.getLogger('backend')
User = get_user_model()

class AuthService:
    """
    认证服务类
    处理所有用户认证相关功能
    """

    @staticmethod
    def register_user(username, password, email=None, phone=None, **extra_fields):
        """
        注册新用户

        Args:
            username: 用户名
            password: 密码
            email: 邮箱（可选）
            phone: 手机号（可选）
            **extra_fields: 其他字段

        Returns:
            User: 创建的用户对象
        """
        try:
            # 检查用户名是否已存在
            if User.objects.filter(username=username).exists():
                raise ValueError('用户名已存在')

            # 检查邮箱是否已存在
            if email and User.objects.filter(email=email).exists():
                raise ValueError('邮箱已注册')

            # 检查手机号是否已存在
            if phone and User.objects.filter(phone=phone).exists():
                raise ValueError('手机号已注册')

            # 创建用户
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                phone=phone,
                **extra_fields
            )

            # 发送欢迎邮件
            if email:
                EmailService.send_welcome_email(user)

            logger.info(f'用户注册成功: {username}')
            return user

        except Exception as e:
            logger.error(f'用户注册失败: {str(e)}')
            raise

    @staticmethod
    def login_user(request, username=None, email=None, phone=None, password=None, code=None):
        """
        用户登录

        Args:
            request: 请求对象
            username: 用户名（可选）
            email: 邮箱（可选）
            phone: 手机号（可选）
            password: 密码（可选）
            code: 验证码（可选）

        Returns:
            dict: 包含用户对象和令牌的字典
        """
        try:
            user = None

            # 使用用户名登录
            if username and password:
                try:
                    user = User.objects.get(username=username)
                    if not user.check_password(password):
                        raise ValueError('密码错误')
                except User.DoesNotExist:
                    raise ValueError('用户不存在')

            # 使用邮箱登录
            elif email and password:
                try:
                    user = User.objects.get(email=email)
                    if not user.check_password(password):
                        raise ValueError('密码错误')
                except User.DoesNotExist:
                    raise ValueError('用户不存在')

            # 使用手机号+验证码登录
            elif phone and code:
                # 验证验证码
                try:
                    verification = VerificationCode.objects.get(
                        phone=phone,
                        purpose='login',
                        is_used=False,
                        expires_at__gt=timezone.now()
                    )

                    if verification.code != code:
                        raise ValueError('验证码错误')

                    # 标记验证码为已使用
                    verification.is_used = True
                    verification.save()

                    # 查找用户
                    try:
                        user = User.objects.get(phone=phone)
                    except User.DoesNotExist:
                        # 如果用户不存在，创建新用户（自动注册）
                        username = f"user_{phone[-4:]}"

                        # 确保用户名唯一
                        base_username = username
                        count = 1
                        while User.objects.filter(username=username).exists():
                            username = f"{base_username}{count}"
                            count += 1

                        # 创建随机密码
                        import random
                        import string
                        password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))

                        user = User.objects.create_user(username=username, phone=phone, password=password)

                except VerificationCode.DoesNotExist:
                    raise ValueError('验证码无效或已过期')

            # 使用手机号+密码登录
            elif phone and password:
                try:
                    user = User.objects.get(phone=phone)
                    if not user.check_password(password):
                        raise ValueError('密码错误')
                except User.DoesNotExist:
                    raise ValueError('用户不存在')

            else:
                raise ValueError('无效的登录方式')

            # 更新最后登录信息
            user.last_login = timezone.now()
            user.last_login_ip = get_client_ip(request)
            user.save(update_fields=['last_login', 'last_login_ip'])

            # 记录设备信息
            AuthService._record_device(request, user)

            # 生成令牌
            refresh = RefreshToken.for_user(user)

            logger.info(f'用户登录成功: {user.username}')

            return {
                'user': user,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }

        except Exception as e:
            logger.error(f'用户登录失败: {str(e)}')
            raise

    @staticmethod
    def reset_password(email=None, phone=None, code=None, new_password=None):
        """
        重置密码

        Args:
            email: 邮箱（可选）
            phone: 手机号（可选）
            code: 验证码
            new_password: 新密码

        Returns:
            User: 用户对象
        """
        try:
            user = None

            # 通过邮箱重置密码
            if email and code:
                # 验证验证码
                try:
                    verification = VerificationCode.objects.get(
                        email=email,
                        purpose='reset_password',
                        is_used=False,
                        expires_at__gt=timezone.now()
                    )

                    if verification.code != code:
                        raise ValueError('验证码错误')

                    # 标记验证码为已使用
                    verification.is_used = True
                    verification.save()

                    # 查找用户
                    try:
                        user = User.objects.get(email=email)
                    except User.DoesNotExist:
                        raise ValueError('用户不存在')

                except VerificationCode.DoesNotExist:
                    raise ValueError('验证码无效或已过期')

            # 通过手机号重置密码
            elif phone and code:
                # 验证验证码
                try:
                    verification = VerificationCode.objects.get(
                        phone=phone,
                        purpose='reset_password',
                        is_used=False,
                        expires_at__gt=timezone.now()
                    )

                    if verification.code != code:
                        raise ValueError('验证码错误')

                    # 标记验证码为已使用
                    verification.is_used = True
                    verification.save()

                    # 查找用户
                    try:
                        user = User.objects.get(phone=phone)
                    except User.DoesNotExist:
                        raise ValueError('用户不存在')

                except VerificationCode.DoesNotExist:
                    raise ValueError('验证码无效或已过期')

            else:
                raise ValueError('无效的重置密码方式')

            # 设置新密码
            user.set_password(new_password)
            user.save()

            # 发送密码重置通知
            NotificationService.send_password_reset_notification(user)

            logger.info(f'用户密码重置成功: {user.username}')

            return user

        except Exception as e:
            logger.error(f'用户密码重置失败: {str(e)}')
            raise

    @staticmethod
    def third_party_login(provider, provider_user_id, user_data, request=None):
        """
        第三方登录

        Args:
            provider: 提供商（如'google', 'facebook', 'wechat'等）
            provider_user_id: 提供商用户ID
            user_data: 用户数据
            request: 请求对象（可选）

        Returns:
            dict: 包含用户对象和令牌的字典
        """
        try:
            # 查找是否已有关联账号
            try:
                third_party_account = ThirdPartyAccount.objects.get(
                    provider=provider,
                    uid=provider_user_id
                )
                user = third_party_account.user

                # 更新第三方账号信息
                third_party_account.access_token = user_data.get('access_token', '')
                third_party_account.refresh_token = user_data.get('refresh_token', '')
                third_party_account.expires_at = user_data.get('expires_at')
                third_party_account.save()

            except ThirdPartyAccount.DoesNotExist:
                # 如果没有关联账号，检查是否有相同邮箱的用户
                email = user_data.get('email')
                if email and User.objects.filter(email=email).exists():
                    user = User.objects.get(email=email)
                else:
                    # 创建新用户
                    username = f"{provider}_{provider_user_id}"

                    # 确保用户名唯一
                    base_username = username
                    count = 1
                    while User.objects.filter(username=username).exists():
                        username = f"{base_username}{count}"
                        count += 1

                    # 创建随机密码
                    import random
                    import string
                    password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))

                    # 获取头像URL
                    avatar_url = user_data.get('avatar')

                    # 创建用户
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password=password,
                        first_name=user_data.get('first_name', ''),
                        last_name=user_data.get('last_name', ''),
                        nickname=user_data.get('nickname', ''),
                        avatar=avatar_url  # 保存第三方平台头像URL
                    )

                # 保存第三方平台头像URL到用户模型
                avatar_url = user_data.get('avatar')
                if avatar_url:
                    if provider == 'wechat':
                        user.wechat_avatar = avatar_url
                    elif provider == 'qq':
                        user.qq_avatar = avatar_url
                    user.save(update_fields=['wechat_avatar' if provider == 'wechat' else 'qq_avatar'])

                # 创建第三方账号关联
                ThirdPartyAccount.objects.create(
                    user=user,
                    provider=provider,
                    uid=provider_user_id,
                    access_token=user_data.get('access_token', ''),
                    refresh_token=user_data.get('refresh_token', ''),
                    expires_at=user_data.get('expires_at'),
                    extra_data=user_data
                )

            # 更新最后登录信息
            user.last_login = timezone.now()
            if request:
                user.last_login_ip = get_client_ip(request)
                user.save(update_fields=['last_login', 'last_login_ip'])
            else:
                user.save(update_fields=['last_login'])

            # 记录设备信息
            if request:
                AuthService._record_device(request, user)

            # 生成令牌
            refresh = RefreshToken.for_user(user)

            logger.info(f'第三方登录成功: {provider} - {user.username}')

            return {
                'user': user,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }

        except Exception as e:
            logger.error(f'第三方登录失败: {str(e)}')
            raise

    @staticmethod
    def _record_device(request, user):
        """记录用户设备信息"""
        device_data = request.data.get('device', {})
        if device_data and 'device_id' in device_data:
            device, created = UserDevice.objects.get_or_create(
                user=user,
                device_id=device_data.get('device_id'),
                defaults={
                    'device_type': device_data.get('device_type', ''),
                    'device_name': device_data.get('device_name', ''),
                    'device_model': device_data.get('device_model', ''),
                    'os_version': device_data.get('os_version', ''),
                    'app_version': device_data.get('app_version', ''),
                    'push_token': device_data.get('push_token', ''),
                    'is_active': True
                }
            )

            if not created:
                # 更新设备信息
                device.device_type = device_data.get('device_type', device.device_type)
                device.device_name = device_data.get('device_name', device.device_name)
                device.device_model = device_data.get('device_model', device.device_model)
                device.os_version = device_data.get('os_version', device.os_version)
                device.app_version = device_data.get('app_version', device.app_version)
                device.push_token = device_data.get('push_token', device.push_token)
                device.is_active = True

            device.last_login_at = timezone.now()
            device.last_login_ip = get_client_ip(request)
            device.save()