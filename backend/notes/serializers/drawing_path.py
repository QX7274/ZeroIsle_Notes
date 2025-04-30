"""
绘图路径序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import DrawingPath, Note
from users.serializers import UserSerializer

class DrawingPathSerializer(serializers.Serializer):
    """
    绘图路径序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = UserSerializer(read_only=True)
    note = serializers.PrimaryKeyRelatedField(queryset=Note.objects.all(), required=False, allow_null=True)
    canvas_id = serializers.CharField(required=False, allow_blank=True)
    tool_type = serializers.ChoiceField(choices=('pen', 'pencil', 'highlighter', 'eraser', 'shape'), required=True)
    shape_type = serializers.ChoiceField(choices=('line', 'rectangle', 'circle', 'triangle', 'arrow'), required=False, allow_null=True)
    path_data = serializers.DictField(required=True)
    color = serializers.CharField(required=False, allow_blank=True)
    stroke_width = serializers.IntegerField(required=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    def validate(self, data):
        """
        验证数据
        """
        # 如果工具类型是形状，则必须提供形状类型
        if data.get('tool_type') == 'shape' and not data.get('shape_type'):
            raise serializers.ValidationError("形状工具必须提供形状类型")
        
        # 必须提供笔记ID或画布ID
        if not data.get('note') and not data.get('canvas_id'):
            raise serializers.ValidationError("必须提供笔记ID或画布ID")
        
        return data
    
    def create(self, validated_data):
        """
        创建绘图路径
        """
        user = self.context['request'].user
        validated_data['user'] = user
        drawing_path = DrawingPath(**validated_data)
        drawing_path.save()
        return drawing_path
    
    def update(self, instance, validated_data):
        """
        更新绘图路径
        """
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class DrawingPathListSerializer(serializers.Serializer):
    """
    绘图路径列表序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note_id = serializers.UUIDField(source='note.id', read_only=True)
    canvas_id = serializers.CharField(read_only=True)
    tool_type = serializers.CharField(read_only=True)
    shape_type = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
