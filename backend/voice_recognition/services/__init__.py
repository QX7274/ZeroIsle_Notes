"""
语音识别模块服务初始化文件
导入所有服务以便在其他地方直接从voice_recognition.services导入
"""

from .whisper_service import WhisperService
from .xunfei_asr_service import XunfeiASRService
from .baidu_asr_service import BaiduASRService
from .transcription_service import TranscriptionService
from .audio_service import AudioService
from .diarization_service import DiarizationService
