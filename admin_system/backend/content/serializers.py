from rest_framework import serializers
from common.serializers import MongoDocumentSerializer
from .models import NoteCategory, Tag, ContentReport, Note, Comment, Attachment, NoteVersion

class NoteCategorySerializer(MongoDocumentSerializer):
    """笔记分类序列化器"""
    class Meta:
        model = NoteCategory
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class TagSerializer(MongoDocumentSerializer):
    """标签序列化器"""
    class Meta:
        model = Tag
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class ContentReportSerializer(MongoDocumentSerializer):
    """内容举报序列化器"""
    class Meta:
        model = ContentReport
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class ContentReportListSerializer(MongoDocumentSerializer):
    """内容举报列表序列化器"""
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ContentReport
        fields = ['id', 'content_id', 'content_type', 'reporter_id', 'reason', 'reason_display', 'status', 'status_display', 'created_at']

class ContentReportUpdateSerializer(MongoDocumentSerializer):
    """内容举报更新序列化器"""
    class Meta:
        model = ContentReport
        fields = ['status', 'admin_comment']

class NoteSerializer(MongoDocumentSerializer):
    """笔记序列化器"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    tags_list = serializers.SerializerMethodField()
    note_type_display = serializers.CharField(source='get_note_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Note
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'view_count', 'like_count', 'comment_count']

    def get_tags_list(self, obj):
        return [{'id': str(tag.id), 'name': tag.name} for tag in obj.tags]

class NoteListSerializer(MongoDocumentSerializer):
    """笔记列表序列化器"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    tags_count = serializers.SerializerMethodField()
    note_type_display = serializers.CharField(source='get_note_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Note
        fields = ['id', 'title', 'note_type', 'note_type_display', 'status', 'status_display',
                 'user_id', 'username', 'category_name', 'tags_count', 'is_public',
                 'view_count', 'like_count', 'comment_count', 'created_at', 'updated_at']

    def get_tags_count(self, obj):
        return len(obj.tags) if obj.tags else 0

class NoteCreateSerializer(MongoDocumentSerializer):
    """笔记创建序列化器"""
    class Meta:
        model = Note
        exclude = ['created_at', 'updated_at', 'view_count', 'like_count', 'comment_count']

class NoteUpdateSerializer(MongoDocumentSerializer):
    """笔记更新序列化器"""
    class Meta:
        model = Note
        exclude = ['created_at', 'updated_at', 'view_count', 'like_count', 'comment_count']

class CommentSerializer(MongoDocumentSerializer):
    """评论序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)

    class Meta:
        model = Comment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'like_count']

class CommentListSerializer(MongoDocumentSerializer):
    """评论列表序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'content', 'note', 'note_title', 'user_id', 'username',
                 'parent_comment', 'is_deleted', 'like_count', 'created_at']

class AttachmentSerializer(MongoDocumentSerializer):
    """附件序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)

    class Meta:
        model = Attachment
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class AttachmentListSerializer(MongoDocumentSerializer):
    """附件列表序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)

    class Meta:
        model = Attachment
        fields = ['id', 'filename', 'file_type', 'file_type_display', 'file_size',
                 'note', 'note_title', 'user_id', 'created_at']


class NoteVersionSerializer(MongoDocumentSerializer):
    """笔记版本序列化器（只读）。

    前端 NoteDetail 的"版本历史"需要展示：版本号、说明、时间、是否当前版本。
    这里用 SerializerMethodField 给出前端友好的命名（version / createdAt），
    同时保留后端字段名（version_number / created_at），避免前端再适配；
    二者都能取到，方便后续统一。
    """
    version = serializers.SerializerMethodField()
    createdAt = serializers.SerializerMethodField()

    class Meta:
        model = NoteVersion
        fields = ['id', 'note', 'title', 'description', 'version_number', 'version',
                  'is_current', 'is_auto_save', 'created_at', 'createdAt']
        read_only_fields = fields

    def get_version(self, obj):
        return getattr(obj, "version_number", None)

    def get_createdAt(self, obj):
        created = getattr(obj, "created_at", None)
        return created.isoformat() if created else None
