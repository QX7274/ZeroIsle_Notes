"""
音频文件序列化器
"""

from rest_framework import serializers
from voice_recognition.models import AudioFile
from users.serializers import UserSerializer

class AudioFileSerializer(serializers.ModelSerializer):
    """音频文件基础序列化器"""
    class Meta:
        model = AudioFile
        fields = [
            'id', 'file', 'file_name', 'file_size', 'file_type',
            'duration', 'audio_type', 'source_url', 'is_processed',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'file_size', 'duration', 'is_processed', 'created_at', 'updated_at']

class AudioFileListSerializer(serializers.ModelSerializer):
    """音频文件列表序列化器"""
    audio_type_display = serializers.CharField(source='get_audio_type_display', read_only=True)
    transcription_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = AudioFile
        fields = [
            'id', 'file_name', 'file_size', 'file_type',
            'duration', 'audio_type', 'audio_type_display',
            'is_processed', 'created_at', 'transcription_count'
        ]
        read_only_fields = ['id', 'file_size', 'duration', 'is_processed', 'created_at', 'transcription_count']

class AudioFileDetailSerializer(serializers.ModelSerializer):
    """音频文件详情序列化器"""
    user = UserSerializer(read_only=True)
    audio_type_display = serializers.CharField(source='get_audio_type_display', read_only=True)
    transcriptions = serializers.SerializerMethodField()
    
    class Meta:
        model = AudioFile
        fields = [
            'id', 'file', 'file_name', 'file_size', 'file_type',
            'duration', 'audio_type', 'audio_type_display', 'source_url',
            'is_processed', 'created_at', 'updated_at',
            'user', 'transcriptions'
        ]
        read_only_fields = ['id', 'file_size', 'duration', 'is_processed', 'created_at', 'updated_at', 'user', 'transcriptions']
    
    def get_transcriptions(self, obj):
        """获取转录列表"""
        from voice_recognition.serializers import TranscriptionListSerializer
        transcriptions = obj.transcriptions.all()
        return TranscriptionListSerializer(transcriptions, many=True).data

class AudioFileCreateSerializer(serializers.ModelSerializer):
    """音频文件创建序列化器"""
    file = serializers.FileField(required=True)
    source_url = serializers.URLField(required=False)
    
    class Meta:
        model = AudioFile
        fields = [
            'file', 'file_name', 'audio_type', 'source_url'
        ]
    
    def validate(self, data):
        """验证数据"""
        # 如果是URL类型，必须提供source_url
        if data.get('audio_type') == 'url' and not data.get('source_url'):
            raise serializers.ValidationError({'source_url': '当音频类型为URL时，必须提供源URL'})
        
        # 如果未提供文件名，使用上传文件的名称
        if not data.get('file_name') and data.get('file'):
            data['file_name'] = data['file'].name
        
        return data
