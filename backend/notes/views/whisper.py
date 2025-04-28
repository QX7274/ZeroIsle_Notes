"""
语音识别视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import WhisperModel, WhisperTrainingData
from notes.serializers import WhisperModelSerializer, WhisperTrainingDataSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
import whisper
import torch
import uuid

logger = logging.getLogger(__name__)

class WhisperModelViewSet(viewsets.ViewSet):
    """
    语音识别模型视图集
    """
    serializer_class = WhisperModelSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取语音识别模型列表"""
        models = WhisperModel.objects.filter(is_active=True)
        serializer = WhisperModelSerializer(models, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个语音识别模型详情"""
        try:
            model = WhisperModel.objects.get(id=pk, is_active=True)
            serializer = WhisperModelSerializer(model)
            return Response(serializer.data)
        except WhisperModel.DoesNotExist:
            return Response(
                {"detail": "语音识别模型不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建语音识别模型"""
        serializer = WhisperModelSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 创建语音识别模型
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新语音识别模型"""
        try:
            model = WhisperModel.objects.get(id=pk, is_active=True)
            serializer = WhisperModelSerializer(model, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新语音识别模型
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except WhisperModel.DoesNotExist:
            return Response(
                {"detail": "语音识别模型不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除语音识别模型"""
        try:
            model = WhisperModel.objects.get(id=pk, is_active=True)
            model.is_active = False
            model.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except WhisperModel.DoesNotExist:
            return Response(
                {"detail": "语音识别模型不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
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
            os.makedirs('media/whisper', exist_ok=True)  # 确保目录存在
            audio_path = f'media/whisper/{timezone.now().strftime("%Y%m%d_%H%M%S")}.wav'
            with open(audio_path, 'wb') as f:
                for chunk in audio_file.chunks():
                    f.write(chunk)

            # 加载模型
            model = whisper.load_model("base")

            # 转录
            result = model.transcribe(audio_path)
            text = result["text"]

            # 创建语音识别模型
            whisper_model = WhisperModel(
                id=uuid.uuid4(),
                name=f"语音识别 - {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
                description="通过Whisper识别的文本",
                model_size='base',
                language=result.get('language', ''),
                is_active=True,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 保存模型文件
            with open(audio_path, 'rb') as f:
                whisper_model.model_file.put(f, content_type='audio/wav')

            whisper_model.save()

            return Response({
                'message': '转录成功',
                'transcribed_text': text,
                'model_id': str(whisper_model.id)
            })
        except Exception as e:
            logger.error(f"语音转录失败: {str(e)}")
            return Response(
                {'error': f'语音转录失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def correct(self, request, pk=None):
        """纠正转录结果"""
        try:
            whisper_model = WhisperModel.objects.get(id=pk, is_active=True)

            corrected_text = request.data.get('corrected_text')
            if not corrected_text:
                return Response(
                    {'error': '未提供纠正后的文本'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 更新描述
            whisper_model.description = f"已纠正: {corrected_text[:30]}..."
            whisper_model.updated_at = timezone.now()
            whisper_model.save()

            # 创建训练数据
            training_data = WhisperTrainingData(
                id=uuid.uuid4(),
                user=request.user,
                text=corrected_text,
                language=whisper_model.language,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 复制音频文件
            if whisper_model.model_file:
                audio_data = whisper_model.model_file.read()
                training_data.audio.put(audio_data, content_type='audio/wav')

            training_data.save()

            return Response({
                'message': '纠正成功',
                'corrected_text': corrected_text,
                'training_data_id': str(training_data.id)
            })
        except WhisperModel.DoesNotExist:
            return Response(
                {"detail": "语音识别模型不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"纠正转录结果失败: {str(e)}")
            return Response(
                {'error': f'纠正转录结果失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class WhisperTrainingDataViewSet(viewsets.ViewSet):
    """
    语音识别训练数据视图集
    """
    serializer_class = WhisperTrainingDataSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取语音识别训练数据列表"""
        user = request.user
        training_data = WhisperTrainingData.objects.filter(user=user, is_verified=False)
        serializer = WhisperTrainingDataSerializer(training_data, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个语音识别训练数据详情"""
        try:
            training_data = WhisperTrainingData.objects.get(id=pk)
            # 检查权限
            if training_data.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此训练数据"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = WhisperTrainingDataSerializer(training_data)
            return Response(serializer.data)
        except WhisperTrainingData.DoesNotExist:
            return Response(
                {"detail": "训练数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建语音识别训练数据"""
        serializer = WhisperTrainingDataSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 创建语音识别训练数据
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新语音识别训练数据"""
        try:
            training_data = WhisperTrainingData.objects.get(id=pk, user=request.user)
            serializer = WhisperTrainingDataSerializer(training_data, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新语音识别训练数据
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except WhisperTrainingData.DoesNotExist:
            return Response(
                {"detail": "训练数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除语音识别训练数据"""
        try:
            training_data = WhisperTrainingData.objects.get(id=pk, user=request.user)
            training_data.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except WhisperTrainingData.DoesNotExist:
            return Response(
                {"detail": "训练数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def export(self, request):
        """导出训练数据"""
        try:
            training_data = WhisperTrainingData.objects.filter(user=request.user)
            serializer = WhisperTrainingDataSerializer(training_data, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"导出训练数据失败: {str(e)}")
            return Response(
                {'error': f'导出训练数据失败: {str(e)}'},
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

            imported_count = 0
            for item in data:
                # 创建语音识别训练数据
                training_data = WhisperTrainingData(
                    id=uuid.uuid4(),
                    user=request.user,
                    text=item.get('text', ''),
                    language=item.get('language', ''),
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )

                # 处理音频
                if 'audio' in item and item['audio']:
                    audio_path = item['audio']
                    if os.path.exists(audio_path):
                        with open(audio_path, 'rb') as f:
                            training_data.audio.put(f, content_type='audio/wav')

                training_data.save()
                imported_count += 1

            return Response({
                'message': '导入成功',
                'imported_count': imported_count
            })
        except Exception as e:
            logger.error(f"导入训练数据失败: {str(e)}")
            return Response(
                {'error': f'导入训练数据失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """验证训练数据"""
        try:
            training_data = WhisperTrainingData.objects.get(id=pk)

            # 检查权限
            if not request.user.is_staff:
                return Response(
                    {"detail": "您没有权限验证训练数据"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 验证训练数据
            training_data.verify(request.user)

            serializer = WhisperTrainingDataSerializer(training_data)
            return Response({
                'message': '验证成功',
                'training_data': serializer.data
            })
        except WhisperTrainingData.DoesNotExist:
            return Response(
                {"detail": "训练数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"验证训练数据失败: {str(e)}")
            return Response(
                {'error': f'验证训练数据失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )