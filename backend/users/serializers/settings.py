from rest_framework import serializers
from users.models import UserSettings

class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = ['id', 'theme', 'notifications_enabled', 'created_at']
        read_only_fields = ['id', 'created_at']