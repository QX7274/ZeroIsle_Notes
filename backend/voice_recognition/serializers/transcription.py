"""
转录序列化器
"""

from rest_framework import serializers
from voice_recognition.models import Transcription, AudioFile, Language
from users.serializers import UserSerializer

class TranscriptionSerializer(serializers.ModelSerializer):
    """转录基础序列化器"""
    class Meta:
        model = Transcription
        fields = [
            'id', 'audio_file', 'language', 'model',
            'text', 'segments', 'status', 'error_message',
            'duration', 'is_speaker_diarization',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'text', 'segments', 'status', 'error_message', 'duration', 'created_at', 'updated_at']

class TranscriptionListSerializer(serializers.ModelSerializer):
    """转录列表序列化器"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    model_display = serializers.CharField(source='get_model_display', read_only=True)
    audio_file_name = serializers.CharField(source='audio_file.file_name', read_only=True)
    language_name = serializers.CharField(source='language.name', read_only=True)
    word_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Transcription
        fields = [
            'id', 'audio_file', 'audio_file_name', 'language',
            'language_name', 'model', 'model_display', 'status',
            'status_display', 'duration', 'word_count',
            'created_at'
        ]
        read_only_fields = ['id', 'status', 'status_display', 'duration', 'word_count', 'created_at']

class TranscriptionDetailSerializer(serializers.ModelSerializer):
    """转录详情序列化器"""
    user = UserSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    model_display = serializers.CharField(source='get_model_display', read_only=True)
    audio_file = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    word_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Transcription
        fields = [
            'id', 'audio_file', 'language', 'model', 'model_display',
            'text', 'segments', 'status', 'status_display',
            'error_message', 'duration', 'is_speaker_diarization',
            'word_count', 'created_at', 'updated_at', 'user'
        ]
        read_only_fields = ['id', 'text', 'segments', 'status', 'status_display', 'error_message', 'duration', 'word_count', 'created_at', 'updated_at', 'user']
    
    def get_audio_file(self, obj):
        """获取音频文件信息"""
        from voice_recognition.serializers import AudioFileSerializer
        return AudioFileSerializer(obj.audio_file).data
    
    def get_language(self, obj):
        """获取语言信息"""
        if obj.language:
            from voice_recognition.serializers import LanguageSerializer
            return LanguageSerializer(obj.language).data
        return None

class TranscriptionCreateSerializer(serializers.ModelSerializer):
    """转录创建序列化器"""
    audio_file_id = serializers.PrimaryKeyRelatedField(
        queryset=AudioFile.objects.all(),
        source='audio_file',
        write_only=True
    )
    language_code = serializers.CharField(required=False, write_only=True)
    
    class Meta:
        model = Transcription
        fields = [
            'audio_file_id', 'language_code', 'model'
        ]
    
    def validate_audio_file_id(self, value):
        """验证音频文件ID"""
        user = self.context['request'].user
        
        # 检查音频文件是否属于当前用户
        if value.user != user:
            raise serializers.ValidationError("无权访问此音频文件")
        
        return value
    
    def validate_language_code(self, value):
        """验证语言代码"""
        if value:
            try:
                language = Language.objects.get(code=value, is_active=True)
                return value
            except Language.DoesNotExist:
                raise serializers.ValidationError("不支持的语言")
        return value
    
    def create(self, validated_data):
        """创建转录"""
        from voice_recognition.services import TranscriptionService
        
        audio_file = validated_data.get('audio_file')
        language_code = validated_data.pop('language_code', None)
        model = validated_data.get('model', 'whisper-1')
        user = self.context['request'].user
        
        # 创建转录
        transcription_service = TranscriptionService()
        transcription = transcription_service.create_transcription(
            audio_file=audio_file,
            language_code=language_code,
            model=model,
            user=user
        )
        
        return transcription
