"""
手写识别视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import Handwriting
from notes.serializers import HandwritingSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
from PIL import Image
import numpy as np
import tensorflow as tf

logger = logging.getLogger(__name__)

class HandwritingViewSet(viewsets.ModelViewSet):
    """
    手写识别视图集
    """
    serializer_class = HandwritingSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        return Handwriting.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建手写记录时设置创建时间和用户"""
        serializer.save(
            user=self.request.user,
            created_at=timezone.now()
        )
    
    @action(detail=False, methods=['post'])
    def recognize(self, request):
        """识别手写内容"""
        try:
            image_file = request.FILES.get('image')
            if not image_file:
                return Response(
                    {'error': '未提供图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 保存图片
            image_path = f'handwriting/{timezone.now().strftime("%Y%m%d_%H%M%S")}.png'
            with open(image_path, 'wb') as f:
                for chunk in image_file.chunks():
                    f.write(chunk)
            
            # 加载模型
            model = tf.keras.models.load_model('handwriting_model.h5')
            
            # 预处理图片
            image = Image.open(image_path).convert('L')
            image = image.resize((28, 28))
            image_array = np.array(image) / 255.0
            image_array = image_array.reshape(1, 28, 28, 1)
            
            # 预测
            prediction = model.predict(image_array)
            predicted_class = np.argmax(prediction)
            
            # 保存识别结果
            handwriting = Handwriting.objects.create(
                user=request.user,
                image_path=image_path,
                recognized_text=str(predicted_class),
                created_at=timezone.now()
            )
            
            return Response({
                'message': '识别成功',
                'recognized_text': handwriting.recognized_text,
                'handwriting_id': handwriting.id
            })
        except Exception as e:
            logger.error(f"手写识别失败: {str(e)}")
            return Response(
                {'error': '手写识别失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def correct(self, request, pk=None):
        """纠正识别结果"""
        handwriting = self.get_object()
        try:
            corrected_text = request.data.get('corrected_text')
            if not corrected_text:
                return Response(
                    {'error': '未提供纠正后的文本'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            handwriting.corrected_text = corrected_text
            handwriting.save()
            
            return Response({
                'message': '纠正成功',
                'corrected_text': handwriting.corrected_text
            })
        except Exception as e:
            logger.error(f"纠正识别结果失败: {str(e)}")
            return Response(
                {'error': '纠正识别结果失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def training_data(self, request):
        """获取训练数据"""
        try:
            handwritings = Handwriting.objects.filter(
                user=request.user,
                corrected_text__isnull=False
            )
            return Response(
                HandwritingSerializer(handwritings, many=True).data
            )
        except Exception as e:
            logger.error(f"获取训练数据失败: {str(e)}")
            return Response(
                {'error': '获取训练数据失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 