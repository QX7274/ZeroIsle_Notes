"""
笔记分享序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import NoteShare
from django.utils import timezone
import uuid


class NoteShareSerializer(serializers.Serializer):
    """
    笔记分享序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note = serializers.UUIDField(source='note.id')
    note_title = serializers.CharField(source='note.title', read_only=True)
    share_type = serializers.ChoiceField(choices=['link', 'email', 'user'])
    share_code = serializers.CharField(max_length=20, read_only=True)
    share_to = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(max_length=100, required=False, allow_blank=True, write_only=True)
    is_password_protected = serializers.BooleanField(default=False)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    created_by_username = serializers.CharField(source='user.username', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_active = serializers.BooleanField(default=True)
    view_count = serializers.IntegerField(read_only=True)

    # 计算字段
    share_url = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    def get_share_url(self, obj):
        """
        获取分享链接
        """
        if obj.share_type == 'link' and obj.share_code:
            return f"/share/{obj.share_code}"
        return None

    def get_is_expired(self, obj):
        """
        判断分享是否过期
        """
        if not obj.expires_at:
            return False
        return timezone.now() > obj.expires_at


class NoteShareCreateSerializer(serializers.Serializer):
    """
    创建笔记分享的序列化器
    """
    note = serializers.UUIDField(required=True)
    share_type = serializers.ChoiceField(choices=['link', 'email', 'user'], default='link')
    share_to = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(max_length=100, required=False, allow_blank=True, write_only=True)
    is_password_protected = serializers.BooleanField(default=False)
    expires_days = serializers.IntegerField(required=False, write_only=True)

    def create(self, validated_data):
        """
        创建笔记分享
        """
        from notes.mongodb_models import Note

        expires_days = validated_data.pop('expires_days', None)
        note_id = validated_data.pop('note')

        # 获取笔记
        try:
            note = Note.objects.get(id=note_id)
        except Note.DoesNotExist:
            raise serializers.ValidationError("笔记不存在")

        # 设置过期时间
        expires_at = None
        if expires_days:
            expires_at = timezone.now() + timezone.timedelta(days=expires_days)

        # 生成分享码
        import random
        import string
        share_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))

        # 创建分享
        share = NoteShare(
            id=uuid.uuid4(),
            note=note,
            user=self.context['request'].user,
            share_type=validated_data.get('share_type', 'link'),
            share_to=validated_data.get('share_to', ''),
            share_code=share_code,
            is_password_protected=validated_data.get('is_password_protected', False),
            password=validated_data.get('password', ''),
            expires_at=expires_at,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        share.save()

        return share
