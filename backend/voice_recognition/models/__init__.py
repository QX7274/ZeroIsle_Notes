"""
语音识别模块模型初始化文件
导入所有模型以便在其他地方直接从voice_recognition.models导入
"""

from .audio_file import AudioFile
from .transcription import Transcription
from .language import Language
from .speaker import Speaker
from .speaker_profile import SpeakerProfile, SpeakerEmbedding
