"""
Whisper服务
提供音频转写功能
"""

import os
import logging
from typing import Dict, Any, Optional
from django.conf import settings
import openai

logger = logging.getLogger(__name__)


class WhisperService:
    """
    Whisper服务
    提供音频转写功能
    """
    
    def __init__(self):
        """
        初始化Whisper服务
        """
        self.api_key = settings.OPENAI_API_KEY
        openai.api_key = self.api_key
    
    def transcribe(self, file_path: str, language: str = 'zh') -> Dict[str, Any]:
        """
        转写音频文件
        
        Args:
            file_path: 音频文件路径
            language: 语言代码
            
        Returns:
            转写结果
        """
        try:
            with open(file_path, 'rb') as audio_file:
                response = openai.Audio.transcribe(
                    model="whisper-1",
                    file=audio_file,
                    language=language
                )
            
            return {
                'text': response.get('text', ''),
                'language': response.get('language', language)
            }
            
        except Exception as e:
            logger.error(f"Whisper transcription error: {str(e)}")
            raise Exception(f"音频转写失败: {str(e)}")
    
    def translate(self, file_path: str, target_language: str = 'en') -> Dict[str, Any]:
        """
        翻译音频文件
        
        Args:
            file_path: 音频文件路径
            target_language: 目标语言代码
            
        Returns:
            翻译结果
        """
        try:
            with open(file_path, 'rb') as audio_file:
                response = openai.Audio.translate(
                    model="whisper-1",
                    file=audio_file,
                    target_language=target_language
                )
            
            return {
                'text': response.get('text', ''),
                'language': target_language
            }
            
        except Exception as e:
            logger.error(f"Whisper translation error: {str(e)}")
            raise Exception(f"音频翻译失败: {str(e)}")
    
    def detect_language(self, file_path: str) -> str:
        """
        检测音频文件的语言
        
        Args:
            file_path: 音频文件路径
            
        Returns:
            语言代码
        """
        try:
            with open(file_path, 'rb') as audio_file:
                response = openai.Audio.transcribe(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json"
                )
            
            return response.get('language', 'unknown')
            
        except Exception as e:
            logger.error(f"Whisper language detection error: {str(e)}")
            raise Exception(f"语言检测失败: {str(e)}")
