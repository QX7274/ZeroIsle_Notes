"""
画布元素序列化器
"""

from rest_framework import serializers
from canvas.models import CanvasElement

class CanvasElementSerializer(serializers.ModelSerializer):
    """
    画布元素序列化器
    """
    style = serializers.JSONField(source='get_style', required=False)
    element_type_display = serializers.CharField(source='get_element_type_display', read_only=True)
    
    class Meta:
        model = CanvasElement
        fields = [
            'id', 'canvas', 'element_type', 'element_type_display', 
            'content', 'position_x', 'position_y', 'width', 'height', 
            'rotation', 'z_index', 'style', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'element_type_display', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        style_data = validated_data.pop('get_style', None)
        element = CanvasElement.objects.create(**validated_data)
        if style_data:
            element.set_style(style_data)
            element.save()
        return element
    
    def update(self, instance, validated_data):
        style_data = validated_data.pop('get_style', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if style_data:
            instance.set_style(style_data)
        instance.save()
        return instance
