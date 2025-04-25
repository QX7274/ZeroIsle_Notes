"""
画布连接序列化器
"""

from rest_framework import serializers
from canvas.models import CanvasConnection

class CanvasConnectionSerializer(serializers.ModelSerializer):
    """
    画布连接序列化器
    """
    style = serializers.JSONField(source='get_style', required=False)
    connection_type_display = serializers.CharField(source='get_connection_type_display', read_only=True)
    
    class Meta:
        model = CanvasConnection
        fields = [
            'id', 'canvas', 'source', 'target', 'connection_type', 
            'connection_type_display', 'label', 'style', 'path_data', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'connection_type_display', 'created_at', 'updated_at']
    
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
