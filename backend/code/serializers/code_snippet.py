"""
代码片段序列化器
"""

from rest_framework import serializers
from code.models import CodeSnippet
from users.serializers import UserSerializer

class CodeSnippetSerializer(serializers.ModelSerializer):
    """代码片段序列化器"""
    user = UserSerializer(read_only=True)
    tags_list = serializers.ListField(source='get_tags_list', read_only=True)
    
    class Meta:
        model = CodeSnippet
        fields = [
            'id', 'user', 'title', 'description', 'code',
            'language', 'is_public', 'tags', 'tags_list',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """创建代码片段"""
        tags_list = validated_data.pop('tags_list', None)
        snippet = CodeSnippet.objects.create(**validated_data)
        
        if tags_list:
            snippet.set_tags_list(tags_list)
            snippet.save()
        
        return snippet
    
    def update(self, instance, validated_data):
        """更新代码片段"""
        tags_list = validated_data.pop('tags_list', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if tags_list is not None:
            instance.set_tags_list(tags_list)
        
        instance.save()
        return instance
