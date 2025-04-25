"""
知识图谱序列化器
"""

from rest_framework import serializers
from knowledge_graph.serializers.node import KnowledgeNodeListSerializer
from knowledge_graph.serializers.edge import KnowledgeEdgeListSerializer

class KnowledgeGraphSerializer(serializers.Serializer):
    """
    知识图谱序列化器
    """
    nodes = KnowledgeNodeListSerializer(many=True, read_only=True)
    edges = KnowledgeEdgeListSerializer(many=True, read_only=True)
