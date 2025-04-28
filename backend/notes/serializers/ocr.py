"""
OCR序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import OCRModel, OCRTrainingData


class OCRModelSerializer(serializers.Serializer):
    """
    OCR模型序列化器
    """
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=100, required=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    model_file = serializers.FileField(required=False)
    model_type = serializers.ChoiceField(choices=['tesseract', 'custom'], default='tesseract')
    model_type_display = serializers.SerializerMethodField()
    language = serializers.CharField(max_length=50, required=False, allow_blank=True)
    version = serializers.CharField(max_length=20, required=False, allow_blank=True)
    accuracy = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_model_type_display(self, obj):
        """
        获取模型类型显示名称
        """
        type_map = {
            'tesseract': 'Tesseract OCR',
            'custom': '自定义模型'
        }
        return type_map.get(obj.model_type, obj.model_type)

    def create(self, validated_data):
        """
        创建OCR模型
        """
        from django.utils import timezone
        import uuid

        model = OCRModel(
            id=uuid.uuid4(),
            name=validated_data.get('name'),
            description=validated_data.get('description', ''),
            model_type=validated_data.get('model_type', 'tesseract'),
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
        更新OCR模型
        """
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.model_type = validated_data.get('model_type', instance.model_type)
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


class OCRTrainingDataSerializer(serializers.Serializer):
    """
    OCR训练数据序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    image = serializers.FileField(required=True)
    text = serializers.CharField(required=True)
    language = serializers.CharField(max_length=50, required=False, allow_blank=True)
    is_verified = serializers.BooleanField(default=False, read_only=True)
    verified_by = serializers.UUIDField(source='verified_by.id', read_only=True)
    verified_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        """
        创建OCR训练数据
        """
        from django.utils import timezone
        import uuid

        user = self.context['request'].user

        training_data = OCRTrainingData(
            id=uuid.uuid4(),
            user=user,
            text=validated_data.get('text'),
            language=validated_data.get('language', ''),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 处理图片上传
        image = validated_data.get('image')
        if image:
            training_data.image.put(image, content_type=image.content_type)

        training_data.save()
        return training_data

    def update(self, instance, validated_data):
        """
        更新OCR训练数据
        """
        instance.text = validated_data.get('text', instance.text)
        instance.language = validated_data.get('language', instance.language)

        # 处理图片上传
        image = validated_data.get('image')
        if image:
            instance.image.replace(image, content_type=image.content_type)

        instance.save()
        return instance
