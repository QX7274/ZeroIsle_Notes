from rest_framework import serializers
from .models import NoteCategory, Tag, ContentReport, Note, Comment, Attachment

class NoteCategorySerializer(serializers.ModelSerializer):
    """笔记分类序列化器"""
    class Meta:
        model = NoteCategory
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class TagSerializer(serializers.ModelSerializer):
    """标签序列化器"""
    class Meta:
        model = Tag
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class ContentReportSerializer(serializers.ModelSerializer):
    """内容举报序列化器"""
    class Meta:
        model = ContentReport
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class ContentReportListSerializer(serializers.ModelSerializer):
    """内容举报列表序列化器"""
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ContentReport
        fields = ['id', 'content_id', 'content_type', 'reporter_id', 'reason', 'reason_display', 'status', 'status_display', 'created_at']

class ContentReportUpdateSerializer(serializers.ModelSerializer):
    """内容举报更新序列化器"""
    class Meta:
        model = ContentReport
        fields = ['status', 'admin_comment']

class NoteSerializer(serializers.ModelSerializer):
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

class NoteListSerializer(serializers.ModelSerializer):
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

class NoteCreateSerializer(serializers.ModelSerializer):
    """笔记创建序列化器"""
    class Meta:
        model = Note
        exclude = ['created_at', 'updated_at', 'view_count', 'like_count', 'comment_count']

class NoteUpdateSerializer(serializers.ModelSerializer):
    """笔记更新序列化器"""
    class Meta:
        model = Note
        exclude = ['created_at', 'updated_at', 'view_count', 'like_count', 'comment_count']

class CommentSerializer(serializers.ModelSerializer):
    """评论序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)

    class Meta:
        model = Comment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'like_count']

class CommentListSerializer(serializers.ModelSerializer):
    """评论列表序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'content', 'note', 'note_title', 'user_id', 'username',
                 'parent_comment', 'is_deleted', 'like_count', 'created_at']

class AttachmentSerializer(serializers.ModelSerializer):
    """附件序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)

    class Meta:
        model = Attachment
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class AttachmentListSerializer(serializers.ModelSerializer):
    """附件列表序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)

    class Meta:
        model = Attachment
        fields = ['id', 'filename', 'file_type', 'file_type_display', 'file_size',
                 'note', 'note_title', 'user_id', 'created_at']
