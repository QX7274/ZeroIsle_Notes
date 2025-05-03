"""
思维导图MongoDB序列化器
"""

from rest_framework import serializers
from mind_map.mongodb_models import MindMap, MindMapNode, MindMapEdge, MindMapTemplate

class MongoMindMapNodeSerializer(serializers.Serializer):
    """思维导图节点序列化器"""
    id = serializers.CharField(read_only=True)
    parent_id = serializers.CharField(allow_null=True, required=False)
    title = serializers.CharField()
    content = serializers.CharField(allow_blank=True, required=False)
    note = serializers.CharField(allow_blank=True, required=False)
    color = serializers.CharField(allow_blank=True, required=False)
    shape = serializers.CharField(default='rectangle')
    font_size = serializers.IntegerField(default=14)
    font_weight = serializers.CharField(default='normal')
    x = serializers.FloatField(default=0)
    y = serializers.FloatField(default=0)
    order = serializers.IntegerField(default=0)
    is_collapsed = serializers.BooleanField(default=False)
    properties = serializers.DictField(required=False)


class MongoMindMapEdgeSerializer(serializers.Serializer):
    """思维导图边序列化器"""
    id = serializers.CharField(read_only=True)
    source = serializers.CharField()
    target = serializers.CharField()
    label = serializers.CharField(allow_blank=True, required=False)
    style = serializers.CharField(default='solid')
    color = serializers.CharField(allow_blank=True, required=False)
    width = serializers.IntegerField(default=1)
    properties = serializers.DictField(required=False)


class MongoMindMapSerializer(serializers.Serializer):
    """思维导图序列化器"""
    id = serializers.CharField(read_only=True)
    title = serializers.CharField()
    description = serializers.CharField(allow_blank=True, required=False)
    note_id = serializers.CharField(allow_blank=True, required=False)
    layout_type = serializers.CharField(default='tree')
    theme = serializers.CharField(default='default')
    is_public = serializers.BooleanField(default=False)
    is_deleted = serializers.BooleanField(default=False, read_only=True)
    properties = serializers.DictField(required=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    def create(self, validated_data):
        """创建思维导图"""
        user = validated_data.pop('user')
        mind_map = MindMap(user=user, **validated_data)
        mind_map.save()
        return mind_map
    
    def update(self, instance, validated_data):
        """更新思维导图"""
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance


class MongoMindMapDetailSerializer(MongoMindMapSerializer):
    """思维导图详情序列化器"""
    nodes = MongoMindMapNodeSerializer(many=True)
    edges = MongoMindMapEdgeSerializer(many=True)


class MongoMindMapTemplateSerializer(serializers.Serializer):
    """思维导图模板序列化器"""
    id = serializers.CharField(read_only=True)
    title = serializers.CharField()
    description = serializers.CharField(allow_blank=True, required=False)
    thumbnail_url = serializers.CharField(allow_blank=True, required=False)
    type = serializers.CharField(default='general')
    layout_type = serializers.CharField(default='tree')
    theme = serializers.CharField(default='default')
    is_system = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    nodes = MongoMindMapNodeSerializer(many=True)
    edges = MongoMindMapEdgeSerializer(many=True)
    
    def create(self, validated_data):
        """创建思维导图模板"""
        nodes_data = validated_data.pop('nodes', [])
        edges_data = validated_data.pop('edges', [])
        
        template = MindMapTemplate(**validated_data)
        
        # 添加节点
        for node_data in nodes_data:
            node = MindMapNode(**node_data)
            template.nodes.append(node)
        
        # 添加边
        for edge_data in edges_data:
            edge = MindMapEdge(**edge_data)
            template.edges.append(edge)
        
        template.save()
        return template
    
    def update(self, instance, validated_data):
        """更新思维导图模板"""
        nodes_data = validated_data.pop('nodes', None)
        edges_data = validated_data.pop('edges', None)
        
        # 更新基本信息
        for key, value in validated_data.items():
            setattr(instance, key, value)
        
        # 更新节点
        if nodes_data is not None:
            instance.nodes = []
            for node_data in nodes_data:
                node = MindMapNode(**node_data)
                instance.nodes.append(node)
        
        # 更新边
        if edges_data is not None:
            instance.edges = []
            for edge_data in edges_data:
                edge = MindMapEdge(**edge_data)
                instance.edges.append(edge)
        
        instance.save()
        return instance
