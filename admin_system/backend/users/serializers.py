from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import UserProfile, UserActivity

class UserProfileSerializer(serializers.ModelSerializer):
    """用户资料序列化器"""
    full_name = serializers.SerializerMethodField()
    is_banned = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = '__all__'
        read_only_fields = ['id', 'date_joined', 'last_login', 'note_count', 'canvas_count', 'login_count']

    def get_full_name(self, obj):
        return obj.full_name

    def get_is_banned(self, obj):
        return obj.is_banned

class UserProfileListSerializer(serializers.ModelSerializer):
    """用户资料列表序列化器"""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'email', 'phone', 'nickname', 'full_name', 'avatar',
                 'status', 'is_active', 'is_staff', 'date_joined', 'last_login', 'note_count']

    def get_full_name(self, obj):
        return obj.full_name

class UserProfileCreateSerializer(serializers.ModelSerializer):
    """创建用户资料序列化器"""
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = UserProfile
        fields = ['username', 'email', 'phone', 'nickname', 'password', 'confirm_password',
                 'avatar', 'bio', 'status', 'is_active']

    def validate(self, data):
        """验证密码是否匹配"""
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "两次输入的密码不一致"})
        return data

    def create(self, validated_data):
        """创建用户资料"""
        # 移除确认密码字段
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')

        # 创建用户资料
        user = UserProfile(**validated_data)
        # 这里应该调用主软件的密码加密逻辑
        # 暂时只是保存用户文档
        user.save()

        # 记录用户创建活动
        UserActivity(
            user=user,
            activity_type='user_created',
            description=f'管理员创建了用户 {user.username}',
            ip_address=self.context.get('request').META.get('REMOTE_ADDR', ''),
            user_agent=self.context.get('request').META.get('HTTP_USER_AGENT', '')
        ).save()

        return user

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """更新用户资料序列化器"""
    class Meta:
        model = UserProfile
        fields = ['email', 'phone', 'nickname', 'avatar', 'bio', 'status', 'is_active', 'preferences']
        read_only_fields = ['username']

    def update(self, instance, validated_data):
        """更新用户资料"""
        # 记录原始状态
        old_status = instance.status
        old_is_active = instance.is_active

        # 更新实例
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        # 记录状态变更活动
        if 'status' in validated_data and old_status != instance.status:
            UserActivity(
                user=instance,
                activity_type='status_changed',
                description=f'用户状态从 {old_status} 变更为 {instance.status}',
                ip_address=self.context.get('request').META.get('REMOTE_ADDR', ''),
                user_agent=self.context.get('request').META.get('HTTP_USER_AGENT', '')
            ).save()

        if 'is_active' in validated_data and old_is_active != instance.is_active:
            activity_type = 'user_activated' if instance.is_active else 'user_deactivated'
            UserActivity(
                user=instance,
                activity_type=activity_type,
                description=f'用户{"激活" if instance.is_active else "禁用"}状态变更',
                ip_address=self.context.get('request').META.get('REMOTE_ADDR', ''),
                user_agent=self.context.get('request').META.get('HTTP_USER_AGENT', '')
            ).save()

        return instance

class UserActivitySerializer(serializers.ModelSerializer):
    """用户活动序列化器"""
    username = serializers.SerializerMethodField()

    class Meta:
        model = UserActivity
        fields = '__all__'

    def get_username(self, obj):
        return obj.user.username if obj.user else 'Unknown'

class UserStatsSerializer(serializers.Serializer):
    """用户统计序列化器"""
    total_users = serializers.IntegerField()
    active_users = serializers.IntegerField()
    inactive_users = serializers.IntegerField()
    banned_users = serializers.IntegerField()
    new_users_today = serializers.IntegerField()
    new_users_this_week = serializers.IntegerField()
    new_users_this_month = serializers.IntegerField()
    login_users_today = serializers.IntegerField()
