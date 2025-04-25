"""
语音识别模块视图初始化文件
导入所有视图以便在其他地方直接从voice_recognition.views导入
"""

from .audio_file import AudioFileViewSet
from .transcription import TranscriptionViewSet
from .language import LanguageViewSet
from .speaker import SpeakerViewSet
