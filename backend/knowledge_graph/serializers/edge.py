"""
知识连接序列化器
"""

from rest_framework import serializers
from knowledge_graph.models import KnowledgeEdge

class KnowledgeEdgeSerializer(serializers.ModelSerializer):
    """
    知识连接序列化器
    """
    class Meta:
        model = KnowledgeEdge
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class KnowledgeEdgeListSerializer(serializers.ModelSerializer):
    """
    知识连接列表序列化器
    """
    source_title = serializers.CharField(source='source.title', read_only=True)
    target_title = serializers.CharField(source='target.title', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = KnowledgeEdge
        fields = ('id', 'source', 'target', 'source_title', 'target_title', 'type', 'type_display', 'label', 'weight')
