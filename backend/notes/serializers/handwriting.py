"""
手写笔记序列化器
"""

from rest_framework import serializers
from notes.models import Handwriting, HandwritingShare


class HandwritingSerializer(serializers.ModelSerializer):
    """
    手写笔记序列化器
    """
    username = serializers.SerializerMethodField()
    note_title = serializers.SerializerMethodField()
    
    class Meta:
        model = Handwriting
        fields = [
            'id', 'user', 'username', 'title', 'image',
            'text', 'note', 'note_title', 'created_at',
            'updated_at', 'is_recognized'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_username(self, obj):
        """
        获取用户名
        """
        return obj.user.username
    
    def get_note_title(self, obj):
        """
        获取笔记标题
        """
        if obj.note:
            return obj.note.title
        return None


class HandwritingShareSerializer(serializers.ModelSerializer):
    """
    手写笔记分享序列化器
    """
    handwriting_title = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = HandwritingShare
        fields = [
            'id', 'handwriting', 'handwriting_title', 'share_code',
            'created_by', 'created_by_username', 'created_at',
            'expires_at', 'is_active', 'view_count', 'is_expired'
        ]
        read_only_fields = ['id', 'share_code', 'created_at', 'view_count']
    
    def get_handwriting_title(self, obj):
        """
        获取手写笔记标题
        """
        return obj.handwriting.title
    
    def get_created_by_username(self, obj):
        """
        获取创建者用户名
        """
        return obj.created_by.username
    
    def get_is_expired(self, obj):
        """
        判断是否已过期
        """
        return obj.is_expired
