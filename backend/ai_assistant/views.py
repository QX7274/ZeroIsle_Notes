"""
AI助手模块视图
"""

import os
import json
import logging
import tempfile
from typing import Dict, Any, List, Optional

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import Conversation, Message, ModelConfig, UsageRecord
from .serializers import ConversationSerializer, MessageSerializer
from .services import (
    OpenAIService, 
    WhisperService, 
    ImageAnalysisService, 
    TextProcessingService
)

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_completion(request):
    """
    聊天完成API
    处理用户的聊天请求，调用OpenAI API获取回复
    """
    user = request.user
    data = request.data
    
    # 获取请求参数
    messages = data.get('messages', [])
    conversation_id = data.get('conversation_id')
    model_name = data.get('model', 'gpt-3.5-turbo')
    temperature = float(data.get('temperature', 0.7))
    max_tokens = int(data.get('max_tokens', 1000))
    
    # 验证消息格式
    if not messages or not isinstance(messages, list):
        return Response(
            {'error': '消息格式不正确'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 获取或创建对话
    conversation = None
    if conversation_id:
        try:
            conversation = Conversation.objects.get(id=conversation_id, user=user)
        except Conversation.DoesNotExist:
            return Response(
                {'error': '对话不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
    else:
        # 创建新对话
        title = messages[0]['content'][:50] if messages and len(messages) > 0 else '新对话'
        conversation = Conversation.objects.create(
            user=user,
            title=title,
            model=model_name
        )
    
    # 初始化OpenAI服务
    openai_service = OpenAIService()
    
    try:
        # 调用OpenAI API
        response = openai_service.chat_completion(
            messages=messages,
            model=model_name,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # 保存用户消息
        user_message = Message.objects.create(
            conversation=conversation,
            role='user',
            content=messages[-1]['content'],
            user=user
        )
        
        # 保存助手回复
        assistant_message = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=response['content'],
            user=user
        )
        
        # 更新对话的最后活动时间
        conversation.last_activity = timezone.now()
        conversation.save()
        
        # 记录使用情况
        UsageRecord.objects.create(
            user=user,
            model=model_name,
            prompt_tokens=response['usage']['prompt_tokens'],
            completion_tokens=response['usage']['completion_tokens'],
            total_tokens=response['usage']['total_tokens'],
            conversation=conversation
        )
        
        # 返回结果
        return Response({
            'conversation_id': str(conversation.id),
            'message': response['content'],
            'message_id': str(assistant_message.id),
            'usage': response['usage']
        })
        
    except Exception as e:
        logger.error(f"Chat completion error: {str(e)}")
        return Response(
            {'error': f'处理请求时出错: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def transcribe_audio(request):
    """
    音频转写API
    处理用户的音频文件，调用Whisper API进行转写
    """
    user = request.user
    
    # 检查是否上传了音频文件
    if 'file' not in request.FILES:
        return Response(
            {'error': '未上传音频文件'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    audio_file = request.FILES['file']
    language = request.data.get('language', 'zh')
    
    # 初始化Whisper服务
    whisper_service = WhisperService()
    
    try:
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.name)[1]) as temp_file:
            for chunk in audio_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name
        
        # 调用Whisper API
        result = whisper_service.transcribe(
            file_path=temp_file_path,
            language=language
        )
        
        # 删除临时文件
        os.unlink(temp_file_path)
        
        # 记录使用情况
        UsageRecord.objects.create(
            user=user,
            model='whisper',
            prompt_tokens=0,
            completion_tokens=len(result['text'].split()),
            total_tokens=len(result['text'].split())
        )
        
        # 返回结果
        return Response({
            'text': result['text'],
            'language': result.get('language', language)
        })
        
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        # 确保删除临时文件
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        return Response(
            {'error': f'处理音频时出错: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_text(request):
    """
    文本处理API
    处理用户的文本，执行各种文本处理任务
    """
    user = request.user
    data = request.data
    
    # 获取请求参数
    text = data.get('text', '')
    task = data.get('task', 'summarize')
    
    if not text:
        return Response(
            {'error': '文本不能为空'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 初始化文本处理服务
    text_service = TextProcessingService()
    
    try:
        # 执行文本处理任务
        result = text_service.process_text(
            text=text,
            task=task
        )
        
        # 记录使用情况
        UsageRecord.objects.create(
            user=user,
            model='gpt-3.5-turbo',
            prompt_tokens=len(text.split()),
            completion_tokens=len(result['result'].split()),
            total_tokens=len(text.split()) + len(result['result'].split())
        )
        
        # 返回结果
        return Response(result)
        
    except Exception as e:
        logger.error(f"Text processing error: {str(e)}")
        return Response(
            {'error': f'处理文本时出错: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def analyze_image(request):
    """
    图像分析API
    处理用户的图像，执行各种图像分析任务
    """
    user = request.user
    
    # 检查是否上传了图像文件
    if 'file' not in request.FILES:
        return Response(
            {'error': '未上传图像文件'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    image_file = request.FILES['file']
    task = request.data.get('task', 'describe')
    prompt = request.data.get('prompt', '')
    
    # 初始化图像分析服务
    image_service = ImageAnalysisService()
    
    try:
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(image_file.name)[1]) as temp_file:
            for chunk in image_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name
        
        # 调用图像分析服务
        result = image_service.analyze_image(
            file_path=temp_file_path,
            task=task,
            prompt=prompt
        )
        
        # 删除临时文件
        os.unlink(temp_file_path)
        
        # 记录使用情况
        UsageRecord.objects.create(
            user=user,
            model='gpt-4-vision',
            prompt_tokens=1000,  # 图像token估计
            completion_tokens=len(result['result'].split()),
            total_tokens=1000 + len(result['result'].split())
        )
        
        # 返回结果
        return Response(result)
        
    except Exception as e:
        logger.error(f"Image analysis error: {str(e)}")
        # 确保删除临时文件
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        return Response(
            {'error': f'处理图像时出错: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
