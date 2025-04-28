"""
认证相关序列化器
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from django.utils.translation import gettext_lazy as _
from users.models import VerificationCode

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

            # 在开发环境中，跳过验证码验证
            from django.conf import settings
            if not settings.DEBUG:
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
            raise serializers.ValidationError('用户名或密码错误')

        if not user.is_active:
            raise serializers.ValidationError('该账号已被禁用')

        data['user'] = user
        return data

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
