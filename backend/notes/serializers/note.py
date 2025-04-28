"""
笔记序列化器
"""

from rest_framework import serializers
from django.utils import timezone
import uuid
from notes.mongodb_models import Note, Category, Tag
from users.serializers import UserSerializer

class NoteSerializer(serializers.Serializer):
    """笔记基础序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255, required=True)
    content = serializers.CharField(required=True)
    category = serializers.UUIDField(source='category.id', allow_null=True)
    tags = serializers.ListField(child=serializers.UUIDField(), required=False)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    is_encrypted = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

class NoteListSerializer(serializers.Serializer):
    """笔记列表序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    category = serializers.UUIDField(source='category.id', allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(), read_only=True)
    word_count = serializers.IntegerField(read_only=True)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

class NoteDetailSerializer(serializers.Serializer):
    """笔记详情序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    category = serializers.UUIDField(source='category.id', allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(), read_only=True)
    user = UserSerializer(read_only=True)
    word_count = serializers.IntegerField(read_only=True)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    is_encrypted = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    last_viewed_at = serializers.DateTimeField(read_only=True, allow_null=True)

class NoteCreateUpdateSerializer(serializers.Serializer):
    """笔记创建和更新序列化器"""
    title = serializers.CharField(max_length=255, required=True)
    content = serializers.CharField(required=True)
    category = serializers.UUIDField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.UUIDField(), required=False)
    is_favorite = serializers.BooleanField(default=False, required=False)
    is_public = serializers.BooleanField(default=False, required=False)
    is_encrypted = serializers.BooleanField(default=False, required=False)
    encryption_key = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    def validate_category(self, value):
        """验证分类是否属于当前用户"""
        if value:
            try:
                category = Category.objects.get(id=value)
                if category.user.id != self.context['request'].user.id:
                    raise serializers.ValidationError("您不能使用其他用户的分类")
            except Category.DoesNotExist:
                raise serializers.ValidationError("分类不存在")
        return value

    def validate_tags(self, value):
        """验证标签是否属于当前用户"""
        user = self.context['request'].user
        valid_tags = []
        for tag_id in value:
            try:
                tag = Tag.objects.get(id=tag_id)
                if tag.user.id != user.id:
                    raise serializers.ValidationError(f"您不能使用其他用户的标签: {tag.name}")
                valid_tags.append(tag_id)
            except Tag.DoesNotExist:
                raise serializers.ValidationError(f"标签不存在: {tag_id}")
        return valid_tags

    def create(self, validated_data):
        tags_data = validated_data.pop('tags', [])
        category_id = validated_data.pop('category', None)

        # 创建笔记
        note = Note(
            id=uuid.uuid4(),
            user=self.context['request'].user,
            **validated_data,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 设置分类
        if category_id:
            try:
                category = Category.objects.get(id=category_id)
                note.category = category
            except Category.DoesNotExist:
                pass

        # 保存笔记
        note.save()

        # 设置标签
        if tags_data:
            tags = []
            for tag_id in tags_data:
                try:
                    tag = Tag.objects.get(id=tag_id)
                    tags.append(tag)
                except Tag.DoesNotExist:
                    continue
            note.tags = tags
            note.save()

        return note

    def update(self, instance, validated_data):
        tags_data = validated_data.pop('tags', None)
        category_id = validated_data.pop('category', None)

        # 更新笔记字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 更新分类
        if category_id is not None:
            try:
                category = Category.objects.get(id=category_id)
                instance.category = category
            except Category.DoesNotExist:
                instance.category = None

        # 更新标签
        if tags_data is not None:
            tags = []
            for tag_id in tags_data:
                try:
                    tag = Tag.objects.get(id=tag_id)
                    tags.append(tag)
                except Tag.DoesNotExist:
                    continue
            instance.tags = tags

        # 更新时间并保存
        instance.updated_at = timezone.now()
        instance.save()
        return instance
