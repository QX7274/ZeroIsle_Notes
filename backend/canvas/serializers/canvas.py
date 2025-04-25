"""
画布序列化器
"""

from rest_framework import serializers
from canvas.models import Canvas

class CanvasSerializer(serializers.ModelSerializer):
    """
    画布序列化器
    """
    elements_count = serializers.SerializerMethodField()
    connections_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Canvas
        fields = [
            'id', 'title', 'description', 'user', 'is_public', 
            'view_count', 'elements_count', 'connections_count', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'view_count', 'created_at', 'updated_at']
    
    def get_elements_count(self, obj):
        """获取元素数量"""
        return obj.elements.count()
    
    def get_connections_count(self, obj):
        """获取连接数量"""
        return obj.connections.count()

class CanvasDetailSerializer(serializers.ModelSerializer):
    """
    画布详情序列化器
    """
    from .canvas_element import CanvasElementSerializer
    from .canvas_connection import CanvasConnectionSerializer
    
    elements = CanvasElementSerializer(many=True, read_only=True)
    connections = CanvasConnectionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Canvas
        fields = [
            'id', 'title', 'description', 'user', 'is_public', 
            'view_count', 'elements', 'connections', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'view_count', 'created_at', 'updated_at']
