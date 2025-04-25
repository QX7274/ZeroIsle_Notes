"""
转录服务
"""

import logging
import os
import time
from django.db import transaction
from django.utils import timezone
from voice_recognition.models import AudioFile, Transcription, Language
from .whisper_service import WhisperService
from .xunfei_asr_service import XunfeiASRService
from .baidu_asr_service import BaiduASRService

logger = logging.getLogger('backend')

class TranscriptionService:
    """
    转录服务类
    处理音频转录的业务逻辑
    """
    
    def __init__(self):
        """初始化"""
        self.whisper_service = WhisperService(use_api=True)
        self.xunfei_service = XunfeiASRService()
        self.baidu_service = BaiduASRService()
    
    def create_transcription(self, audio_file, language_code=None, model="whisper-1", user=None):
        """
        创建转录
        
        Args:
            audio_file: 音频文件对象
            language_code: 语言代码
            model: 模型名称
            user: 用户对象
            
        Returns:
            Transcription: 创建的转录对象
        """
        try:
            # 获取语言对象
            language = None
            if language_code:
                language = Language.objects.filter(code=language_code, is_active=True).first()
            
            # 创建转录对象
            transcription = Transcription.objects.create(
                user=user or audio_file.user,
                audio_file=audio_file,
                language=language,
                model=model,
                status='pending'
            )
            
            return transcription
        except Exception as e:
            logger.error(f"创建转录失败: {e}")
            raise
    
    def process_transcription(self, transcription_id):
        """
        处理转录
        
        Args:
            transcription_id: 转录ID
            
        Returns:
            Transcription: 处理后的转录对象
        """
        try:
            # 获取转录对象
            transcription = Transcription.objects.get(id=transcription_id)
            
            # 检查状态
            if transcription.status != 'pending':
                logger.warning(f"转录 {transcription_id} 状态不是待处理: {transcription.status}")
                return transcription
            
            # 更新状态
            transcription.status = 'processing'
            transcription.save(update_fields=['status'])
            
            # 获取音频文件路径
            audio_file_path = transcription.audio_file.file.path
            
            # 检查文件是否存在
            if not os.path.exists(audio_file_path):
                transcription.status = 'failed'
                transcription.error_message = "音频文件不存在"
                transcription.save(update_fields=['status', 'error_message'])
                return transcription
            
            # 获取语言代码
            language_code = transcription.language.code if transcription.language else None
            
            # 根据模型选择服务
            if transcription.model.startswith('whisper'):
                result = self.whisper_service.transcribe(
                    audio_file_path=audio_file_path,
                    language=language_code,
                    model=transcription.model
                )
            elif transcription.model == 'xunfei':
                result = self.xunfei_service.transcribe(
                    audio_file_path=audio_file_path,
                    language=language_code
                )
            elif transcription.model == 'baidu':
                result = self.baidu_service.transcribe(
                    audio_file_path=audio_file_path,
                    language=language_code
                )
            else:
                transcription.status = 'failed'
                transcription.error_message = f"不支持的模型: {transcription.model}"
                transcription.save(update_fields=['status', 'error_message'])
                return transcription
            
            # 更新转录对象
            with transaction.atomic():
                transcription.status = result.get('status', 'failed')
                transcription.text = result.get('text', '')
                transcription.segments = result.get('segments', [])
                transcription.duration = result.get('duration', 0)
                
                if transcription.status == 'failed':
                    transcription.error_message = result.get('error', '未知错误')
                
                transcription.save()
                
                # 更新音频文件状态
                audio_file = transcription.audio_file
                audio_file.is_processed = True
                audio_file.save(update_fields=['is_processed'])
            
            return transcription
        except Transcription.DoesNotExist:
            logger.error(f"转录 {transcription_id} 不存在")
            raise
        except Exception as e:
            logger.error(f"处理转录失败: {e}")
            
            # 更新状态
            try:
                transcription = Transcription.objects.get(id=transcription_id)
                transcription.status = 'failed'
                transcription.error_message = str(e)
                transcription.save(update_fields=['status', 'error_message'])
                return transcription
            except:
                raise
    
    def get_transcription(self, transcription_id, user=None):
        """
        获取转录
        
        Args:
            transcription_id: 转录ID
            user: 用户对象
            
        Returns:
            Transcription: 转录对象
        """
        try:
            # 获取转录对象
            transcription = Transcription.objects.get(id=transcription_id)
            
            # 检查权限
            if user and transcription.user != user:
                raise ValueError("无权访问此转录")
            
            return transcription
        except Transcription.DoesNotExist:
            logger.error(f"转录 {transcription_id} 不存在")
            raise
        except Exception as e:
            logger.error(f"获取转录失败: {e}")
            raise
