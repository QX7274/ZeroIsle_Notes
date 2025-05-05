"""
思维导图序列化器
"""

from rest_framework import serializers
from mind_map.models import MindMap, MindMapNode, MindMapEdge, MindMapTemplate

class MindMapNodeSerializer(serializers.ModelSerializer):
    """思维导图节点序列化器"""
    
    class Meta:
        model = MindMapNode
        fields = [
            'id', 'mind_map', 'parent', 'title', 'content', 'note',
            'color', 'shape', 'font_size', 'font_weight',
            'x', 'y', 'order', 'is_collapsed'
        ]
        read_only_fields = ['id']


class MindMapEdgeSerializer(serializers.ModelSerializer):
    """思维导图边序列化器"""
    
    class Meta:
        model = MindMapEdge
        fields = [
            'id', 'mind_map', 'source', 'target',
            'label', 'style', 'color', 'width'
        ]
        read_only_fields = ['id']


class MindMapSerializer(serializers.ModelSerializer):
    """思维导图序列化器"""
    
    class Meta:
        model = MindMap
        fields = [
            'id', 'title', 'description', 'is_public', 'is_deleted',
            'created_at', 'updated_at', 'note', 'data',
            'layout_type', 'theme'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']


class MindMapDetailSerializer(serializers.ModelSerializer):
    """思维导图详情序列化器"""
    nodes = MindMapNodeSerializer(many=True, read_only=True, source='nodes.all')
    edges = MindMapEdgeSerializer(many=True, read_only=True, source='edges.all')
    
    class Meta:
        model = MindMap
        fields = [
            'id', 'title', 'description', 'is_public', 'is_deleted',
            'created_at', 'updated_at', 'note', 'data',
            'layout_type', 'theme', 'nodes', 'edges'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']


class MindMapTemplateSerializer(serializers.ModelSerializer):
    """思维导图模板序列化器"""
    
    class Meta:
        model = MindMapTemplate
        fields = [
            'id', 'title', 'description', 'thumbnail',
            'data', 'type', 'layout_type', 'theme', 'is_system'
        ]
        read_only_fields = ['id']
