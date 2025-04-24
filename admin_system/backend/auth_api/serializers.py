from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AdminLoginLog

class UserSerializer(serializers.ModelSerializer):
    """用户序列化器"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'is_staff', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']

class AdminLoginSerializer(serializers.Serializer):
    """管理员登录序列化器"""
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True)

class AdminLoginLogSerializer(serializers.Serializer):
    """管理员登录日志序列化器"""
    id = serializers.CharField(read_only=True)
    username = serializers.CharField(max_length=150)
    ip_address = serializers.CharField()
    user_agent = serializers.CharField()
    login_time = serializers.DateTimeField(read_only=True)
    status = serializers.BooleanField()
    message = serializers.CharField(required=False, allow_null=True)

    def create(self, validated_data):
        return AdminLoginLog.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class ChangePasswordSerializer(serializers.Serializer):
    """修改密码序列化器"""
    old_password = serializers.CharField(max_length=128, write_only=True)
    new_password = serializers.CharField(max_length=128, write_only=True)
    confirm_password = serializers.CharField(max_length=128, write_only=True)

    def validate(self, data):
        """验证新密码和确认密码是否一致"""
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "两次输入的密码不一致"})
        return data
