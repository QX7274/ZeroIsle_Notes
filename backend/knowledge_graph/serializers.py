from rest_framework import serializers
from .models import KnowledgeNode, KnowledgeEdge


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
    
    class Meta:
        model = KnowledgeNode
        fields = ('id', 'title', 'description', 'type', 'note', 'note_title', 'x', 'y', 'color', 'size')


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
    
    class Meta:
        model = KnowledgeEdge
        fields = ('id', 'source', 'target', 'source_title', 'target_title', 'type', 'label', 'weight')


class KnowledgeGraphSerializer(serializers.Serializer):
    """
    知识图谱序列化器
    """
    nodes = KnowledgeNodeListSerializer(many=True, read_only=True)
    edges = KnowledgeEdgeListSerializer(many=True, read_only=True)