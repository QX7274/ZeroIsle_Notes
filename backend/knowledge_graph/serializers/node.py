"""
知识节点序列化器
"""

from rest_framework import serializers
from knowledge_graph.mongodb_models import KnowledgeNode

class KnowledgeNodeSerializer(serializers.Serializer):
    """
    知识节点序列化器
    """
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    type = serializers.ChoiceField(choices=KnowledgeNode.NODE_TYPES)
    note = serializers.CharField(required=False, allow_null=True)
    x = serializers.FloatField(default=0)
    y = serializers.FloatField(default=0)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True)
    size = serializers.IntegerField(default=20)
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True)
    properties = serializers.DictField(required=False, default=dict)
    is_public = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class KnowledgeNodeListSerializer(serializers.Serializer):
    """
    知识节点列表序列化器
    """
    id = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    type = serializers.ChoiceField(choices=KnowledgeNode.NODE_TYPES)
    type_display = serializers.SerializerMethodField()
    note = serializers.CharField(required=False, allow_null=True)
    note_title = serializers.SerializerMethodField()
    x = serializers.FloatField(default=0)
    y = serializers.FloatField(default=0)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True)
    size = serializers.IntegerField(default=20)

    def get_type_display(self, obj):
        """获取节点类型显示名称"""
        return dict(KnowledgeNode.NODE_TYPES).get(obj.type, '')

    def get_note_title(self, obj):
        """获取笔记标题"""
        if hasattr(obj, 'note') and obj.note:
            return obj.note.title if hasattr(obj.note, 'title') else ''
        return ''
