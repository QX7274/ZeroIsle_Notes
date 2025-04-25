"""
转录视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count

from voice_recognition.models import Transcription
from voice_recognition.serializers import (
    TranscriptionSerializer,
    TranscriptionListSerializer,
    TranscriptionDetailSerializer,
    TranscriptionCreateSerializer
)
from voice_recognition.services import TranscriptionService, DiarizationService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

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
        return Transcription.objects.filter(
            user=self.request.user
        ).select_related(
            'audio_file', 'language'
        ).annotate(
            word_count=Count('text')
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
