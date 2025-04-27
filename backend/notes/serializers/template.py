"""
笔记模板序列化器
"""

from rest_framework import serializers
from notes.models import NoteTemplate


class NoteTemplateSerializer(serializers.ModelSerializer):
    """
    笔记模板序列化器
    """
    created_by_username = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteTemplate
        fields = [
            'id', 'title', 'content', 'description', 'template_type',
            'category', 'tags', 'thumbnail', 'thumbnail_url', 'created_by',
            'created_by_username', 'created_at', 'updated_at',
            'is_public', 'use_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'use_count']
    
    def get_created_by_username(self, obj):
        """
        获取创建者用户名
        """
        return obj.created_by.username
    
    def get_thumbnail_url(self, obj):
        """
        获取缩略图URL
        """
        if obj.thumbnail:
            return obj.thumbnail.url
        return None
