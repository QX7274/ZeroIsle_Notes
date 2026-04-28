"""
转录视图
"""

import os
import tempfile
import logging
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from mongoengine.queryset.visitor import Q
from django.utils import timezone

from voice_recognition.mongodb_models import Transcription, AudioFile, Language
from voice_recognition.serializers import (
    TranscriptionSerializer,
    TranscriptionListSerializer,
    TranscriptionDetailSerializer,
    TranscriptionCreateSerializer
)
from voice_recognition.services import (
    TranscriptionService,
    DiarizationService,
    WhisperService,
    TextProcessingService
)
from users.middleware import get_mongo_user
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

from common.utils import validate_uploaded_file
logger = logging.getLogger('backend')

class TranscriptionViewSet(viewsets.ModelViewSet):
    """转录视图集"""
    serializer_class = TranscriptionSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['audio_file', 'status', 'model', 'is_speaker_diarization']
    search_fields = ['text']
    ordering_fields = ['created_at', 'duration']
    ordering = ['-created_at']

    def get_queryset(self):
        """获取查询集"""
        return Transcription.objects(
            user=get_mongo_user(self.request.user)
        )

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return TranscriptionListSerializer
        elif self.action == 'retrieve':
            return TranscriptionDetailSerializer
        elif self.action == 'create':
            return TranscriptionCreateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        """创建转录"""
        # 序列化器中已经处理了创建逻辑
        return serializer.save()

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """处理转录"""
        transcription = self.get_object()

        # 检查状态
        if transcription.status != 'pending':
            return Response(
                {"detail": f"转录状态不是待处理: {transcription.get_status_display()}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 使用转录服务处理转录
        transcription_service = TranscriptionService()
        transcription = transcription_service.process_transcription(
            transcription_id=transcription.id
        )

        serializer = TranscriptionDetailSerializer(transcription)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def diarize(self, request, pk=None):
        """说话人分离"""
        transcription = self.get_object()

        # 检查状态
        if transcription.status != 'completed':
            return Response(
                {"detail": f"转录状态不是已完成: {transcription.get_status_display()}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 使用说话人分离服务处理转录
        diarization_service = DiarizationService()
        transcription = diarization_service.process_diarization(
            transcription_id=transcription.id
        )

        serializer = TranscriptionDetailSerializer(transcription)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """导出转录"""
        transcription = self.get_object()

        # 检查状态
        if transcription.status != 'completed':
            return Response(
                {"detail": f"转录状态不是已完成: {transcription.get_status_display()}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取导出格式
        format = request.query_params.get('format', 'txt')

        # 导出转录
        if format == 'txt':
            return Response({
                "content": transcription.text,
                "format": "txt"
            })
        elif format == 'srt':
            # 生成SRT格式
            srt_content = self._generate_srt(transcription)
            return Response({
                "content": srt_content,
                "format": "srt"
            })
        elif format == 'vtt':
            # 生成VTT格式
            vtt_content = self._generate_vtt(transcription)
            return Response({
                "content": vtt_content,
                "format": "vtt"
            })
        elif format == 'json':
            # 返回JSON格式
            return Response({
                "text": transcription.text,
                "segments": transcription.segments,
                "format": "json"
            })
        else:
            return Response(
                {"detail": f"不支持的导出格式: {format}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _generate_srt(self, transcription):
        """生成SRT格式"""
        srt_content = ""

        for i, segment in enumerate(transcription.segments):
            start_time = segment.get('start', 0)
            end_time = segment.get('end', 0)
            text = segment.get('text', '')

            # 格式化时间
            start_formatted = self._format_time_srt(start_time)
            end_formatted = self._format_time_srt(end_time)

            # 添加字幕
            srt_content += f"{i+1}\n"
            srt_content += f"{start_formatted} --> {end_formatted}\n"
            srt_content += f"{text}\n\n"

        return srt_content

    def _generate_vtt(self, transcription):
        """生成VTT格式"""
        vtt_content = "WEBVTT\n\n"

        for i, segment in enumerate(transcription.segments):
            start_time = segment.get('start', 0)
            end_time = segment.get('end', 0)
            text = segment.get('text', '')

            # 格式化时间
            start_formatted = self._format_time_vtt(start_time)
            end_formatted = self._format_time_vtt(end_time)

            # 添加字幕
            vtt_content += f"{start_formatted} --> {end_formatted}\n"
            vtt_content += f"{text}\n\n"

        return vtt_content

    def _format_time_srt(self, seconds):
        """格式化SRT时间"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        seconds = seconds % 60
        milliseconds = int((seconds - int(seconds)) * 1000)

        return f"{hours:02d}:{minutes:02d}:{int(seconds):02d},{milliseconds:03d}"

    def _format_time_vtt(self, seconds):
        """格式化VTT时间"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        seconds = seconds % 60
        milliseconds = int((seconds - int(seconds)) * 1000)

        return f"{hours:02d}:{minutes:02d}:{int(seconds):02d}.{milliseconds:03d}"


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transcribe_audio(request):
    """
    语音转文字API - 增强版
    将上传的音频文件转换为文本，支持多种识别引擎和高级功能
    """
    try:
        # 获取音频文件
        upload_field_name = 'audio' if 'audio' in request.FILES else 'file'
        audio_file = request.FILES.get(upload_field_name)
        audio_base64 = request.data.get('audio_base64')
        language_code = request.data.get('language', 'zh')
        note_id = request.data.get('note_id')
        engine = request.data.get('engine', 'whisper')  # whisper, xunfei, baidu
        enable_diarization = request.data.get('enable_diarization', False)  # 是否启用说话人分离
        enable_punctuation = request.data.get('enable_punctuation', True)  # 是否启用标点符号
        enable_timestamp = request.data.get('enable_timestamp', True)  # 是否启用时间戳

        if not audio_file and not audio_base64:
            return Response(
                {'error': '未提供音频文件或音频数据'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 文件校验
        if audio_file:
            ok, err = validate_uploaded_file(audio_file, ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'], max_size_mb=25)
            if not ok:
                return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
        elif audio_base64:
            # 粗略限制 base64 长度（~25MB 原始 => ~33MB base64）
            if len(audio_base64) > 35_000_000:
                return Response({'error': '音频数据过大，最大允许 25MB'}, status=status.HTTP_400_BAD_REQUEST)

        # 保存临时文件
        file_name = 'upload.wav'
        file_size = 0
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            if audio_file:
                for chunk in audio_file.chunks():
                    temp_file.write(chunk)
                file_name = audio_file.name
                file_size = audio_file.size
            else:
                # 处理Base64编码的音频数据
                import base64
                audio_data = base64.b64decode(audio_base64)
                temp_file.write(audio_data)
                file_size = len(audio_data)

            temp_file_path = temp_file.name

        # 获取语言
        try:
            language = Language.objects.get(code=language_code)
        except Language.DoesNotExist:
            language = None

        # 创建音频文件记录
        mongo_user = get_mongo_user(request.user)
        audio_file_obj = AudioFile(
            user=mongo_user,
            file_path=temp_file_path,
            file_name=file_name,
            file_size=file_size,
            file_type='audio/wav',
            duration=0,  # 暂时设为0，后续更新
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        audio_file_obj.save()

        # 保存音频文件
        with open(temp_file_path, 'rb') as f:
            audio_file_obj.file.put(f, content_type='audio/wav')
        audio_file_obj.save()

        # 创建转录记录
        transcription = Transcription(
            user=mongo_user,
            audio_file=audio_file_obj,
            text='',  # 初始为空
            language=language,
            model=engine,
            status='pending',
            is_speaker_diarization=enable_diarization,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        transcription.save()

        # 使用统一的语音识别服务
        result = None
        try:
            unified_service = WhisperService()
            result = unified_service.transcribe(
                audio_file_path=temp_file_path,
                language=language_code,
                model=engine if engine != 'whisper' else 'whisper-1',
                field_name=upload_field_name
            )
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
        transcription.status = 'completed'
        transcription.duration = result.get('duration', 0)
        transcription.save()

        # 如果启用说话人分离，进行处理
        if enable_diarization:
            try:
                diarization_service = DiarizationService()
                transcription = diarization_service.process_diarization(
                    transcription_id=transcription.id
                )
            except Exception as e:
                logger.warning(f"说话人分离失败: {str(e)}")

        # 如果提供了笔记ID，将转录文本添加到笔记中
        if note_id:
            try:
                from notes.mongodb_models import Note
                note = Note.objects.get(id=note_id, user=get_mongo_user(request.user))
                note.content += f"\n\n## 语音转录 ({timezone.now().strftime('%Y-%m-%d %H:%M:%S')})\n\n{transcription.text}"
                note.updated_at = timezone.now()
                note.save()
            except Exception as e:
                logger.error(f"添加转录文本到笔记失败: {str(e)}")

        # 返回结果
        return Response({
            'id': str(transcription.id),
            'text': transcription.text,
            'segments': transcription.segments,
            'duration': transcription.duration,
            'language': language_code,
            'engine': engine,
            'has_diarization': enable_diarization and transcription.is_speaker_diarization,
            'created_at': transcription.created_at.isoformat()
        })

    except Exception as e:
        logger.error(f"语音转文字失败: {str(e)}")
        return Response(
            {'error': f'语音转文字失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_meeting_summary(request):
    """
    生成会议纪要API - 增强版
    根据转录文本生成会议纪要，支持多种格式和自定义选项
    """
    try:
        # 获取转录文本
        text = request.data.get('text')
        transcription_id = request.data.get('transcription_id')
        note_id = request.data.get('note_id')  # 可选：保存到指定笔记
        summary_type = request.data.get('summary_type', 'detailed')  # detailed, brief, action_focused
        language = request.data.get('language', 'zh')  # 输出语言
        include_timestamps = request.data.get('include_timestamps', False)  # 是否包含时间戳

        if not text and not transcription_id:
            return Response(
                {'error': '未提供转录文本或转录ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 如果提供了转录ID，获取转录文本和segments
        segments = []
        if transcription_id and not text:
            try:
                transcription = Transcription.objects.get(
                    id=transcription_id,
                    user=get_mongo_user(request.user),
                    status='completed'
                )
                text = transcription.text
                segments = transcription.segments or []
            except Transcription.DoesNotExist:
                return Response(
                    {'error': '转录不存在或未完成'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # 调用文本处理服务生成会议纪要
        text_service = TextProcessingService()
        result = text_service.generate_meeting_summary(
            text=text,
            summary_type=summary_type,
            language=language,
            segments=segments if include_timestamps else None
        )

        # 如果提供了笔记ID，将会议纪要保存到笔记中
        if note_id:
            try:
                from notes.mongodb_models import Note
                note = Note.objects.get(id=note_id, user=get_mongo_user(request.user))

                # 格式化会议纪要
                summary_content = f"""
## 会议纪要 ({timezone.now().strftime('%Y-%m-%d %H:%M:%S')})

### 会议摘要
{result.get('summary', '')}

### 关键要点
"""
                for i, point in enumerate(result.get('key_points', []), 1):
                    summary_content += f"{i}. {point}\n"

                summary_content += "\n### 行动项\n"
                for i, item in enumerate(result.get('action_items', []), 1):
                    summary_content += f"{i}. {item}\n"

                if result.get('participants'):
                    summary_content += "\n### 参会人员\n"
                    for participant in result.get('participants', []):
                        summary_content += f"- {participant}\n"

                note.content += f"\n\n{summary_content}"
                note.updated_at = timezone.now()
                note.save()
            except Exception as e:
                logger.error(f"保存会议纪要到笔记失败: {str(e)}")

        # 返回结果
        return Response({
            'summary': result.get('summary', ''),
            'key_points': result.get('key_points', []),
            'action_items': result.get('action_items', []),
            'participants': result.get('participants', []),
            'decisions': result.get('decisions', []),
            'topics': result.get('topics', []),
            'full_text': result.get('full_text', ''),
            'summary_type': summary_type,
            'language': language
        })

    except Exception as e:
        logger.error(f"生成会议纪要失败: {str(e)}")
        return Response(
            {'error': f'生成会议纪要失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
