from rest_framework import serializers
from users.models import UserDevice

class UserDeviceSerializer(serializers.ModelSerializer):
    """用户设备信息序列化器
    记录用户登录设备信息，用于安全审计和多设备管理
    """
    class Meta:
        model = UserDevice
        fields = ['id', 'device_type', 'os_version', 'last_login', 'created_at']
        read_only_fields = ['id', 'created_at']