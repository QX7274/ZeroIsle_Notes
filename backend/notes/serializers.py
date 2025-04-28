"""笔记序列化器"""

from rest_framework import serializers
from django.utils import timezone
from .mongodb_models import Note, Category, Tag, NoteShare, NoteReminder, OCRModel, OCRTrainingData, WhisperModel, WhisperTrainingData


class TagSerializer(serializers.Serializer):
    """标签序列化器"""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=50)
    color = serializers.CharField(max_length=20, required=False, allow_null=True)
    user = serializers.UUIDField(source='user.id', read_only=True)


class CategorySerializer(serializers.Serializer):
    """分类序列化器"""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=100)
    color = serializers.CharField(max_length=20, required=False, allow_null=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    parent = serializers.UUIDField(source='parent.id', required=False, allow_null=True)


class NoteListSerializer(serializers.Serializer):
    """笔记列表序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    category = serializers.UUIDField(source='category.id', read_only=True, allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    tags = TagSerializer(many=True, read_only=True)
    is_favorite = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class NoteDetailSerializer(serializers.Serializer):
    """笔记详情序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    is_deleted = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class NoteCreateUpdateSerializer(serializers.Serializer):
    """笔记创建和更新序列化器"""
    title = serializers.CharField(max_length=255, required=True)
    content = serializers.CharField(required=True)
    category = serializers.UUIDField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.UUIDField(), required=False)
    is_favorite = serializers.BooleanField(default=False, required=False)
    is_public = serializers.BooleanField(default=False, required=False)

    def create(self, validated_data):
        tags_data = validated_data.pop('tags', [])
        category_id = validated_data.pop('category', None)

        # 创建笔记
        note = Note(
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


class NoteSerializer(serializers.Serializer):
    """笔记序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255, required=True)
    content = serializers.CharField(required=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_favorite = serializers.BooleanField(default=False, required=False)
    is_public = serializers.BooleanField(default=False, required=False)
    is_deleted = serializers.BooleanField(default=False, read_only=True)

    # 关联字段
    tags = TagSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)

    # 写入字段
    category_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    tag_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    def create(self, validated_data):
        tag_ids = validated_data.pop('tag_ids', [])
        category_id = validated_data.pop('category_id', None)

        # 创建笔记
        note = Note(
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
        if tag_ids:
            tags = []
            for tag_id in tag_ids:
                try:
                    tag = Tag.objects.get(id=tag_id)
                    tags.append(tag)
                except Tag.DoesNotExist:
                    continue
            note.tags = tags
            note.save()

        return note

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop('tag_ids', None)
        category_id = validated_data.pop('category_id', None)

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
        if tag_ids is not None:
            tags = []
            for tag_id in tag_ids:
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


class NoteShareSerializer(serializers.Serializer):
    """笔记分享序列化器"""
    id = serializers.UUIDField(read_only=True)
    note = NoteSerializer(read_only=True)
    shared_by = serializers.CharField(source='shared_by.username', read_only=True)
    shared_with = serializers.CharField(source='shared_with.username', read_only=True)
    share_code = serializers.CharField(read_only=True)
    share_type = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    is_accepted = serializers.BooleanField(read_only=True)


class NoteShareCreateSerializer(serializers.Serializer):
    """笔记分享创建序列化器"""
    note = serializers.UUIDField(required=True)
    shared_with = serializers.UUIDField(required=True)
    can_edit = serializers.BooleanField(default=False)
    share_type = serializers.ChoiceField(
        choices=['direct', 'link', 'email'],
        default='direct'
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class OCRModelSerializer(serializers.Serializer):
    """OCR模型序列化器"""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=100)
    version = serializers.CharField(max_length=20)
    model_path = serializers.CharField()
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class OCRTrainingDataSerializer(serializers.Serializer):
    """OCR训练数据序列化器"""
    id = serializers.UUIDField(read_only=True)
    image = serializers.CharField()
    text = serializers.CharField()
    model = serializers.UUIDField(source='model.id')
    created_at = serializers.DateTimeField(read_only=True)


class WhisperModelSerializer(serializers.Serializer):
    """Whisper模型序列化器"""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=100)
    version = serializers.CharField(max_length=20)
    model_path = serializers.CharField()
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class WhisperTrainingDataSerializer(serializers.Serializer):
    """Whisper训练数据序列化器"""
    id = serializers.UUIDField(read_only=True)
    audio = serializers.CharField()
    text = serializers.CharField()
    model = serializers.UUIDField(source='model.id')
    created_at = serializers.DateTimeField(read_only=True)


class NoteReminderSerializer(serializers.Serializer):
    """笔记提醒序列化器"""
    id = serializers.UUIDField(read_only=True)
    note = serializers.UUIDField(source='note.id')
    user = serializers.UUIDField(source='user.id', read_only=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    reminder_time = serializers.DateTimeField()
    repeat_type = serializers.ChoiceField(
        choices=['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default='none'
    )
    is_completed = serializers.BooleanField(default=False)
    is_deleted = serializers.BooleanField(default=False, read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)