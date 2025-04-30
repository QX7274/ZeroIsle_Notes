"""
用户序列化器
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from users.models import UserProfile, UserSettings

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """
    用户基础序列化器
    用于列表展示和基本信息
    """
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'nickname', 'avatar', 'is_active', 'date_joined'
        ]
        read_only_fields = ['id', 'date_joined']

class UserDetailSerializer(serializers.ModelSerializer):
    """
    用户详情序列化器
    包含用户的详细信息
    """
    profile = serializers.SerializerMethodField()
    settings = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone', 'first_name', 'last_name',
            'nickname', 'avatar', 'wechat_avatar', 'qq_avatar', 'bio',
            'is_active', 'is_verified', 'date_joined', 'last_login',
            'profile', 'settings'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_profile(self, obj):
        """获取用户资料"""
        from .profile import UserProfileSerializer
        try:
            return UserProfileSerializer(obj.profile).data
        except UserProfile.DoesNotExist:
            return None

    def get_settings(self, obj):
        """获取用户设置"""
        from .settings import UserSettingsSerializer
        try:
            return UserSettingsSerializer(obj.settings).data
        except UserSettings.DoesNotExist:
            return None

class UserCreateSerializer(serializers.ModelSerializer):
    """
    用户创建序列化器
    用于用户注册
    """
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = [
            'username', 'email', 'phone', 'password', 'confirm_password',
            'first_name', 'last_name'
        ]

    def validate(self, data):
        """验证密码是否匹配"""
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': '两次输入的密码不匹配'})
        return data

    def create(self, validated_data):
        """创建用户"""
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )

        # 设置其他字段
        if 'phone' in validated_data:
            user.phone = validated_data['phone']
        if 'first_name' in validated_data:
            user.first_name = validated_data['first_name']
        if 'last_name' in validated_data:
            user.last_name = validated_data['last_name']

        user.save()

        # 创建用户资料
        UserProfile.objects.create(user=user)

        # 创建用户设置
        UserSettings.objects.create(user=user)

        return user

class UserUpdateSerializer(serializers.ModelSerializer):
    """
    用户更新序列化器
    用于更新用户信息
    """
    class Meta:
        model = User
        fields = [
            'username', 'email', 'phone', 'first_name', 'last_name',
            'nickname', 'avatar', 'bio'
        ]

    def validate_email(self, value):
        """验证邮箱是否已存在"""
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError('该邮箱已被使用')
        return value

    def validate_phone(self, value):
        """验证手机号是否已存在"""
        if not value:
            return value

        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(phone=value).exists():
            raise serializers.ValidationError('该手机号已被使用')
        return value

    def validate_username(self, value):
        """验证用户名是否已存在"""
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError('该用户名已被使用')
        return value
