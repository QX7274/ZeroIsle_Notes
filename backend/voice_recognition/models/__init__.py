"""
语音识别模块模型初始化文件
导入所有模型以便在其他地方直接从voice_recognition.models导入
"""

# 从MongoDB模型导入
from ..mongodb_models import AudioFile, Transcription, Language, Speaker, SpeakerProfile, SpeakerEmbedding
