"""
Whisper服务
"""

import logging
import json
import requests
import time
import os
import threading
from django.conf import settings
from django.utils import timezone
import whisper

from ..utils.netcheck import is_network_available
from .offline_whisper_service import OfflineWhisperService

logger = logging.getLogger('backend')

class WhisperService:
    """
    Whisper服务类
    处理与OpenAI Whisper API或本地Whisper模型的交互
    支持自动在在线和离线模式之间切换
    """

    # 单例模式
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(WhisperService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, use_api=None, offline_fallback=True):
        """
        初始化

        Args:
            use_api: 是否使用API，None表示自动检测
            offline_fallback: 在线模式失败时是否回退到离线模式
        """
        # 避免重复初始化
        if self._initialized:
            return

        self.api_key = settings.OPENAI_API_KEY
        self.api_base = "https://api.openai.com/v1/audio"
        self.offline_fallback = offline_fallback
        self.offline_service = OfflineWhisperService()

        # 自动检测网络状态
        if use_api is None:
            self.use_api = is_network_available() and self.api_key
        else:
            self.use_api = use_api

        logger.info(f"Whisper服务初始化完成，使用{'在线' if self.use_api else '离线'}模式")
        self._initialized = True

    def get_service_status(self):
        """
        获取服务状态

        Returns:
            dict: 服务状态
        """
        network_available = is_network_available()

        return {
            'mode': 'online' if self.use_api else 'offline',
            'network_available': network_available,
            'api_key_configured': bool(self.api_key),
            'offline_models': self.offline_service.get_available_models() if hasattr(self, 'offline_service') else [],
            'current_offline_model': self.offline_service.model_name if hasattr(self, 'offline_service') else None,
        }

    def transcribe(self, audio_file_path, language=None, model="whisper-1", force_mode=None):
        """
        转录音频

        Args:
            audio_file_path: 音频文件路径
            language: 语言代码
            model: 模型名称
            force_mode: 强制使用指定模式，可选值：'online', 'offline'

        Returns:
            dict: 转录结果
        """
        start_time = time.time()

        # 确定使用哪种模式
        use_online = self.use_api
        if force_mode == 'online':
            use_online = True
        elif force_mode == 'offline':
            use_online = False

        # 如果强制使用在线模式，但网络不可用，返回错误
        if use_online and force_mode == 'online' and not is_network_available():
            return {
                'status': 'failed',
                'error': '网络不可用，无法使用在线模式',
                'duration': time.time() - start_time
            }

        try:
            # 尝试使用选定的模式
            if use_online:
                try:
                    logger.info(f"使用在线模式转录音频: {audio_file_path}")
                    result = self._transcribe_api(audio_file_path, language, model)

                    # 计算处理时长
                    duration = time.time() - start_time
                    result['duration'] = duration
                    result['mode'] = 'online'

                    return result
                except Exception as e:
                    logger.error(f"在线转录失败: {e}")

                    # 如果允许回退到离线模式，且不是强制使用在线模式
                    if self.offline_fallback and force_mode != 'online':
                        logger.info("回退到离线模式")
                        return self.transcribe(audio_file_path, language, model, force_mode='offline')

                    # 否则返回错误
                    return {
                        'status': 'failed',
                        'error': f'在线转录失败: {str(e)}',
                        'duration': time.time() - start_time,
                        'mode': 'online'
                    }
            else:
                # 使用离线模式
                logger.info(f"使用离线模式转录音频: {audio_file_path}")
                result = self.offline_service.transcribe(audio_file_path, language)

                # 如果离线模式失败，且不是强制使用离线模式，尝试在线模式
                if result.get('status') == 'failed' and force_mode != 'offline' and is_network_available() and self.api_key:
                    logger.info("离线转录失败，尝试在线模式")
                    return self.transcribe(audio_file_path, language, model, force_mode='online')

                # 计算处理时长
                if 'duration' not in result:
                    result['duration'] = time.time() - start_time

                result['mode'] = 'offline'
                return result
        except Exception as e:
            logger.error(f"Whisper转录失败: {e}")
            return {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time,
                'mode': 'auto'
            }

    def _transcribe_api(self, audio_file_path, language=None, model="whisper-1"):
        """
        使用API转录音频

        Args:
            audio_file_path: 音频文件路径
            language: 语言代码
            model: 模型名称

        Returns:
            dict: 转录结果
        """
        if not self.api_key:
            logger.error("OpenAI API密钥未配置")
            raise ValueError("OpenAI API密钥未配置")

        try:
            # 构建请求数据
            headers = {
                "Authorization": f"Bearer {self.api_key}"
            }

            data = {
                "model": model,
                "response_format": "verbose_json"
            }

            if language:
                data["language"] = language

            # 发送请求
            with open(audio_file_path, "rb") as audio_file:
                files = {
                    "file": (os.path.basename(audio_file_path), audio_file, "audio/mpeg")
                }

                response = requests.post(
                    f"{self.api_base}/transcriptions",
                    headers=headers,
                    data=data,
                    files=files
                )

            # 检查响应
            if response.status_code != 200:
                logger.error(f"Whisper API请求失败: {response.status_code} {response.text}")
                raise ValueError(f"Whisper API请求失败: {response.status_code}")

            result = response.json()

            # 处理结果
            return {
                'status': 'completed',
                'text': result.get('text', ''),
                'segments': result.get('segments', []),
                'language': result.get('language', language)
            }
        except Exception as e:
            logger.error(f"Whisper API转录失败: {e}")
            raise

    def _transcribe_local(self, audio_file_path, language=None):
        """
        使用本地模型转录音频

        Args:
            audio_file_path: 音频文件路径
            language: 语言代码

        Returns:
            dict: 转录结果
        """
        if not self.model:
            logger.error("Whisper本地模型未加载")
            raise ValueError("Whisper本地模型未加载")

        try:
            # 转录选项
            options = {}
            if language:
                options["language"] = language

            # 执行转录
            result = self.model.transcribe(audio_file_path, **options)

            # 处理结果
            segments = []
            for segment in result.get('segments', []):
                segments.append({
                    'id': segment.get('id'),
                    'start': segment.get('start'),
                    'end': segment.get('end'),
                    'text': segment.get('text')
                })

            return {
                'status': 'completed',
                'text': result.get('text', ''),
                'segments': segments,
                'language': result.get('language', language)
            }
        except Exception as e:
            logger.error(f"Whisper本地转录失败: {e}")
            raise
