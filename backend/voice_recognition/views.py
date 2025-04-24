from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
import os
import tempfile
import base64
import uuid
import whisper
import numpy as np
from pydub import AudioSegment
from io import BytesIO
from ..notes.models import Note

# 加载Whisper模型（轻量级版本，可根据服务器配置调整）
model = whisper.load_model("base")

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transcribe_audio(request):
    """
    语音转文本API
    接收音频数据（base64或文件上传），返回转写结果
    基于OpenAI Whisper框架实现
    """
    try:
        # 获取关联的笔记ID（可选）
        note_id = request.data.get('noteId')
        
        # 临时文件路径
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_file_path = temp_file.name
        temp_file.close()
        
        # 处理音频数据
        if 'audio' in request.FILES:
            # 文件上传方式
            audio_file = request.FILES['audio']
            # 保存到临时文件
            with open(temp_file_path, 'wb') as f:
                for chunk in audio_file.chunks():
                    f.write(chunk)
        elif 'audio' in request.data:
            # base64方式
            try:
                audio_data = request.data['audio']
                # 移除可能的base64前缀
                if ';base64,' in audio_data:
                    audio_data = audio_data.split(';base64,')[1]
                # 解码base64数据
                decoded_data = base64.b64decode(audio_data)
                # 保存到临时文件
                with open(temp_file_path, 'wb') as f:
                    f.write(decoded_data)
            except Exception as e:
                return Response({
                    'success': False,
                    'message': f'Base64解码失败: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({
                'success': False,
                'message': '未提供音频数据'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 使用Whisper模型进行转写
        try:
            # 加载音频文件
            result = model.transcribe(temp_file_path)
            transcribed_text = result["text"]
            
            # 如果提供了笔记ID，将转写结果保存到笔记中
            if note_id:
                try:
                    note = Note.objects.get(id=note_id, user=request.user)
                    note.content += f"\n{transcribed_text}"
                    note.save()
                except Note.DoesNotExist:
                    pass  # 笔记不存在，仅返回转写结果
            
            return Response({
                'success': True,
                'text': transcribed_text
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'转写失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        return Response({
            'success': False,
            'message': f'处理请求失败: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    finally:
        # 清理临时文件
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_meeting_summary(request):
    """
    生成会议纪要API
    接收转写文本，返回结构化的会议纪要
    """
    try:
        # 获取转写文本
        transcribed_text = request.data.get('text')
        
        if not transcribed_text:
            return Response({
                'success': False,
                'message': '未提供转写文本'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 简单的会议纪要生成逻辑
        # 在实际项目中，这里可以接入更复杂的NLP模型或OpenAI API
        # 这里仅做简单处理作为示例
        
        # 分段处理
        paragraphs = transcribed_text.split('\n')
        
        # 提取可能的主题（假设第一段包含会议主题）
        topic = paragraphs[0] if paragraphs else "会议纪要"
        
        # 构建简单的会议纪要
        summary = f"# {topic}\n\n"
        summary += "## 会议内容\n\n"
        
        # 添加内容要点（简单处理，实际项目中应使用更复杂的NLP技术）
        for i, para in enumerate(paragraphs[1:], 1):
            if para.strip():
                summary += f"{i}. {para.strip()}\n"
        
        summary += "\n## 行动项目\n\n"
        summary += "- 待定\n"
        summary += "\n## 下一步计划\n\n"
        summary += "- 待定\n"
        
        return Response({
            'success': True,
            'summary': summary
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': f'生成会议纪要失败: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)