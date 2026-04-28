"""
语音识别模块服务初始化文件
导入所有服务以便在其他地方直接从voice_recognition.services导入
"""

try:
    from .whisper_service import WhisperService
except Exception:
    class WhisperService:  # type: ignore
        def __init__(self, *args, **kwargs):
            raise ImportError("WhisperService依赖未安装（缺少whisper）")

from .xunfei_asr_service import XunfeiASRService
from .baidu_asr_service import BaiduASRService
from .transcription_service import TranscriptionService
from .audio_service import AudioService
from .diarization_service import DiarizationService
from .text_processing_service import TextProcessingService
from .voice_command_service import VoiceCommandService
from .speaker_recognition_service import SpeakerRecognitionService
from .realtime_transcription_service import RealtimeTranscriptionService

__all__ = [
    'WhisperService',
    'XunfeiASRService',
    'BaiduASRService',
    'TranscriptionService',
    'AudioService',
    'DiarizationService',
    'TextProcessingService',
    'VoiceCommandService',
    'SpeakerRecognitionService',
    'RealtimeTranscriptionService',
]
