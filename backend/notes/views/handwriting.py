"""
手写识别视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import Handwriting
from notes.serializers import HandwritingSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
from PIL import Image
import numpy as np
import uuid

# 条件导入tensorflow，如果没有安装则提供一个占位符
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    # 创建一个占位符类，避免导入错误
    class TensorflowPlaceholder:
        class keras:
            class models:
                @staticmethod
                def load_model(*args, **kwargs):
                    raise ImportError("Tensorflow is not installed. Please install it to use handwriting recognition features.")

logger = logging.getLogger(__name__)

class HandwritingViewSet(viewsets.ViewSet):
    """
    手写识别视图集
    """
    serializer_class = HandwritingSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取手写记录列表"""
        user = request.user
        handwritings = Handwriting.objects.filter(user=user, is_deleted=False)
        serializer = HandwritingSerializer(handwritings, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个手写记录详情"""
        try:
            handwriting = Handwriting.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if handwriting.user != request.user and not handwriting.is_public:
                return Response(
                    {"detail": "您没有权限查看此手写记录"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = HandwritingSerializer(handwriting)
            return Response(serializer.data)
        except Handwriting.DoesNotExist:
            return Response(
                {"detail": "手写记录不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建手写记录"""
        serializer = HandwritingSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 创建手写记录
            handwriting = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新手写记录"""
        try:
            handwriting = Handwriting.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = HandwritingSerializer(handwriting, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新手写记录
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Handwriting.DoesNotExist:
            return Response(
                {"detail": "手写记录不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除手写记录"""
        try:
            handwriting = Handwriting.objects.get(id=pk, user=request.user, is_deleted=False)
            handwriting.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Handwriting.DoesNotExist:
            return Response(
                {"detail": "手写记录不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def recognize(self, request):
        """识别手写内容"""
        try:
            # 检查是否安装了tensorflow
            if not TF_AVAILABLE:
                return Response(
                    {'error': 'Tensorflow未安装，无法使用手写识别功能'},
                    status=status.HTTP_501_NOT_IMPLEMENTED
                )

            image_file = request.FILES.get('image')
            if not image_file:
                return Response(
                    {'error': '未提供图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 保存图片
            os.makedirs('media/handwriting', exist_ok=True)  # 确保目录存在
            image_path = f'media/handwriting/{timezone.now().strftime("%Y%m%d_%H%M%S")}.png'
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

            # 创建手写记录
            handwriting = Handwriting(
                id=uuid.uuid4(),
                user=request.user,
                title=f"手写识别 - {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
                text_content=str(predicted_class),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 保存图片
            with open(image_path, 'rb') as f:
                handwriting.image.put(f, content_type='image/png')

            # 生成缩略图
            try:
                img = Image.open(image_path)
                img.thumbnail((300, 300))
                thumb_path = f'media/handwriting/thumb_{timezone.now().strftime("%Y%m%d_%H%M%S")}.png'
                img.save(thumb_path)

                with open(thumb_path, 'rb') as f:
                    handwriting.thumbnail.put(f, content_type='image/png')
            except Exception as e:
                logger.error(f"缩略图生成失败: {str(e)}")

            handwriting.save()

            return Response({
                'message': '识别成功',
                'recognized_text': handwriting.text_content,
                'handwriting_id': str(handwriting.id)
            })
        except Exception as e:
            logger.error(f"手写识别失败: {str(e)}")
            return Response(
                {'error': f'手写识别失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def correct(self, request, pk=None):
        """纠正识别结果"""
        try:
            handwriting = Handwriting.objects.get(id=pk, user=request.user, is_deleted=False)

            corrected_text = request.data.get('corrected_text')
            if not corrected_text:
                return Response(
                    {'error': '未提供纠正后的文本'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            handwriting.text_content = corrected_text
            handwriting.updated_at = timezone.now()
            handwriting.save()

            return Response({
                'message': '纠正成功',
                'corrected_text': handwriting.text_content
            })
        except Handwriting.DoesNotExist:
            return Response(
                {"detail": "手写记录不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"纠正识别结果失败: {str(e)}")
            return Response(
                {'error': f'纠正识别结果失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def training_data(self, request):
        """获取训练数据"""
        try:
            # 获取所有已纠正的手写记录
            handwritings = Handwriting.objects.filter(
                user=request.user,
                is_deleted=False
            )

            serializer = HandwritingSerializer(handwritings, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取训练数据失败: {str(e)}")
            return Response(
                {'error': f'获取训练数据失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )