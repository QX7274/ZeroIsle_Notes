"""
认证相关序列化器
"""

import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from django.utils.translation import gettext_lazy as _
from users.models import VerificationCode, LoginAttempt, UserDevice
from users.services.password_validator import validate_password
from common.utils import get_client_ip

logger = logging.getLogger(__name__)

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    用户注册序列化器
    """
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    verification_code = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'phone', 'password', 'confirm_password',
            'verification_code'
        ]

    def validate(self, data):
        """验证密码是否匹配和验证码"""
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': '两次输入的密码不匹配'})

        # 验证密码强度
        username = data.get('username', '')
        is_valid, password_errors = validate_password(data['password'], username=username)
        if not is_valid:
            raise serializers.ValidationError({'password': password_errors})

        # 验证验证码
        if 'verification_code' in data:
            code = data.pop('verification_code')
            email = data.get('email')
            phone = data.get('phone')

            if not VerificationCode.verify(code, phone=phone, email=email, purpose='register'):
                raise serializers.ValidationError({'verification_code': '验证码无效或已过期'})

        return data

    def create(self, validated_data):
        """创建用户"""
        # 提取必要字段
        username = validated_data.get('username')
        email = validated_data.get('email', '')
        phone = validated_data.get('phone', '')
        password = validated_data.get('password')

        # 确保至少有邮箱或手机号
        if not email and not phone:
            raise serializers.ValidationError('必须提供邮箱或手机号')

        # 创建用户
        user = User.objects.create_user(
            username=username,
            password=password
        )

        # 设置邮箱和手机号
        if email:
            user.email = email
        if phone:
            user.phone = phone

        user.save()

        return user

class UserLoginSerializer(serializers.Serializer):
    """
    用户登录序列化器
    支持邮箱、用户名或手机号登录
    """
    # 统一的标识符字段，可以是用户名、邮箱或手机号
    identifier = serializers.CharField(required=False)
    # 兼容旧版API
    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    # 密码或验证码
    password = serializers.CharField(style={'input_type': 'password'}, required=False)
    verification_code = serializers.CharField(required=False)

    def validate(self, data):
        """验证登录凭据"""
        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError('Serializer requires request in context.')

        ip_address = get_client_ip(request)

        # 检查登录尝试次数
        try:
            attempts = LoginAttempt.objects.filter(
                ip_address=ip_address,
                timestamp__gte=timezone.now() - timedelta(minutes=15)
            ).count()
            if attempts >= 5:
                raise serializers.ValidationError('登录尝试次数过多，请15分钟后再试')
        except Exception as e:
            logger.error(f"检查登录尝试次数失败: {str(e)}")
            # In case of error, we allow the attempt but log it.

        # 处理统一标识符
        identifier = data.get('identifier')
        if identifier:
            # 判断标识符类型
            if '@' in identifier:
                data['email'] = identifier
            elif identifier.isdigit() and len(identifier) >= 11:
                data['phone'] = identifier
            else:
                data['username'] = identifier

        # 至少提供一种登录方式
        if not any(key in data for key in ['username', 'email', 'phone']):
            raise serializers.ValidationError('请提供用户名、邮箱或手机号')

        # 使用验证码登录
        if 'verification_code' in data and data.get('verification_code'):
            code = data['verification_code']
            email = data.get('email')
            phone = data.get('phone')

            if not phone:
                raise serializers.ValidationError('使用验证码登录时必须提供手机号')

            if not VerificationCode.verify(code, phone=phone, email=email, purpose='login'):
                raise serializers.ValidationError({'verification_code': '验证码无效或已过期'})

            # 查找用户
            try:
                if phone:
                    user = User.objects.get(phone=phone)
                elif email:
                    user = User.objects.get(email=email)
                else:
                    raise serializers.ValidationError('使用验证码登录时必须提供手机号或邮箱')

                if not user.is_active:
                    raise serializers.ValidationError('该账号已被禁用')

                data['user'] = user
                return data
            except User.DoesNotExist:
                raise serializers.ValidationError('用户不存在')

        # 使用密码登录
        if 'password' not in data or not data.get('password'):
            raise serializers.ValidationError('请提供密码或验证码')

        # 尝试不同的登录方式
        username = data.get('username')
        email = data.get('email')
        phone = data.get('phone')
        password = data.get('password')

        # 先尝试直接使用Django的authenticate
        if username:
            user = authenticate(username=username, password=password)
        elif email:
            # 尝试使用邮箱查找用户
            try:
                user_obj = User.objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        elif phone:
            # 尝试使用手机号查找用户
            try:
                user_obj = User.objects.get(phone=phone)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        else:
            user = None

        if not user:
            self._record_login_attempt(ip_address, False)
            raise serializers.ValidationError('用户名或密码错误')

        if not user.is_active:
            self._record_login_attempt(ip_address, False)
            raise serializers.ValidationError('该账号已被禁用')

        # 更新用户登录信息
        user.last_login = timezone.now()
        user.last_login_ip = ip_address
        user.save(update_fields=['last_login', 'last_login_ip'])

        # 记录设备信息
        self._record_device(request, user)

        # 记录成功登录
        self._record_login_attempt(ip_address, True)

        data['user'] = user
        return data

    def _record_login_attempt(self, ip_address, success):
        """记录登录尝试"""
        try:
            LoginAttempt.objects.create(
                ip_address=ip_address,
                success=success,
                timestamp=timezone.now()
            )
        except Exception as e:
            logger.error(f"记录登录尝试失败: {str(e)}")

    def _record_device(self, request, user):
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

class PasswordChangeSerializer(serializers.Serializer):
    """
    密码修改序列化器
    """
    old_password = serializers.CharField(style={'input_type': 'password'})
    new_password = serializers.CharField(style={'input_type': 'password'})
    confirm_password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, data):
        """验证旧密码和新密码"""
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': '两次输入的新密码不匹配'})

        user = self.context['request'].user
        if not user.check_password(data['old_password']):
            raise serializers.ValidationError({'old_password': '旧密码不正确'})

        # 验证新密码强度
        is_valid, password_errors = validate_password(data['new_password'], username=user.username)
        if not is_valid:
            raise serializers.ValidationError({'new_password': password_errors})

        return data

    def save(self):
        """保存新密码"""
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user

class PasswordResetSerializer(serializers.Serializer):
    """
    密码重置序列化器
    """
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    verification_code = serializers.CharField()
    new_password = serializers.CharField(style={'input_type': 'password'})
    confirm_password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, data):
        """验证验证码和新密码"""
        if not data.get('email') and not data.get('phone'):
            raise serializers.ValidationError('请提供邮箱或手机号')

        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': '两次输入的新密码不匹配'})

        # 验证验证码
        code = data['verification_code']
        email = data.get('email')
        phone = data.get('phone')

        if not VerificationCode.verify(code, phone=phone, email=email, purpose='reset_password'):
            raise serializers.ValidationError({'verification_code': '验证码无效或已过期'})

        # 查找用户
        try:
            if email:
                user = User.objects.get(email=email)
            else:
                user = User.objects.get(phone=phone)

            data['user'] = user
            return data
        except User.DoesNotExist:
            raise serializers.ValidationError('用户不存在')

    def save(self):
        """保存新密码"""
        user = self.validated_data['user']
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user

class VerificationCodeSerializer(serializers.Serializer):
    """
    验证码序列化器
    """
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    purpose = serializers.ChoiceField(
        choices=VerificationCode.PURPOSE_CHOICES,
        default='login'
    )

    def validate(self, data):
        """验证邮箱或手机号"""
        if not data.get('email') and not data.get('phone'):
            raise serializers.ValidationError('请提供邮箱或手机号')
        return data
