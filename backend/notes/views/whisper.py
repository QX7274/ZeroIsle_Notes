"""
语音识别视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import WhisperModel, WhisperTrainingData
from notes.serializers import WhisperModelSerializer, WhisperTrainingDataSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
import whisper
import torch

logger = logging.getLogger(__name__)

class WhisperModelViewSet(viewsets.ModelViewSet):
    """
    语音识别模型视图集
    """
    serializer_class = WhisperModelSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        return WhisperModel.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建模型时设置创建时间和用户"""
        serializer.save(
            user=self.request.user,
            created_at=timezone.now()
        )
    
    @action(detail=False, methods=['post'])
    def transcribe(self, request):
        """转录音频"""
        try:
            audio_file = request.FILES.get('audio')
            if not audio_file:
                return Response(
                    {'error': '未提供音频文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 保存音频
            audio_path = f'whisper/{timezone.now().strftime("%Y%m%d_%H%M%S")}.wav'
            with open(audio_path, 'wb') as f:
                for chunk in audio_file.chunks():
                    f.write(chunk)
            
            # 加载模型
            model = whisper.load_model("base")
            
            # 转录
            result = model.transcribe(audio_path)
            text = result["text"]
            
            # 保存识别结果
            whisper_model = WhisperModel.objects.create(
                user=request.user,
                audio_path=audio_path,
                transcribed_text=text,
                created_at=timezone.now()
            )
            
            return Response({
                'message': '转录成功',
                'transcribed_text': whisper_model.transcribed_text,
                'whisper_model_id': whisper_model.id
            })
        except Exception as e:
            logger.error(f"语音转录失败: {str(e)}")
            return Response(
                {'error': '语音转录失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def correct(self, request, pk=None):
        """纠正转录结果"""
        whisper_model = self.get_object()
        try:
            corrected_text = request.data.get('corrected_text')
            if not corrected_text:
                return Response(
                    {'error': '未提供纠正后的文本'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            whisper_model.corrected_text = corrected_text
            whisper_model.save()
            
            return Response({
                'message': '纠正成功',
                'corrected_text': whisper_model.corrected_text
            })
        except Exception as e:
            logger.error(f"纠正转录结果失败: {str(e)}")
            return Response(
                {'error': '纠正转录结果失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class WhisperTrainingDataViewSet(viewsets.ModelViewSet):
    """
    语音识别训练数据视图集
    """
    serializer_class = WhisperTrainingDataSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        return WhisperTrainingData.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建训练数据时设置创建时间和用户"""
        serializer.save(
            user=self.request.user,
            created_at=timezone.now()
        )
    
    @action(detail=False, methods=['get'])
    def export(self, request):
        """导出训练数据"""
        try:
            training_data = WhisperTrainingData.objects.filter(user=request.user)
            return Response(
                WhisperTrainingDataSerializer(training_data, many=True).data
            )
        except Exception as e:
            logger.error(f"导出训练数据失败: {str(e)}")
            return Response(
                {'error': '导出训练数据失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def import_data(self, request):
        """导入训练数据"""
        try:
            data = request.data.get('data')
            if not data:
                return Response(
                    {'error': '未提供训练数据'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            for item in data:
                WhisperTrainingData.objects.create(
                    user=request.user,
                    audio_path=item['audio_path'],
                    text=item['text'],
                    created_at=timezone.now()
                )
            
            return Response({'message': '导入成功'})
        except Exception as e:
            logger.error(f"导入训练数据失败: {str(e)}")
            return Response(
                {'error': '导入训练数据失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 