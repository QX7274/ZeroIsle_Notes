"""
OCR识别视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import OCRModel, OCRTrainingData
from notes.serializers import OCRModelSerializer, OCRTrainingDataSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
from PIL import Image
import pytesseract
import uuid

logger = logging.getLogger(__name__)

class OCRModelViewSet(viewsets.ViewSet):
    """
    OCR模型视图集
    """
    serializer_class = OCRModelSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取OCR模型列表"""
        models = OCRModel.objects.filter(is_active=True)
        serializer = OCRModelSerializer(models, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个OCR模型详情"""
        try:
            model = OCRModel.objects.get(id=pk, is_active=True)
            serializer = OCRModelSerializer(model)
            return Response(serializer.data)
        except OCRModel.DoesNotExist:
            return Response(
                {"detail": "OCR模型不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建OCR模型"""
        serializer = OCRModelSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 创建OCR模型
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新OCR模型"""
        try:
            model = OCRModel.objects.get(id=pk, is_active=True)
            serializer = OCRModelSerializer(model, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新OCR模型
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except OCRModel.DoesNotExist:
            return Response(
                {"detail": "OCR模型不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除OCR模型"""
        try:
            model = OCRModel.objects.get(id=pk, is_active=True)
            model.is_active = False
            model.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except OCRModel.DoesNotExist:
            return Response(
                {"detail": "OCR模型不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
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
            os.makedirs('media/ocr', exist_ok=True)  # 确保目录存在
            image_path = f'media/ocr/{timezone.now().strftime("%Y%m%d_%H%M%S")}.png'
            with open(image_path, 'wb') as f:
                for chunk in image_file.chunks():
                    f.write(chunk)

            # 使用Tesseract进行OCR识别
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image, lang='chi_sim')

            # 创建OCR模型
            model = OCRModel(
                id=uuid.uuid4(),
                name=f"OCR识别 - {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
                description="通过Tesseract OCR识别的文本",
                model_type='tesseract',
                language='chi_sim',
                is_active=True,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 保存模型文件
            with open(image_path, 'rb') as f:
                model.model_file.put(f, content_type='image/png')

            model.save()

            return Response({
                'message': '识别成功',
                'recognized_text': text,
                'model_id': str(model.id)
            })
        except Exception as e:
            logger.error(f"OCR识别失败: {str(e)}")
            return Response(
                {'error': f'OCR识别失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class OCRTrainingDataViewSet(viewsets.ViewSet):
    """
    OCR训练数据视图集
    """
    serializer_class = OCRTrainingDataSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取OCR训练数据列表"""
        user = request.user
        training_data = OCRTrainingData.objects.filter(user=user, is_verified=False)
        serializer = OCRTrainingDataSerializer(training_data, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个OCR训练数据详情"""
        try:
            training_data = OCRTrainingData.objects.get(id=pk)
            # 检查权限
            if training_data.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此训练数据"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = OCRTrainingDataSerializer(training_data)
            return Response(serializer.data)
        except OCRTrainingData.DoesNotExist:
            return Response(
                {"detail": "训练数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建OCR训练数据"""
        serializer = OCRTrainingDataSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 创建OCR训练数据
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新OCR训练数据"""
        try:
            training_data = OCRTrainingData.objects.get(id=pk, user=request.user)
            serializer = OCRTrainingDataSerializer(training_data, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新OCR训练数据
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except OCRTrainingData.DoesNotExist:
            return Response(
                {"detail": "训练数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除OCR训练数据"""
        try:
            training_data = OCRTrainingData.objects.get(id=pk, user=request.user)
            training_data.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except OCRTrainingData.DoesNotExist:
            return Response(
                {"detail": "训练数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def export(self, request):
        """导出训练数据"""
        try:
            training_data = OCRTrainingData.objects.filter(user=request.user)
            serializer = OCRTrainingDataSerializer(training_data, many=True)
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
                # 创建OCR训练数据
                training_data = OCRTrainingData(
                    id=uuid.uuid4(),
                    user=request.user,
                    text=item.get('text', ''),
                    language=item.get('language', ''),
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )

                # 处理图片
                if 'image' in item and item['image']:
                    image_path = item['image']
                    if os.path.exists(image_path):
                        with open(image_path, 'rb') as f:
                            training_data.image.put(f, content_type='image/png')

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
            training_data = OCRTrainingData.objects.get(id=pk)

            # 检查权限
            if not request.user.is_staff:
                return Response(
                    {"detail": "您没有权限验证训练数据"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 验证训练数据
            training_data.verify(request.user)

            serializer = OCRTrainingDataSerializer(training_data)
            return Response({
                'message': '验证成功',
                'training_data': serializer.data
            })
        except OCRTrainingData.DoesNotExist:
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