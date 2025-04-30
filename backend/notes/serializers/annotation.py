"""
注释序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import Annotation, Note
from users.serializers import UserSerializer

class AnnotationSerializer(serializers.Serializer):
    """
    注释序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note = serializers.PrimaryKeyRelatedField(queryset=Note.objects.all())
    user = UserSerializer(read_only=True)
    page = serializers.IntegerField(required=True)
    type = serializers.ChoiceField(choices=('text', 'drawing', 'highlight', 'shape'), required=True)
    content = serializers.CharField(required=False, allow_blank=True)
    position = serializers.DictField(required=False)
    path_data = serializers.DictField(required=False)
    color = serializers.CharField(required=False, allow_blank=True)
    stroke_width = serializers.IntegerField(required=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    def create(self, validated_data):
        """
        创建注释
        """
        user = self.context['request'].user
        validated_data['user'] = user
        annotation = Annotation(**validated_data)
        annotation.save()
        return annotation
    
    def update(self, instance, validated_data):
        """
        更新注释
        """
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class AnnotationListSerializer(serializers.Serializer):
    """
    注释列表序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note_id = serializers.UUIDField(source='note.id', read_only=True)
    page = serializers.IntegerField(read_only=True)
    type = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
