"""
离线Whisper服务
提供离线语音识别功能
"""

import os
import logging
import time
import json
import shutil
import requests
import zipfile
from pathlib import Path
from django.conf import settings
from django.utils import timezone

# 尝试导入whisper，如果没有安装则提供一个占位符
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    whisper = None

logger = logging.getLogger('backend')

# 模型信息
WHISPER_MODELS = {
    'tiny': {
        'name': 'tiny',
        'size': '75M',
        'description': '最小模型，速度最快，准确率较低',
        'download_url': 'https://openaipublic.azureedge.net/main/whisper/models/d3dd57d32accea0b295c96e26691aa14d8822fac7d9d27d5dc00b4ca2826dd03/tiny.en.pt',
    },
    'base': {
        'name': 'base',
        'size': '142M',
        'description': '基础模型，速度较快，准确率适中',
        'download_url': 'https://openaipublic.azureedge.net/main/whisper/models/ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e/base.pt',
    },
    'small': {
        'name': 'small',
        'size': '466M',
        'description': '小型模型，速度和准确率平衡',
        'download_url': 'https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba49c06d968637d720dd632c55bbf19d441fb42bf17a411e794/small.pt',
    }
}

class OfflineWhisperService:
    """
    离线Whisper服务类
    提供离线语音识别功能
    """
    
    def __init__(self):
        """初始化"""
        self.models_dir = self._get_models_dir()
        self.current_model = None
        self.model_name = 'base'  # 默认使用base模型
        
        # 确保模型目录存在
        os.makedirs(self.models_dir, exist_ok=True)
        
        # 检查是否安装了whisper
        if not WHISPER_AVAILABLE:
            logger.warning("Whisper未安装，离线语音识别功能不可用")
            return
        
        # 尝试加载默认模型
        self._load_model(self.model_name)
    
    def _get_models_dir(self):
        """获取模型目录"""
        # 使用项目根目录下的models目录
        base_dir = getattr(settings, 'BASE_DIR', None)
        if base_dir:
            return os.path.join(base_dir, 'models', 'whisper')
        
        # 如果没有设置BASE_DIR，使用当前目录
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models', 'whisper')
    
    def _load_model(self, model_name):
        """
        加载模型
        
        Args:
            model_name: 模型名称，可选值：tiny, base, small
        
        Returns:
            bool: 是否成功加载模型
        """
        if not WHISPER_AVAILABLE:
            logger.warning("Whisper未安装，无法加载模型")
            return False
        
        try:
            # 检查模型是否存在
            if not self._check_model_exists(model_name):
                logger.warning(f"模型 {model_name} 不存在，尝试下载")
                if not self._download_model(model_name):
                    logger.error(f"下载模型 {model_name} 失败")
                    return False
            
            # 加载模型
            start_time = time.time()
            self.current_model = whisper.load_model(model_name, download_root=self.models_dir)
            duration = time.time() - start_time
            
            logger.info(f"成功加载模型 {model_name}，耗时 {duration:.2f} 秒")
            self.model_name = model_name
            return True
        except Exception as e:
            logger.error(f"加载模型 {model_name} 失败: {e}")
            self.current_model = None
            return False
    
    def _check_model_exists(self, model_name):
        """
        检查模型是否存在
        
        Args:
            model_name: 模型名称
        
        Returns:
            bool: 模型是否存在
        """
        # 检查模型文件是否存在
        model_path = os.path.join(self.models_dir, f"{model_name}.pt")
        return os.path.exists(model_path)
    
    def _download_model(self, model_name):
        """
        下载模型
        
        Args:
            model_name: 模型名称
        
        Returns:
            bool: 是否成功下载模型
        """
        if model_name not in WHISPER_MODELS:
            logger.error(f"未知模型: {model_name}")
            return False
        
        model_info = WHISPER_MODELS[model_name]
        download_url = model_info['download_url']
        model_path = os.path.join(self.models_dir, f"{model_name}.pt")
        
        try:
            logger.info(f"开始下载模型 {model_name} 从 {download_url}")
            
            # 下载模型
            response = requests.get(download_url, stream=True)
            response.raise_for_status()
            
            # 保存模型
            with open(model_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"成功下载模型 {model_name}")
            return True
        except Exception as e:
            logger.error(f"下载模型 {model_name} 失败: {e}")
            
            # 删除可能部分下载的文件
            if os.path.exists(model_path):
                os.remove(model_path)
            
            return False
    
    def get_available_models(self):
        """
        获取可用模型列表
        
        Returns:
            list: 可用模型列表
        """
        available_models = []
        
        for model_name, model_info in WHISPER_MODELS.items():
            model_path = os.path.join(self.models_dir, f"{model_name}.pt")
            available_models.append({
                'name': model_name,
                'size': model_info['size'],
                'description': model_info['description'],
                'is_downloaded': os.path.exists(model_path),
                'is_current': model_name == self.model_name
            })
        
        return available_models
    
    def transcribe(self, audio_file_path, language=None):
        """
        转录音频
        
        Args:
            audio_file_path: 音频文件路径
            language: 语言代码
            
        Returns:
            dict: 转录结果
        """
        if not WHISPER_AVAILABLE:
            return {
                'status': 'failed',
                'error': 'Whisper未安装，离线语音识别功能不可用'
            }
        
        if not self.current_model:
            if not self._load_model(self.model_name):
                return {
                    'status': 'failed',
                    'error': '模型加载失败'
                }
        
        start_time = time.time()
        
        try:
            # 转录选项
            options = {}
            if language:
                options["language"] = language
            
            # 执行转录
            result = self.current_model.transcribe(audio_file_path, **options)
            
            # 处理结果
            segments = []
            for segment in result.get('segments', []):
                segments.append({
                    'id': segment.get('id'),
                    'start': segment.get('start'),
                    'end': segment.get('end'),
                    'text': segment.get('text')
                })
            
            # 计算处理时长
            duration = time.time() - start_time
            
            return {
                'status': 'completed',
                'text': result.get('text', ''),
                'segments': segments,
                'language': result.get('language', language),
                'duration': duration,
                'model': self.model_name,
                'offline': True
            }
        except Exception as e:
            logger.error(f"离线转录失败: {e}")
            return {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
    
    def change_model(self, model_name):
        """
        更改模型
        
        Args:
            model_name: 模型名称
            
        Returns:
            bool: 是否成功更改模型
        """
        if model_name not in WHISPER_MODELS:
            logger.error(f"未知模型: {model_name}")
            return False
        
        return self._load_model(model_name)
    
    def delete_model(self, model_name):
        """
        删除模型
        
        Args:
            model_name: 模型名称
            
        Returns:
            bool: 是否成功删除模型
        """
        if model_name not in WHISPER_MODELS:
            logger.error(f"未知模型: {model_name}")
            return False
        
        model_path = os.path.join(self.models_dir, f"{model_name}.pt")
        
        if not os.path.exists(model_path):
            logger.warning(f"模型 {model_name} 不存在")
            return False
        
        try:
            # 如果是当前模型，先卸载
            if model_name == self.model_name:
                self.current_model = None
                self.model_name = None
            
            # 删除模型文件
            os.remove(model_path)
            logger.info(f"成功删除模型 {model_name}")
            
            return True
        except Exception as e:
            logger.error(f"删除模型 {model_name} 失败: {e}")
            return False
