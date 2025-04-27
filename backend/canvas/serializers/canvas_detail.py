"""
画布详情序列化器
"""

from rest_framework import serializers
from canvas.models import Canvas, CanvasElement, CanvasConnection
from .canvas import CanvasSerializer
from .canvas_element import CanvasElementSerializer
from .canvas_connection import CanvasConnectionSerializer


class CanvasDetailSerializer(CanvasSerializer):
    """
    画布详情序列化器
    包含画布的所有元素和连接
    """
    elements = CanvasElementSerializer(many=True, read_only=True)
    connections = CanvasConnectionSerializer(many=True, read_only=True)
    
    class Meta(CanvasSerializer.Meta):
        fields = CanvasSerializer.Meta.fields + ['elements', 'connections']
