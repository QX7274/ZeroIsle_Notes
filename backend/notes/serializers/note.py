"""
笔记序列化器
"""

from rest_framework import serializers
from notes.models import Note, Category, Tag
from users.serializers import UserSerializer

class NoteSerializer(serializers.ModelSerializer):
    """笔记基础序列化器"""
    class Meta:
        model = Note
        fields = [
            'id', 'title', 'content', 'category', 'tags', 
            'is_favorite', 'is_public', 'is_encrypted',
            'view_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'view_count']

class NoteListSerializer(serializers.ModelSerializer):
    """笔记列表序列化器"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    tags = serializers.StringRelatedField(many=True, read_only=True)
    word_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Note
        fields = [
            'id', 'title', 'category', 'category_name', 'tags',
            'is_favorite', 'is_public', 'word_count',
            'view_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'view_count']

class NoteDetailSerializer(serializers.ModelSerializer):
    """笔记详情序列化器"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    tags = serializers.StringRelatedField(many=True, read_only=True)
    user = UserSerializer(read_only=True)
    word_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Note
        fields = [
            'id', 'title', 'content', 'category', 'category_name', 
            'tags', 'is_favorite', 'is_public', 'is_encrypted',
            'view_count', 'word_count', 'user',
            'created_at', 'updated_at', 'last_viewed_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'view_count', 'last_viewed_at']

class NoteCreateUpdateSerializer(serializers.ModelSerializer):
    """笔记创建和更新序列化器"""
    tags = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        many=True,
        required=False
    )
    
    class Meta:
        model = Note
        fields = [
            'title', 'content', 'category', 'tags', 
            'is_favorite', 'is_public', 'is_encrypted',
            'encryption_key'
        ]
    
    def validate_category(self, value):
        """验证分类是否属于当前用户"""
        if value and value.user != self.context['request'].user:
            raise serializers.ValidationError("您不能使用其他用户的分类")
        return value
    
    def validate_tags(self, value):
        """验证标签是否属于当前用户"""
        user = self.context['request'].user
        for tag in value:
            if tag.user != user:
                raise serializers.ValidationError("您不能使用其他用户的标签")
        return value
