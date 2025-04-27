"""
OCR识别视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import OCRModel, OCRTrainingData
from notes.serializers import OCRModelSerializer, OCRTrainingDataSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
from PIL import Image
import pytesseract

logger = logging.getLogger(__name__)

class OCRModelViewSet(viewsets.ModelViewSet):
    """
    OCR模型视图集
    """
    serializer_class = OCRModelSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        return OCRModel.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建模型时设置创建时间和用户"""
        serializer.save(
            user=self.request.user,
            created_at=timezone.now()
        )
    
    @action(detail=False, methods=['post'])
    def recognize(self, request):
        """识别图片中的文字"""
        try:
            image_file = request.FILES.get('image')
            if not image_file:
                return Response(
                    {'error': '未提供图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 保存图片
            image_path = f'ocr/{timezone.now().strftime("%Y%m%d_%H%M%S")}.png'
            with open(image_path, 'wb') as f:
                for chunk in image_file.chunks():
                    f.write(chunk)
            
            # 使用Tesseract进行OCR识别
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image, lang='chi_sim')
            
            # 保存识别结果
            ocr_model = OCRModel.objects.create(
                user=request.user,
                image_path=image_path,
                recognized_text=text,
                created_at=timezone.now()
            )
            
            return Response({
                'message': '识别成功',
                'recognized_text': ocr_model.recognized_text,
                'ocr_model_id': ocr_model.id
            })
        except Exception as e:
            logger.error(f"OCR识别失败: {str(e)}")
            return Response(
                {'error': 'OCR识别失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def correct(self, request, pk=None):
        """纠正识别结果"""
        ocr_model = self.get_object()
        try:
            corrected_text = request.data.get('corrected_text')
            if not corrected_text:
                return Response(
                    {'error': '未提供纠正后的文本'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            ocr_model.corrected_text = corrected_text
            ocr_model.save()
            
            return Response({
                'message': '纠正成功',
                'corrected_text': ocr_model.corrected_text
            })
        except Exception as e:
            logger.error(f"纠正识别结果失败: {str(e)}")
            return Response(
                {'error': '纠正识别结果失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class OCRTrainingDataViewSet(viewsets.ModelViewSet):
    """
    OCR训练数据视图集
    """
    serializer_class = OCRTrainingDataSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        return OCRTrainingData.objects.filter(user=user)
    
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
            training_data = OCRTrainingData.objects.filter(user=request.user)
            return Response(
                OCRTrainingDataSerializer(training_data, many=True).data
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
                OCRTrainingData.objects.create(
                    user=request.user,
                    image_path=item['image_path'],
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