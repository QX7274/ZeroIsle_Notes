"""
笔记分享序列化器
"""

from rest_framework import serializers
from notes.models import NoteShare
from django.utils import timezone


class NoteShareSerializer(serializers.ModelSerializer):
    """
    笔记分享序列化器
    """
    note_title = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    share_url = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteShare
        fields = [
            'id', 'note', 'note_title', 'share_type', 'share_code',
            'password', 'shared_with', 'expires_at', 'created_by',
            'created_by_username', 'created_at', 'updated_at',
            'is_active', 'view_count', 'allow_comment',
            'share_url', 'is_expired'
        ]
        read_only_fields = ['id', 'share_code', 'created_at', 'updated_at', 'view_count']
    
    def get_note_title(self, obj):
        """
        获取笔记标题
        """
        return obj.note.title
    
    def get_created_by_username(self, obj):
        """
        获取创建者用户名
        """
        return obj.created_by.username
    
    def get_share_url(self, obj):
        """
        获取分享链接
        """
        return obj.get_share_url()
    
    def get_is_expired(self, obj):
        """
        判断分享是否过期
        """
        return obj.is_expired


class NoteShareCreateSerializer(serializers.ModelSerializer):
    """
    创建笔记分享的序列化器
    """
    expires_days = serializers.IntegerField(required=False, write_only=True)
    
    class Meta:
        model = NoteShare
        fields = [
            'note', 'share_type', 'password', 'shared_with',
            'expires_days', 'allow_comment'
        ]
    
    def create(self, validated_data):
        """
        创建笔记分享
        """
        expires_days = validated_data.pop('expires_days', None)
        
        # 设置过期时间
        if expires_days:
            validated_data['expires_at'] = timezone.now() + timezone.timedelta(days=expires_days)
        
        # 创建分享
        share = NoteShare.objects.create(**validated_data)
        
        return share
