"""
语音识别模块序列化器初始化文件
导入所有序列化器以便在其他地方直接从voice_recognition.serializers导入
"""

from .audio_file import (
    AudioFileSerializer,
    AudioFileListSerializer,
    AudioFileDetailSerializer,
    AudioFileCreateSerializer
)
from .transcription import (
    TranscriptionSerializer,
    TranscriptionListSerializer,
    TranscriptionDetailSerializer,
    TranscriptionCreateSerializer
)
from .language import LanguageSerializer
from .speaker import SpeakerSerializer
