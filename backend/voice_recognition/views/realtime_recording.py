"""
实时录音和转录视图
支持实时录音、流式转录和实时会议纪要生成
"""

import os
import tempfile
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
import base64
import uuid

from voice_recognition.mongodb_models import Transcription, AudioFile, Language
from voice_recognition.services import (
    WhisperService,
    XunfeiASRService,
    BaiduASRService,
    RealtimeTranscriptionService,
    TextProcessingService
)
from users.middleware import get_mongo_user

logger = logging.getLogger('backend')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_recording(request):
    """
    开始录音会话
    创建一个新的录音会话，返回会话ID
    """
    try:
        language_code = request.data.get('language', 'zh')
        engine = request.data.get('engine', 'whisper')
        enable_realtime = request.data.get('enable_realtime', False)
        
        # 获取语言
        try:
            language = Language.objects.get(code=language_code)
        except Language.DoesNotExist:
            language = None
        
        # 创建音频文件记录
        unique_id = str(uuid.uuid4())
        audio_file_obj = AudioFile(
            user=get_mongo_user(request.user),
            file_path=f"pending_recording_{unique_id}.wav",
            file_name=f"recording_{unique_id}.wav",
            file_size=0,
            file_type='audio/wav',
            duration=0,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        audio_file_obj.save()
        
        # 创建转录记录
        transcription = Transcription(
            user=get_mongo_user(request.user),
            audio_file=audio_file_obj,
            text='',  # 初始为空
            language=language,
            model=engine,
            status='recording',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        transcription.save()
        
        return Response({
            'session_id': str(transcription.id),
            'audio_file_id': str(audio_file_obj.id),
            'language': language_code,
            'engine': engine,
            'enable_realtime': enable_realtime,
            'status': 'recording'
        })
        
    except Exception as e:
        logger.error(f"开始录音失败: {str(e)}")
        return Response(
            {'error': f'开始录音失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_audio_chunk(request):
    """
    上传音频片段
    支持流式上传音频数据，用于实时转录
    """
    try:
        session_id = request.data.get('session_id')
        audio_chunk = request.data.get('audio_chunk')  # Base64编码的音频数据
        chunk_index = request.data.get('chunk_index', 0)
        is_final = request.data.get('is_final', False)
        
        if not session_id or not audio_chunk:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取转录记录
        try:
            transcription = Transcription.objects.get(
                id=session_id,
                user=get_mongo_user(request.user)
            )
        except Transcription.DoesNotExist:
            return Response(
                {'error': '录音会话不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 解码音频数据
        audio_data = base64.b64decode(audio_chunk)
        
        # 保存音频片段到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name
        
        # 如果启用实时转录，立即处理
        partial_text = ""
        if transcription.model == 'whisper':
            whisper_service = WhisperService()
            result = whisper_service.transcribe(temp_file_path, transcription.language.code if transcription.language else 'zh')
            partial_text = result.get('text', '')
        
        # 删除临时文件
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        
        # 如果是最后一个片段，更新状态
        if is_final:
            transcription.status = 'pending'
            transcription.save()
        
        return Response({
            'session_id': session_id,
            'chunk_index': chunk_index,
            'partial_text': partial_text,
            'is_final': is_final,
            'status': transcription.status
        })
        
    except Exception as e:
        logger.error(f"上传音频片段失败: {str(e)}")
        return Response(
            {'error': f'上传音频片段失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_recording(request):
    """
    停止录音会话
    完成录音并开始完整转录
    """
    try:
        session_id = request.data.get('session_id')
        audio_file = request.FILES.get('audio')
        audio_base64 = request.data.get('audio_base64')
        
        if not session_id:
            return Response(
                {'error': '缺少会话ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取转录记录
        try:
            transcription = Transcription.objects.get(
                id=session_id,
                user=get_mongo_user(request.user)
            )
        except Transcription.DoesNotExist:
            return Response(
                {'error': '录音会话不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 保存完整音频文件
        if audio_file or audio_base64:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                if audio_file:
                    for chunk in audio_file.chunks():
                        temp_file.write(chunk)
                else:
                    audio_data = base64.b64decode(audio_base64)
                    temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            # 保存到AudioFile
            audio_file_obj = transcription.audio_file
            with open(temp_file_path, 'rb') as f:
                audio_file_obj.file.put(f, content_type='audio/wav')
            
            # 进行完整转录
            try:
                if transcription.model == 'whisper':
                    whisper_service = WhisperService()
                    result = whisper_service.transcribe(
                        temp_file_path,
                        transcription.language.code if transcription.language else 'zh'
                    )
                elif transcription.model == 'xunfei':
                    xunfei_service = XunfeiASRService()
                    result = xunfei_service.transcribe(
                        temp_file_path,
                        transcription.language.code if transcription.language else 'zh'
                    )
                elif transcription.model == 'baidu':
                    baidu_service = BaiduASRService()
                    result = baidu_service.transcribe(
                        temp_file_path,
                        transcription.language.code if transcription.language else 'zh'
                    )
                else:
                    result = {'status': 'failed', 'error': '不支持的引擎'}
            finally:
                # 删除临时文件
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
            
            if result.get('status') == 'failed':
                transcription.status = 'failed'
                transcription.error_message = result.get('error', '转录失败')
                transcription.save()
                
                return Response(
                    {'error': result.get('error', '转录失败')},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # 更新转录记录
            transcription.text = result.get('text', '')
            transcription.segments = result.get('segments', [])
            transcription.duration = result.get('duration', 0)
            transcription.status = 'completed'
            transcription.save()
        else:
            transcription.status = 'completed'
            transcription.save()
        
        return Response({
            'session_id': session_id,
            'status': transcription.status,
            'text': transcription.text,
            'duration': transcription.duration,
            'segments': transcription.segments
        })
        
    except Exception as e:
        logger.error(f"停止录音失败: {str(e)}")
        return Response(
            {'error': f'停止录音失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_realtime_summary(request):
    """
    生成实时会议摘要
    在录音过程中生成实时摘要
    """
    try:
        session_id = request.data.get('session_id')
        partial_text = request.data.get('partial_text')
        
        if not session_id and not partial_text:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 如果提供了session_id，获取当前转录文本
        if session_id:
            try:
                transcription = Transcription.objects.get(
                    id=session_id,
                    user=get_mongo_user(request.user)
                )
                partial_text = transcription.text
            except Transcription.DoesNotExist:
                return Response(
                    {'error': '录音会话不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        if not partial_text:
            return Response({
                'summary': '',
                'key_points': [],
                'topics': []
            })
        
        # 生成简要摘要
        text_service = TextProcessingService()
        result = text_service.generate_meeting_summary(
            text=partial_text,
            summary_type='brief',
            language='zh'
        )
        
        return Response({
            'summary': result.get('summary', ''),
            'key_points': result.get('key_points', [])[:5],  # 只返回前5个要点
            'topics': result.get('topics', [])[:3],  # 只返回前3个主题
            'session_id': session_id
        })
        
    except Exception as e:
        logger.error(f"生成实时摘要失败: {str(e)}")
        return Response(
            {'error': f'生成实时摘要失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

