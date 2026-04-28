"""
Whisper服务
提供音频转写功能（升级：输入校验/统一SDK/错误分类/审计信息）
"""

import os
import time
import uuid
import logging
import mimetypes
from typing import Dict, Any

from .base_provider import get_openai_client, classify_openai_error

logger = logging.getLogger(__name__)


class WhisperService:
    """
    Whisper服务
    - 使用 OpenAI v1 SDK（client.audio.transcriptions.create）
    - 输入校验（存在性/扩展名/大小）
    - 结构化返回（text/language/model/trace/duration/file_size）
    - 错误分类日志
    """

    ALLOWED_EXTENSIONS = {'.wav', '.mp3', '.m4a', '.webm', '.ogg', '.flac'}
    MAX_FILE_MB = 25  # 可按需从 settings 覆盖

    def _validate_file(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError("音频文件不存在")
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的音频格式: {ext}")
        size_mb = os.path.getsize(file_path) / (1024 * 1024)
        if size_mb > self.MAX_FILE_MB:
            raise ValueError(f"文件过大（{size_mb:.1f}MB），上限 {self.MAX_FILE_MB}MB")
        return size_mb

    def transcribe(self, file_path: str, language: str = 'zh') -> Dict[str, Any]:
        """转写音频，返回结构化信息"""
        trace_id = uuid.uuid4().hex
        t0 = time.time()
        try:
            size_mb = self._validate_file(file_path)
            client = get_openai_client()
            with open(file_path, 'rb') as audio_file:
                resp = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language=language
                )
            text = getattr(resp, 'text', '') or (resp.get('text') if isinstance(resp, dict) else '')
            duration_ms = int((time.time() - t0) * 1000)
            return {
                'text': text,
                'language': language,
                'model': 'whisper-1',
                'trace_id': trace_id,
                'duration_ms': duration_ms,
                'file_size_mb': round(size_mb, 2),
            }
        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"Whisper transcription error[{category}] (trace_id={trace_id}): {e}")
            raise Exception(f"音频转写失败[{category}]: {str(e)}")

    def translate(self, file_path: str, target_language: str = 'en') -> Dict[str, Any]:
        """翻译音频到英文（通过 translate=True）"""
        trace_id = uuid.uuid4().hex
        t0 = time.time()
        try:
            size_mb = self._validate_file(file_path)
            client = get_openai_client()
            with open(file_path, 'rb') as audio_file:
                resp = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    translate=True
                )
            text = getattr(resp, 'text', '') or (resp.get('text') if isinstance(resp, dict) else '')
            duration_ms = int((time.time() - t0) * 1000)
            return {
                'text': text,
                'language': 'en',
                'model': 'whisper-1',
                'trace_id': trace_id,
                'duration_ms': duration_ms,
                'file_size_mb': round(size_mb, 2),
            }
        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"Whisper translation error[{category}] (trace_id={trace_id}): {e}")
            raise Exception(f"音频翻译失败[{category}]: {str(e)}")

    def detect_language(self, file_path: str) -> str:
        """尝试检测语言；若接口不返回语言，则回退 unknown"""
        trace_id = uuid.uuid4().hex
        try:
            client = get_openai_client()
            with open(file_path, 'rb') as audio_file:
                resp = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
            lang = getattr(resp, 'language', None)
            if lang:
                return lang
            if isinstance(resp, dict):
                return resp.get('language', 'unknown')
            return 'unknown'
        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"Whisper language detection error[{category}] (trace_id={trace_id}): {e}")
            raise Exception(f"语言检测失败[{category}]: {str(e)}")
