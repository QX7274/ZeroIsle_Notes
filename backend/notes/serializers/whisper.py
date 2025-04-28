"""
Whisper序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import WhisperModel, WhisperTrainingData


class WhisperModelSerializer(serializers.Serializer):
    """
    Whisper模型序列化器
    """
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=100, required=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    model_file = serializers.FileField(required=False)
    model_size = serializers.ChoiceField(choices=['tiny', 'base', 'small', 'medium', 'large'], default='base')
    model_size_display = serializers.SerializerMethodField()
    language = serializers.CharField(max_length=50, required=False, allow_blank=True)
    version = serializers.CharField(max_length=20, required=False, allow_blank=True)
    accuracy = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_model_size_display(self, obj):
        """
        获取模型大小显示名称
        """
        size_map = {
            'tiny': '超小型',
            'base': '基础型',
            'small': '小型',
            'medium': '中型',
            'large': '大型'
        }
        return size_map.get(obj.model_size, obj.model_size)

    def create(self, validated_data):
        """
        创建Whisper模型
        """
        from django.utils import timezone
        import uuid

        model = WhisperModel(
            id=uuid.uuid4(),
            name=validated_data.get('name'),
            description=validated_data.get('description', ''),
            model_size=validated_data.get('model_size', 'base'),
            language=validated_data.get('language', ''),
            version=validated_data.get('version', ''),
            accuracy=validated_data.get('accuracy', ''),
            is_active=validated_data.get('is_active', True),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 处理模型文件上传
        model_file = validated_data.get('model_file')
        if model_file:
            model.model_file.put(model_file, content_type=model_file.content_type)

        model.save()
        return model

    def update(self, instance, validated_data):
        """
        更新Whisper模型
        """
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.model_size = validated_data.get('model_size', instance.model_size)
        instance.language = validated_data.get('language', instance.language)
        instance.version = validated_data.get('version', instance.version)
        instance.accuracy = validated_data.get('accuracy', instance.accuracy)
        instance.is_active = validated_data.get('is_active', instance.is_active)

        # 处理模型文件上传
        model_file = validated_data.get('model_file')
        if model_file:
            instance.model_file.replace(model_file, content_type=model_file.content_type)

        instance.save()
        return instance


class WhisperTrainingDataSerializer(serializers.Serializer):
    """
    Whisper训练数据序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    audio = serializers.FileField(required=True)
    text = serializers.CharField(required=True)
    language = serializers.CharField(max_length=50, required=False, allow_blank=True)
    is_verified = serializers.BooleanField(default=False, read_only=True)
    verified_by = serializers.UUIDField(source='verified_by.id', read_only=True)
    verified_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        """
        创建Whisper训练数据
        """
        from django.utils import timezone
        import uuid

        user = self.context['request'].user

        training_data = WhisperTrainingData(
            id=uuid.uuid4(),
            user=user,
            text=validated_data.get('text'),
            language=validated_data.get('language', ''),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 处理音频上传
        audio = validated_data.get('audio')
        if audio:
            training_data.audio.put(audio, content_type=audio.content_type)

        training_data.save()
        return training_data

    def update(self, instance, validated_data):
        """
        更新Whisper训练数据
        """
        instance.text = validated_data.get('text', instance.text)
        instance.language = validated_data.get('language', instance.language)

        # 处理音频上传
        audio = validated_data.get('audio')
        if audio:
            instance.audio.replace(audio, content_type=audio.content_type)

        instance.save()
        return instance
