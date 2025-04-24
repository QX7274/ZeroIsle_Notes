from rest_framework import serializers
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    """用户资料序列化器"""
    class Meta:
        model = UserProfile
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class UserProfileListSerializer(serializers.ModelSerializer):
    """用户资料列表序列化器"""
    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'email', 'phone', 'nickname', 'status', 'created_at', 'last_login']

class UserProfileCreateSerializer(serializers.ModelSerializer):
    """创建用户资料序列化器"""
    password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = UserProfile
        fields = ['username', 'email', 'phone', 'nickname', 'password', 'confirm_password', 'status']
    
    def validate(self, data):
        """验证密码是否匹配"""
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "两次输入的密码不一致"})
        return data
    
    def create(self, validated_data):
        """创建用户资料"""
        # 移除确认密码字段
        validated_data.pop('confirm_password')
        # 创建用户资料
        return UserProfile.objects.create(**validated_data)

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """更新用户资料序列化器"""
    class Meta:
        model = UserProfile
        fields = ['email', 'phone', 'nickname', 'avatar', 'status']
