"""
语音命令视图
"""

import os
import tempfile
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from voice_recognition.models import AudioFile
from voice_recognition.services import WhisperService, VoiceCommandService

logger = logging.getLogger('backend')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_voice_command(request):
    """
    处理语音命令API
    识别并执行语音命令
    """
    try:
        # 获取音频文件
        audio_file = request.FILES.get('audio')
        audio_base64 = request.data.get('audio_base64')
        
        if not audio_file and not audio_base64:
            return Response(
                {'error': '未提供音频文件或音频数据'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            if audio_file:
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
            else:
                # 处理Base64编码的音频数据
                import base64
                audio_data = base64.b64decode(audio_base64)
                temp_file.write(audio_data)
            
            temp_file_path = temp_file.name
        
        # 创建音频文件记录
        audio_file_obj = AudioFile.objects.create(
            user=request.user,
            file_type='audio/wav',
            duration=0,  # 暂时设为0，后续更新
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        
        # 保存音频文件
        with open(temp_file_path, 'rb') as f:
            audio_file_obj.file.put(f, content_type='audio/wav')
        
        # 调用Whisper服务转换为文本
        whisper_service = WhisperService()
        result = whisper_service.transcribe(temp_file_path, 'zh')
        
        # 删除临时文件
        os.unlink(temp_file_path)
        
        if result.get('status') == 'failed':
            return Response(
                {'error': result.get('error', '语音识别失败')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # 获取识别的文本
        command_text = result.get('text', '')
        
        if not command_text:
            return Response(
                {'error': '未能识别出有效的命令'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 调用语音命令服务处理命令
        command_service = VoiceCommandService()
        command_result = command_service.process_command(
            user=request.user,
            command_text=command_text
        )
        
        # 返回结果
        return Response({
            'recognized_text': command_text,
            'command': command_result.get('command', ''),
            'action': command_result.get('action', ''),
            'parameters': command_result.get('parameters', {}),
            'result': command_result.get('result', {}),
            'success': command_result.get('success', False),
            'message': command_result.get('message', '')
        })
    
    except Exception as e:
        logger.error(f"处理语音命令失败: {str(e)}")
        return Response(
            {'error': f'处理语音命令失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
