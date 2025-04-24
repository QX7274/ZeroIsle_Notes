"""笔记序列化器"""

from rest_framework import serializers
from .models import Note, Category, Tag, NoteShare, OCRModel, OCRTrainingData, WhisperModel, WhisperTrainingData


class TagSerializer(serializers.ModelSerializer):
    """标签序列化器"""
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color']


class CategorySerializer(serializers.ModelSerializer):
    """分类序列化器"""
    class Meta:
        model = Category
        fields = ['id', 'name', 'color']


class NoteListSerializer(serializers.ModelSerializer):
    """笔记列表序列化器"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Note
        fields = ['id', 'title', 'category', 'category_name', 'tags', 'is_favorite', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class NoteDetailSerializer(serializers.ModelSerializer):
    """笔记详情序列化器"""
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Note
        fields = ['id', 'title', 'content', 'category', 'tags', 'is_favorite', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class NoteCreateUpdateSerializer(serializers.ModelSerializer):
    """笔记创建和更新序列化器"""
    tags = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all(), many=True, required=False)
    
    class Meta:
        model = Note
        fields = ['title', 'content', 'category', 'tags', 'is_favorite']
    
    def create(self, validated_data):
        tags = validated_data.pop('tags', [])
        category = validated_data.pop('category', None)
        note = Note.objects.create(**validated_data)
        if category:
            note.category = category
        if tags:
            note.tags.set(tags)
        note.save()
        return note
    
    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        category = validated_data.pop('category', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if category is not None:
            instance.category = category
        if tags is not None:
            instance.tags.set(tags)
        instance.save()
        return instance


class NoteSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True,
        required=False
    )
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        source='tags',
        many=True,
        write_only=True,
        required=False
    )

    class Meta:
        model = Note
        fields = [
            'id', 'title', 'content', 'created_at', 'updated_at',
            'is_archived', 'is_pinned', 'tags', 'category',
            'category_id', 'tag_ids'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        tags = validated_data.pop('tags', [])
        note = Note.objects.create(**validated_data)
        note.tags.set(tags)
        return note

    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        if tags is not None:
            instance.tags.set(tags)
        return super().update(instance, validated_data)


class NoteShareSerializer(serializers.ModelSerializer):
    note = NoteSerializer(read_only=True)
    shared_by = serializers.StringRelatedField()
    shared_with = serializers.StringRelatedField()

    class Meta:
        model = NoteShare
        fields = ['id', 'note', 'shared_by', 'shared_with', 'created_at', 'is_accepted']
        read_only_fields = ['created_at']


class NoteShareCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteShare
        fields = ('note', 'shared_with', 'can_edit')


class OCRModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = OCRModel
        fields = ['id', 'name', 'version', 'model_path', 'is_active', 'created_at', 'updated_at']


class OCRTrainingDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = OCRTrainingData
        fields = ['id', 'image', 'text', 'model', 'created_at']


class WhisperModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhisperModel
        fields = ['id', 'name', 'version', 'model_path', 'is_active', 'created_at', 'updated_at']


class WhisperTrainingDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhisperTrainingData
        fields = ['id', 'audio', 'text', 'model', 'created_at']