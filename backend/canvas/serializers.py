"""无限画布序列化器"""

from rest_framework import serializers
from .models import Canvas, CanvasElement, CanvasConnection


class CanvasElementSerializer(serializers.ModelSerializer):
    """
    画布元素序列化器
    """
    style = serializers.JSONField(source='get_style', required=False)
    
    class Meta:
        model = CanvasElement
        fields = ['id', 'canvas', 'element_type', 'content', 'position_x', 'position_y', 
                  'width', 'height', 'rotation', 'z_index', 'style', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
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


class CanvasConnectionSerializer(serializers.ModelSerializer):
    """
    画布连接序列化器
    """
    style = serializers.JSONField(source='get_style', required=False)
    
    class Meta:
        model = CanvasConnection
        fields = ['id', 'canvas', 'source', 'target', 'connection_type', 'label', 
                  'style', 'path_data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        style_data = validated_data.pop('get_style', None)
        connection = CanvasConnection.objects.create(**validated_data)
        if style_data:
            connection.set_style(style_data)
            connection.save()
        return connection
    
    def update(self, instance, validated_data):
        style_data = validated_data.pop('get_style', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if style_data:
            instance.set_style(style_data)
        instance.save()
        return instance


class CanvasSerializer(serializers.ModelSerializer):
    """
    画布序列化器
    """
    elements = CanvasElementSerializer(many=True, read_only=True)
    connections = CanvasConnectionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Canvas
        fields = ['id', 'title', 'description', 'user', 'is_public', 'view_count', 
                  'elements', 'connections', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'view_count', 'created_at', 'updated_at']