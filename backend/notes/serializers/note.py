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
    category = serializers.UUIDField(source='category.id', required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.UUIDField(), required=False)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    is_encrypted = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

def _note_tag_names(obj):
    """返回笔记的标签**名称**列表。

    背景（RISK-BE-005）：此前 tags 声明为 `ListField(child=CharField())`，DRF 会对 mongoengine 的
    `Tag` 文档调用 `str()`，而 `Tag.__str__` 是 `"name (id)"` —— 于是接口返回
    `"工作 (a0b07759-1d69-433f-b774-fe5cf720a3ad)"` 这种把 id 混进名称的字符串。
    客户端 `src/services/api/notesApi.js` 对该字段做 `tags.map(String)` 后直接落库，
    结果是 app 里显示的标签带着一串 UUID。
    这里显式只取名称；引用悬空（被删除的标签）时跳过，不让序列化整体 500。
    """
    result = []
    for tag in (getattr(obj, 'tags', None) or []):
        name = getattr(tag, 'name', None)
        if name:
            result.append(str(name))
        else:
            # mongoengine 在引用无法反解时会抛错；这里已拿到对象，取不到 name 属异常数据，忽略即可
            continue
    return result


class NoteListSerializer(serializers.Serializer):
    """笔记列表序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    category = serializers.UUIDField(source='category.id', allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    # 只返回标签名称（不再泄漏 id，见 _note_tag_names 的说明）
    tags = serializers.SerializerMethodField()
    word_count = serializers.IntegerField(read_only=True)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_tags(self, obj):
        return _note_tag_names(obj)

class NoteDetailSerializer(serializers.Serializer):
    """笔记详情序列化器"""
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    category = serializers.UUIDField(source='category.id', allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    # 只返回标签名称（不再泄漏 id，见 _note_tag_names 的说明）
    tags = serializers.SerializerMethodField()
    user = UserSerializer(read_only=True)
    word_count = serializers.IntegerField(read_only=True)
    is_favorite = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=False)
    is_encrypted = serializers.BooleanField(default=False)
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    last_viewed_at = serializers.DateTimeField(read_only=True, allow_null=True)

    def get_tags(self, obj):
        return _note_tag_names(obj)


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
