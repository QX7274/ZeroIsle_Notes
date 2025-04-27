from rest_framework import serializers
from users.models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['id', 'nickname', 'avatar', 'bio', 'created_at']
        read_only_fields = ['id', 'created_at']