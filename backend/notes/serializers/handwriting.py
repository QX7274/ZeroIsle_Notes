"""
手写笔记序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import Handwriting, HandwritingShare


class HandwritingSerializer(serializers.Serializer):
    """
    手写笔记序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    title = serializers.CharField(max_length=255, required=True)
    image = serializers.FileField(required=True)
    thumbnail = serializers.FileField(read_only=True)
    text_content = serializers.CharField(required=False, allow_blank=True)
    category = serializers.UUIDField(source='category.id', required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.UUIDField(), required=False)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        """
        创建手写笔记
        """
        from django.utils import timezone
        import uuid

        user = self.context['request'].user

        handwriting = Handwriting(
            id=uuid.uuid4(),
            user=user,
            title=validated_data.get('title'),
            text_content=validated_data.get('text_content', ''),
            is_favorite=validated_data.get('is_favorite', False),
            is_public=validated_data.get('is_public', False),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 处理分类
        category_id = validated_data.get('category', {}).get('id')
        if category_id:
            from notes.mongodb_models import Category
            try:
                category = Category.objects.get(id=category_id, user=user)
                handwriting.category = category
            except Category.DoesNotExist:
                pass

        # 处理标签
        tag_ids = validated_data.get('tags', [])
        if tag_ids:
            from notes.mongodb_models import Tag
            tags = Tag.objects.filter(id__in=tag_ids, user=user)
            handwriting.tags = tags

        # 处理图片上传
        image = validated_data.get('image')
        if image:
            handwriting.image.put(image, content_type=image.content_type)

            # 生成缩略图
            try:
                from PIL import Image
                import io

                img = Image.open(image)
                img.thumbnail((300, 300))
                thumb_io = io.BytesIO()
                img.save(thumb_io, format=img.format)
                thumb_io.seek(0)

                handwriting.thumbnail.put(
                    thumb_io,
                    content_type=f'image/{img.format.lower()}',
                    filename=f'thumb_{image.name}'
                )
            except Exception as e:
                print(f"缩略图生成失败: {e}")

        handwriting.save()
        return handwriting

    def update(self, instance, validated_data):
        """
        更新手写笔记
        """
        instance.title = validated_data.get('title', instance.title)
        instance.text_content = validated_data.get('text_content', instance.text_content)
        instance.is_favorite = validated_data.get('is_favorite', instance.is_favorite)
        instance.is_public = validated_data.get('is_public', instance.is_public)

        # 处理分类
        category_id = validated_data.get('category', {}).get('id')
        if category_id:
            from notes.mongodb_models import Category
            try:
                category = Category.objects.get(id=category_id, user=instance.user)
                instance.category = category
            except Category.DoesNotExist:
                pass
        elif 'category' in validated_data:
            instance.category = None

        # 处理标签
        tag_ids = validated_data.get('tags', None)
        if tag_ids is not None:
            from notes.mongodb_models import Tag
            tags = Tag.objects.filter(id__in=tag_ids, user=instance.user)
            instance.tags = tags

        # 处理图片上传
        image = validated_data.get('image')
        if image:
            instance.image.replace(image, content_type=image.content_type)

            # 生成缩略图
            try:
                from PIL import Image
                import io

                img = Image.open(image)
                img.thumbnail((300, 300))
                thumb_io = io.BytesIO()
                img.save(thumb_io, format=img.format)
                thumb_io.seek(0)

                instance.thumbnail.replace(
                    thumb_io,
                    content_type=f'image/{img.format.lower()}',
                    filename=f'thumb_{image.name}'
                )
            except Exception as e:
                print(f"缩略图生成失败: {e}")

        instance.save()
        return instance


class HandwritingShareSerializer(serializers.Serializer):
    """
    手写笔记分享序列化器
    """
    id = serializers.UUIDField(read_only=True)
    handwriting = serializers.UUIDField(source='handwriting.id')
    handwriting_title = serializers.CharField(source='handwriting.title', read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    share_type = serializers.ChoiceField(choices=['link', 'email', 'user'], default='link')
    share_to = serializers.CharField(max_length=255, required=False, allow_blank=True)
    share_code = serializers.CharField(max_length=20, read_only=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    is_password_protected = serializers.BooleanField(default=False)
    password = serializers.CharField(max_length=100, required=False, allow_blank=True, write_only=True)
    is_active = serializers.BooleanField(default=True)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_expired = serializers.SerializerMethodField()

    def get_is_expired(self, obj):
        """
        判断是否已过期
        """
        return obj.is_expired()

    def create(self, validated_data):
        """
        创建分享
        """
        from django.utils import timezone
        import uuid
        import random
        import string

        user = self.context['request'].user
        handwriting_id = validated_data.get('handwriting', {}).get('id')

        # 获取手写笔记
        try:
            handwriting = Handwriting.objects.get(id=handwriting_id)
        except Handwriting.DoesNotExist:
            raise serializers.ValidationError("手写笔记不存在")

        # 生成分享码
        share_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))

        # 创建分享
        share = HandwritingShare(
            id=uuid.uuid4(),
            handwriting=handwriting,
            user=user,
            share_type=validated_data.get('share_type', 'link'),
            share_to=validated_data.get('share_to', ''),
            share_code=share_code,
            expires_at=validated_data.get('expires_at'),
            is_password_protected=validated_data.get('is_password_protected', False),
            password=validated_data.get('password', ''),
            is_active=validated_data.get('is_active', True),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        share.save()
        return share
