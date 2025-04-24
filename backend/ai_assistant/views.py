from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import StreamingHttpResponse
import openai
import os
import json
from django.conf import settings
import tempfile
import base64
from ..notes.models import Note
from ..users.models import UserProfile

# 配置OpenAI API
openai.api_key = os.getenv('OPENAI_API_KEY')

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_completion(request):
    """
    AI聊天对话
    """
    try:
        prompt = request.data.get('prompt')
        if not prompt:
            return Response(
                {'error': 'prompt is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取历史消息
        history = request.data.get('history', [])
        messages = []

        # 添加系统消息
        system_message = "你是零屿笔记的AI助手，一个专注于帮助用户管理笔记、知识和任务的智能助手。"
        messages.append({"role": "system", "content": system_message})

        # 添加历史消息
        for msg in history:
            role = "assistant" if msg.get('sender') == 'assistant' else "user"
            messages.append({"role": role, "content": msg.get('text', '')})

        # 添加当前消息
        messages.append({"role": "user", "content": prompt})

        # 检查是否使用流式响应
        stream_mode = request.data.get('stream', False)

        if stream_mode:
            # 流式响应
            def generate_stream():
                try:
                    stream = openai.ChatCompletion.create(
                        model="gpt-4",
                        messages=messages,
                        stream=True
                    )

                    # 初始化响应文本
                    response_text = ""

                    # 流式返回响应
                    for chunk in stream:
                        if chunk.choices and len(chunk.choices) > 0:
                            delta = chunk.choices[0].delta
                            if 'content' in delta:
                                content = delta.content
                                response_text += content
                                yield f"data: {json.dumps({'content': content, 'full_text': response_text})}\n\n"

                    # 发送完成信号
                    yield f"data: {json.dumps({'content': '', 'full_text': response_text, 'done': True})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"

            return StreamingHttpResponse(
                generate_stream(),
                content_type='text/event-stream'
            )
        else:
            # 普通响应
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=messages
            )

            return Response({
                'response': response.choices[0].message.content
            })

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transcribe_audio(request):
    """
    语音转文字
    """
    try:
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response(
                {'error': 'audio file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 保存临时文件
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_file_path = temp_file.name
        temp_file.close()

        with open(temp_file_path, 'wb') as f:
            for chunk in audio_file.chunks():
                f.write(chunk)

        # 调用Whisper API
        with open(temp_file_path, 'rb') as f:
            transcript = openai.Audio.transcribe("whisper-1", f)

        # 清理临时文件
        os.unlink(temp_file_path)

        return Response({
            'text': transcript['text']
        })

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_text(request):
    """
    文本处理（翻译、摘要等）
    """
    try:
        text = request.data.get('text')
        action = request.data.get('action')  # translate, summarize, etc.
        target_lang = request.data.get('target_lang')

        if not text or not action:
            return Response(
                {'error': 'text and action are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        system_prompt = ""
        if action == 'translate':
            system_prompt = f"Translate the following text to {target_lang}. Only return the translation."
        elif action == 'summarize':
            system_prompt = "Summarize the following text in a concise way."
        elif action == 'check':
            system_prompt = "Check the following text for spelling errors and knowledge accuracy. Return a JSON with errors and suggestions."

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ]
        )

        return Response({
            'result': response.choices[0].message.content
        })

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_image(request):
    """
    图片分析
    """
    try:
        image_file = request.FILES.get('image')
        if not image_file:
            return Response(
                {'error': 'image file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 保存临时文件
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        temp_file_path = temp_file.name
        temp_file.close()

        with open(temp_file_path, 'wb') as f:
            for chunk in image_file.chunks():
                f.write(chunk)

        # 调用Vision API
        with open(temp_file_path, 'rb') as f:
            response = openai.ChatCompletion.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Describe this image in detail."},
                            {"type": "image_url", "image_url": f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"}
                        ]
                    }
                ]
            )

        # 清理临时文件
        os.unlink(temp_file_path)

        return Response({
            'description': response.choices[0].message.content
        })

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
