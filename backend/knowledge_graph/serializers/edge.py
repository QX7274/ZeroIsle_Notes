"""
知识连接序列化器
"""

from rest_framework import serializers
from knowledge_graph.mongodb_models import KnowledgeEdge

class KnowledgeEdgeSerializer(serializers.Serializer):
    """
    知识连接序列化器
    """
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    source = serializers.CharField()
    target = serializers.CharField()
    type = serializers.ChoiceField(choices=KnowledgeEdge.EDGE_TYPES)
    label = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    weight = serializers.FloatField(default=1.0)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True)
    properties = serializers.DictField(required=False, default=dict)
    is_public = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class KnowledgeEdgeListSerializer(serializers.Serializer):
    """
    知识连接列表序列化器
    """
    id = serializers.CharField(read_only=True)
    source = serializers.CharField()
    target = serializers.CharField()
    source_title = serializers.SerializerMethodField()
    target_title = serializers.SerializerMethodField()
    type = serializers.ChoiceField(choices=KnowledgeEdge.EDGE_TYPES)
    type_display = serializers.SerializerMethodField()
    label = serializers.CharField(max_length=100, required=False, allow_blank=True)
    weight = serializers.FloatField(default=1.0)

    def get_source_title(self, obj):
        """获取源节点标题"""
        if hasattr(obj, 'source') and obj.source:
            return obj.source.title if hasattr(obj.source, 'title') else ''
        return ''

    def get_target_title(self, obj):
        """获取目标节点标题"""
        if hasattr(obj, 'target') and obj.target:
            return obj.target.title if hasattr(obj.target, 'title') else ''
        return ''

    def get_type_display(self, obj):
        """获取连接类型显示名称"""
        return dict(KnowledgeEdge.EDGE_TYPES).get(obj.type, '')
