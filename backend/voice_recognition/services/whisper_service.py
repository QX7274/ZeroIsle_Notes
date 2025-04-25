"""
Whisper服务
"""

import logging
import json
import requests
import time
import os
from django.conf import settings
import whisper

logger = logging.getLogger('backend')

class WhisperService:
    """
    Whisper服务类
    处理与OpenAI Whisper API或本地Whisper模型的交互
    """
    
    def __init__(self, use_api=True):
        """
        初始化
        
        Args:
            use_api: 是否使用API，否则使用本地模型
        """
        self.use_api = use_api
        self.api_key = settings.OPENAI_API_KEY
        self.api_base = "https://api.openai.com/v1/audio"
        self.model = None
        
        if not use_api:
            # 加载本地模型
            self._load_model("base")
    
    def _load_model(self, model_size="base"):
        """
        加载本地模型
        
        Args:
            model_size: 模型大小，可选值：tiny, base, small, medium, large
        """
        try:
            self.model = whisper.load_model(model_size)
            logger.info(f"Whisper本地模型 {model_size} 加载成功")
        except Exception as e:
            logger.error(f"Whisper本地模型加载失败: {e}")
            self.model = None
    
    def transcribe(self, audio_file_path, language=None, model="whisper-1"):
        """
        转录音频
        
        Args:
            audio_file_path: 音频文件路径
            language: 语言代码
            model: 模型名称
            
        Returns:
            dict: 转录结果
        """
        start_time = time.time()
        
        try:
            if self.use_api:
                result = self._transcribe_api(audio_file_path, language, model)
            else:
                result = self._transcribe_local(audio_file_path, language)
            
            # 计算处理时长
            duration = time.time() - start_time
            result['duration'] = duration
            
            return result
        except Exception as e:
            logger.error(f"Whisper转录失败: {e}")
            return {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
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
