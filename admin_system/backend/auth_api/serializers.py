from rest_framework import serializers
from common.serializers import MongoDocumentSerializer
from .models import AdminLoginLog


class UserSerializer(MongoDocumentSerializer):
    """当前登录管理员的序列化器。

    说明（方案 B）：原先绑定 Django ORM 的 django.contrib.auth.models.User，
    而管理后台的数据库引擎是 dummy，该模型根本不可用。
    现在登录返回的是 MongoDB users 集合里的 mongoengine 用户文档，
    因此改用 MongoDocumentSerializer（与其余 6 个 app 的序列化器口径一致）。

    字段沿用原列表；mongoengine 文档没有 first_name/last_name（主后端用
    nickname），这里映射为 nickname 与空字符串，保持前端字段不缺失。
    """

    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()

    class Meta:
        # 直接绑定 mongoengine 用户模型：实测导入 users.models 不会额外触发
        # MongoDB 连接（settings 阶段已连过一次），因此无需延迟解析。
        from users.models import UserProfile as _UserProfile

        model = _UserProfile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_staff', 'date_joined', 'last_login',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_first_name(self, obj):
        return ''

    def get_last_name(self, obj):
        return ''

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
