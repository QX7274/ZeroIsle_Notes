"""
音频服务
"""

import logging
import os
import tempfile
import requests
import mimetypes
from django.core.files import File
from django.utils import timezone
from voice_recognition.models import AudioFile

logger = logging.getLogger('backend')

class AudioService:
    """
    音频服务类
    处理音频文件的业务逻辑
    """
    
    @staticmethod
    def create_audio_file(file, user, audio_type='upload'):
        """
        创建音频文件
        
        Args:
            file: 文件对象
            user: 用户对象
            audio_type: 音频类型
            
        Returns:
            AudioFile: 创建的音频文件对象
        """
        try:
            # 获取文件信息
            file_name = file.name
            file_size = file.size
            file_type = file.content_type or mimetypes.guess_type(file_name)[0] or 'audio/mpeg'
            
            # 创建音频文件对象
            audio_file = AudioFile.objects.create(
                user=user,
                file=file,
                file_name=file_name,
                file_size=file_size,
                file_type=file_type,
                audio_type=audio_type
            )
            
            return audio_file
        except Exception as e:
            logger.error(f"创建音频文件失败: {e}")
            raise
    
    @staticmethod
    def create_audio_file_from_url(url, user):
        """
        从URL创建音频文件
        
        Args:
            url: 音频文件URL
            user: 用户对象
            
        Returns:
            AudioFile: 创建的音频文件对象
        """
        try:
            # 下载文件
            response = requests.get(url, stream=True)
            
            # 检查响应
            if response.status_code != 200:
                logger.error(f"下载音频文件失败: {response.status_code}")
                raise ValueError(f"下载音频文件失败: {response.status_code}")
            
            # 获取文件信息
            file_name = os.path.basename(url) or f"audio_{timezone.now().strftime('%Y%m%d%H%M%S')}"
            file_type = response.headers.get('Content-Type') or mimetypes.guess_type(url)[0] or 'audio/mpeg'
            file_size = int(response.headers.get('Content-Length', 0))
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            
            # 创建音频文件对象
            with open(temp_file_path, 'rb') as f:
                django_file = File(f, name=file_name)
                audio_file = AudioFile.objects.create(
                    user=user,
                    file=django_file,
                    file_name=file_name,
                    file_size=file_size or os.path.getsize(temp_file_path),
                    file_type=file_type,
                    audio_type='url',
                    source_url=url
                )
            
            # 删除临时文件
            os.unlink(temp_file_path)
            
            return audio_file
        except Exception as e:
            logger.error(f"从URL创建音频文件失败: {e}")
            raise
    
    @staticmethod
    def get_audio_file(audio_file_id, user=None):
        """
        获取音频文件
        
        Args:
            audio_file_id: 音频文件ID
            user: 用户对象
            
        Returns:
            AudioFile: 音频文件对象
        """
        try:
            # 获取音频文件对象
            audio_file = AudioFile.objects.get(id=audio_file_id, is_deleted=False)
            
            # 检查权限
            if user and audio_file.user != user:
                raise ValueError("无权访问此音频文件")
            
            return audio_file
        except AudioFile.DoesNotExist:
            logger.error(f"音频文件 {audio_file_id} 不存在")
            raise
        except Exception as e:
            logger.error(f"获取音频文件失败: {e}")
            raise
    
    @staticmethod
    def delete_audio_file(audio_file_id, user=None, delete_file=True):
        """
        删除音频文件
        
        Args:
            audio_file_id: 音频文件ID
            user: 用户对象
            delete_file: 是否删除文件
            
        Returns:
            bool: 是否成功
        """
        try:
            # 获取音频文件对象
            audio_file = AudioFile.objects.get(id=audio_file_id, is_deleted=False)
            
            # 检查权限
            if user and audio_file.user != user:
                raise ValueError("无权删除此音频文件")
            
            # 删除音频文件
            audio_file.delete(delete_file=delete_file)
            
            return True
        except AudioFile.DoesNotExist:
            logger.error(f"音频文件 {audio_file_id} 不存在")
            raise
        except Exception as e:
            logger.error(f"删除音频文件失败: {e}")
            raise
