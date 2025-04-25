"""
知识节点序列化器
"""

from rest_framework import serializers
from knowledge_graph.models import KnowledgeNode

class KnowledgeNodeSerializer(serializers.ModelSerializer):
    """
    知识节点序列化器
    """
    class Meta:
        model = KnowledgeNode
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class KnowledgeNodeListSerializer(serializers.ModelSerializer):
    """
    知识节点列表序列化器
    """
    note_title = serializers.CharField(source='note.title', read_only=True, required=False)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = KnowledgeNode
        fields = ('id', 'title', 'description', 'type', 'type_display', 'note', 'note_title', 'x', 'y', 'color', 'size')
