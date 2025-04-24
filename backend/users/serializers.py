from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import VerificationCode, ThirdPartyAccount
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'avatar', 'bio', 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('email', 'phone', 'username', 'password', 'password2')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "两次密码不一致"})

        # 确保至少提供了手机号或邮箱
        if not attrs.get('email') and not attrs.get('phone'):
            raise serializers.ValidationError({"non_field_errors": "必须提供手机号或邮箱"})

        # 检查邮箱是否已存在
        if attrs.get('email') and User.objects.filter(email=attrs.get('email')).exists():
            raise serializers.ValidationError({"email": "该邮箱已被注册"})

        # 检查手机号是否已存在
        if attrs.get('phone') and User.objects.filter(phone=attrs.get('phone')).exists():
            raise serializers.ValidationError({"phone": "该手机号已被注册"})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')

        # 生成用户名（如果没有提供）
        if not validated_data.get('username'):
            if validated_data.get('email'):
                validated_data['username'] = validated_data['email'].split('@')[0]
            elif validated_data.get('phone'):
                validated_data['username'] = f"user_{validated_data['phone'][-4:]}"

        user = User.objects.create(
            username=validated_data.get('username'),
            email=validated_data.get('email', ''),
            phone=validated_data.get('phone', '')
        )
        user.set_password(validated_data['password'])
        user.save()
        return user

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        # 确保至少提供了手机号或邮箱
        if not attrs.get('email') and not attrs.get('phone'):
            raise serializers.ValidationError({"non_field_errors": "必须提供手机号或邮箱"})
        return attrs

class VerificationCodeSerializer(serializers.ModelSerializer):
    purpose = serializers.ChoiceField(choices=VerificationCode.PURPOSE_CHOICES, default='login')

    class Meta:
        model = VerificationCode
        fields = ('phone', 'code', 'purpose')

class ThirdPartyAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThirdPartyAccount
        fields = ('provider', 'openid', 'nickname', 'avatar')

class LoginSerializer(serializers.Serializer):
    phone = serializers.CharField()
    password = serializers.CharField(required=False)
    verification_code = serializers.CharField(required=False)

    def validate(self, attrs):
        phone = attrs.get('phone')
        password = attrs.get('password')
        verification_code = attrs.get('verification_code')

        if not password and not verification_code:
            raise serializers.ValidationError('密码或验证码必须提供一项')

        if verification_code:
            try:
                code = VerificationCode.objects.get(
                    phone=phone,
                    code=verification_code,
                    purpose='login',  # 只验证登录用途的验证码
                    is_used=False,
                    expires_at__gt=timezone.now()
                )
                code.is_used = True
                code.save()
            except VerificationCode.DoesNotExist:
                raise serializers.ValidationError('验证码无效或已过期')

        return attrs