"""
绘图路径序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import DrawingPath, Note


class DrawingPathSerializer(serializers.Serializer):
    """
    绘图路径序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    note = serializers.UUIDField(source='note.id', required=False, allow_null=True)
    canvas_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    tool_type = serializers.ChoiceField(
        choices=['shape', 'text', 'image'],
        required=True
    )
    shape_type = serializers.ChoiceField(
        choices=['line', 'rectangle', 'circle', 'triangle', 'arrow', 'diamond', 'pentagon', 'hexagon', 'star', 'cloud'],
        required=False,
        allow_blank=True
    )
    path_data = serializers.DictField(required=True)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True)
    stroke_width = serializers.IntegerField(required=False, allow_null=True)
    is_deleted = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        """
        创建绘图路径
        """
        from django.utils import timezone
        import uuid

        user = self.context['request'].user

        # 处理笔记引用
        note_id = validated_data.get('note', {}).get('id') if validated_data.get('note') else None
        note = None
        if note_id:
            try:
                note = Note.objects.get(id=note_id)
            except Note.DoesNotExist:
                pass

        drawing_path = DrawingPath(
            id=uuid.uuid4(),
            user=user,
            note=note,
            canvas_id=validated_data.get('canvas_id', ''),
            tool_type=validated_data.get('tool_type'),
            shape_type=validated_data.get('shape_type', ''),
            path_data=validated_data.get('path_data'),
            color=validated_data.get('color', ''),
            stroke_width=validated_data.get('stroke_width'),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        drawing_path.save()
        return drawing_path

    def update(self, instance, validated_data):
        """
        更新绘图路径
        """
        instance.canvas_id = validated_data.get('canvas_id', instance.canvas_id)
        instance.tool_type = validated_data.get('tool_type', instance.tool_type)
        instance.shape_type = validated_data.get('shape_type', instance.shape_type)
        instance.path_data = validated_data.get('path_data', instance.path_data)
        instance.color = validated_data.get('color', instance.color)
        instance.stroke_width = validated_data.get('stroke_width', instance.stroke_width)

        # 处理笔记引用更新
        if 'note' in validated_data:
            note_data = validated_data.get('note')
            if note_data and note_data.get('id'):
                try:
                    instance.note = Note.objects.get(id=note_data['id'])
                except Note.DoesNotExist:
                    instance.note = None
            else:
                instance.note = None

        instance.save()
        return instance


class DrawingPathListSerializer(serializers.Serializer):
    """
    绘图路径列表序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    note = serializers.UUIDField(source='note.id', read_only=True)
    note_title = serializers.CharField(source='note.title', read_only=True)
    canvas_id = serializers.CharField(read_only=True)
    tool_type = serializers.CharField(read_only=True)
    shape_type = serializers.CharField(read_only=True)
    color = serializers.CharField(read_only=True)
    stroke_width = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)



