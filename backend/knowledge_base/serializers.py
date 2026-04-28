"""
知识库序列化器
"""

from rest_framework import serializers
from knowledge_base.mongodb_models import (
    KnowledgeBase, KnowledgeBaseSnapshot, 
    KnowledgeBaseImport, KnowledgeBaseQuery
)


class KnowledgeBaseSerializer(serializers.Serializer):
    """知识库序列化器"""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    type = serializers.ChoiceField(
        choices=['personal', 'project', 'team', 'public'],
        default='personal'
    )
    icon = serializers.CharField(required=False, allow_blank=True)
    cover_image = serializers.CharField(required=False, allow_blank=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False
    )
    is_public = serializers.BooleanField(default=False)
    is_archived = serializers.BooleanField(default=False, read_only=True)
    node_count = serializers.IntegerField(read_only=True)
    edge_count = serializers.IntegerField(read_only=True)
    note_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class KnowledgeBaseCreateSerializer(serializers.Serializer):
    """知识库创建序列化器"""
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    type = serializers.ChoiceField(
        choices=['personal', 'project', 'team', 'public'],
        default='personal'
    )
    icon = serializers.CharField(required=False, allow_blank=True, default='')
    cover_image = serializers.CharField(required=False, allow_blank=True, default='')
    tags = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list
    )
    is_public = serializers.BooleanField(default=False)


class KnowledgeBaseSnapshotSerializer(serializers.Serializer):
    """知识库快照序列化器"""
    id = serializers.UUIDField(read_only=True)
    knowledge_base = serializers.UUIDField()
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    node_count = serializers.IntegerField(read_only=True)
    edge_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)


class KnowledgeBaseImportSerializer(serializers.Serializer):
    """知识库导入序列化器"""
    id = serializers.UUIDField(read_only=True)
    source_type = serializers.ChoiceField(
        choices=['file', 'url', 'api', 'other']
    )
    source_name = serializers.CharField(required=False, allow_blank=True)
    source_url = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(read_only=True)
    nodes_created = serializers.IntegerField(read_only=True)
    edges_created = serializers.IntegerField(read_only=True)
    error_message = serializers.CharField(read_only=True, required=False)
    started_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True, required=False)


class KnowledgeBaseQuerySerializer(serializers.Serializer):
    """知识库查询序列化器"""
    id = serializers.UUIDField(read_only=True)
    question = serializers.CharField()
    answer = serializers.CharField(read_only=True)
    rating = serializers.IntegerField(required=False, min_value=1, max_value=5)
    feedback = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField(read_only=True)


class SnippetSerializer(serializers.Serializer):
    text = serializers.CharField()
    source = serializers.DictField(required=False)


class KnowledgeBaseAskSerializer(serializers.Serializer):
    """知识库提问序列化器"""
    # 兼容字段：前端可能传 query，我们统一映射到 question
    question = serializers.CharField(max_length=500, required=False)
    query = serializers.CharField(max_length=500, required=False)
    context_limit = serializers.IntegerField(default=5, min_value=1, max_value=20)
    snippets = serializers.ListField(child=SnippetSerializer(), required=False)

    def validate(self, attrs):
        # 兼容 query -> question
        if not attrs.get('question') and attrs.get('query'):
            attrs['question'] = attrs['query']
        if not attrs.get('question'):
            raise serializers.ValidationError({'question': 'question or query is required'})
        return attrs


class KnowledgeBaseBuildSerializer(serializers.Serializer):
    """知识库构建序列化器"""
    note_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False
    )
    extract_concepts = serializers.BooleanField(default=True)


class KnowledgeBaseImportMarkdownSerializer(serializers.Serializer):
    """Markdown导入序列化器"""
    content = serializers.CharField()
    source_name = serializers.CharField(required=False, default='Markdown导入')


class KnowledgeBaseMemberSerializer(serializers.Serializer):
    """知识库成员序列化器"""
    user_id = serializers.CharField(source='user.id')
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    role = serializers.ChoiceField(choices=['admin', 'editor', 'viewer'])
    joined_at = serializers.DateTimeField(read_only=True)

    def to_representation(self, instance):
        # For reading/listing members
        representation = super().to_representation(instance)
        user = instance.user
        representation['user'] = {
            'id': str(user.id),
            'username': user.username,
            'email': user.email
        }
        representation.pop('user_id') # Clean up
        return representation

