"""
手写识别视图 - 增强版
支持多种模型和离线处理
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.conf import settings
from notes.mongodb_models import Handwriting
from notes.serializers import HandwritingSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
import io
import base64
from PIL import Image, ImageOps, ImageFilter
import numpy as np
import uuid
import json
import re
from pathlib import Path

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

# 条件导入ONNX运行时，用于更高效的模型推理
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False

# 条件导入OpenCV，用于图像预处理
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# 配置日志
logger = logging.getLogger(__name__)

# 模型配置
MODEL_CONFIGS = {
    'default': {
        'name': '默认手写识别模型',
        'path': 'models/handwriting/default_model.h5',
        'input_shape': (28, 28, 1),
        'preprocessing': 'basic',
        'type': 'tensorflow',
        'languages': ['zh-CN', 'en-US'],
        'classes': list('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
    },
    'chinese': {
        'name': '中文手写识别模型',
        'path': 'models/handwriting/chinese_model.h5',
        'input_shape': (64, 64, 1),
        'preprocessing': 'advanced',
        'type': 'tensorflow',
        'languages': ['zh-CN'],
        'classes': [], # 实际使用时应包含常用汉字
    },
    'shape': {
        'name': '形状识别模型',
        'path': 'models/handwriting/shape_model.onnx',
        'input_shape': (128, 128, 1),
        'preprocessing': 'contour',
        'type': 'onnx',
        'classes': ['circle', 'square', 'triangle', 'line', 'arrow', 'rectangle', 'ellipse', 'star', 'heart'],
    },
}

# 确保模型目录存在
os.makedirs('models/handwriting', exist_ok=True)

# 加载的模型缓存
loaded_models = {}

# 加载模型
def load_model(model_name):
    """
    加载指定的模型

    Args:
        model_name: 模型名称

    Returns:
        加载的模型对象
    """
    # 如果模型已加载，直接返回
    if model_name in loaded_models:
        return loaded_models[model_name]

    # 检查模型配置是否存在
    if model_name not in MODEL_CONFIGS:
        raise ValueError(f"未知的模型: {model_name}")

    config = MODEL_CONFIGS[model_name]
    model_path = config['path']
    model_type = config['type']

    # 检查模型文件是否存在
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"模型文件不存在: {model_path}")

    # 根据模型类型加载
    if model_type == 'tensorflow':
        if not TF_AVAILABLE:
            raise ImportError("Tensorflow未安装，无法加载模型")

        model = tf.keras.models.load_model(model_path)
        loaded_models[model_name] = model
        return model

    elif model_type == 'onnx':
        if not ONNX_AVAILABLE:
            raise ImportError("ONNX Runtime未安装，无法加载模型")

        # 创建ONNX会话
        session = ort.InferenceSession(model_path)
        loaded_models[model_name] = session
        return session

    else:
        raise ValueError(f"不支持的模型类型: {model_type}")

# 图像预处理
def preprocess_image(image, model_name):
    """
    根据模型要求预处理图像

    Args:
        image: PIL图像对象
        model_name: 模型名称

    Returns:
        预处理后的图像数组
    """
    if model_name not in MODEL_CONFIGS:
        raise ValueError(f"未知的模型: {model_name}")

    config = MODEL_CONFIGS[model_name]
    input_shape = config['input_shape']
    preprocessing = config['preprocessing']

    # 转换为灰度图
    if image.mode != 'L':
        image = image.convert('L')

    # 根据预处理类型处理图像
    if preprocessing == 'basic':
        # 基本预处理：调整大小、归一化
        image = image.resize((input_shape[0], input_shape[1]))
        image_array = np.array(image) / 255.0
        image_array = image_array.reshape(1, input_shape[0], input_shape[1], input_shape[2])

    elif preprocessing == 'advanced':
        # 高级预处理：对比度增强、去噪、调整大小、归一化
        image = ImageOps.autocontrast(image)
        image = image.filter(ImageFilter.SHARPEN)
        image = image.resize((input_shape[0], input_shape[1]))
        image_array = np.array(image) / 255.0
        image_array = image_array.reshape(1, input_shape[0], input_shape[1], input_shape[2])

    elif preprocessing == 'contour':
        # 轮廓预处理：用于形状识别
        if CV2_AVAILABLE:
            # 转换为OpenCV格式
            img_np = np.array(image)
            # 二值化
            _, binary = cv2.threshold(img_np, 127, 255, cv2.THRESH_BINARY_INV)
            # 查找轮廓
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            # 创建空白图像
            contour_img = np.zeros((input_shape[0], input_shape[1]), dtype=np.uint8)
            # 绘制最大轮廓
            if contours:
                max_contour = max(contours, key=cv2.contourArea)
                cv2.drawContours(contour_img, [max_contour], 0, 255, 2)
            # 归一化
            image_array = contour_img / 255.0
            image_array = image_array.reshape(1, input_shape[0], input_shape[1], input_shape[2])
        else:
            # 如果OpenCV不可用，回退到基本预处理
            image = image.resize((input_shape[0], input_shape[1]))
            image_array = np.array(image) / 255.0
            image_array = image_array.reshape(1, input_shape[0], input_shape[1], input_shape[2])

    else:
        raise ValueError(f"不支持的预处理类型: {preprocessing}")

    return image_array

# 后处理预测结果
def postprocess_prediction(prediction, model_name):
    """
    后处理模型预测结果

    Args:
        prediction: 模型预测结果
        model_name: 模型名称

    Returns:
        处理后的结果
    """
    if model_name not in MODEL_CONFIGS:
        raise ValueError(f"未知的模型: {model_name}")

    config = MODEL_CONFIGS[model_name]
    classes = config['classes']

    if model_name == 'shape':
        # 形状识别结果处理
        class_idx = np.argmax(prediction)
        if class_idx < len(classes):
            return {
                'shape': classes[class_idx],
                'confidence': float(prediction[0][class_idx])
            }
        else:
            return {
                'shape': 'unknown',
                'confidence': 0.0
            }
    else:
        # 文字识别结果处理
        class_idx = np.argmax(prediction)
        if class_idx < len(classes):
            return {
                'text': classes[class_idx],
                'confidence': float(prediction[0][class_idx])
            }
        else:
            return {
                'text': '?',
                'confidence': 0.0
            }

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
        """
        识别手写内容 - 增强版
        支持多种模型、多种输入格式和更高级的处理
        """
        try:
            # 获取请求参数
            model_name = request.data.get('model', 'default')
            language = request.data.get('language', 'zh-CN')
            save_result = request.data.get('save_result', True)

            # 检查模型是否存在
            if model_name not in MODEL_CONFIGS:
                return Response(
                    {'error': f'未知的模型: {model_name}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 检查语言是否支持
            if model_name != 'shape' and language not in MODEL_CONFIGS[model_name]['languages']:
                return Response(
                    {'error': f'模型 {model_name} 不支持语言: {language}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取图像数据
            image_data = None
            image_file = request.FILES.get('image')
            base64_image = request.data.get('image_base64')

            if image_file:
                # 从文件获取图像
                image_data = image_file.read()
            elif base64_image:
                # 从Base64字符串获取图像
                try:
                    # 移除可能的前缀
                    if ',' in base64_image:
                        base64_image = base64_image.split(',', 1)[1]
                    image_data = base64.b64decode(base64_image)
                except Exception as e:
                    return Response(
                        {'error': f'Base64图像解码失败: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                return Response(
                    {'error': '未提供图片数据，请通过image文件或image_base64提供'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 创建临时文件路径
            os.makedirs('media/handwriting', exist_ok=True)
            timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
            image_path = f'media/handwriting/{timestamp}.png'

            # 保存图像
            with open(image_path, 'wb') as f:
                f.write(image_data)

            # 打开图像
            try:
                image = Image.open(image_path)
            except Exception as e:
                return Response(
                    {'error': f'图像打开失败: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 根据模型类型进行处理
            if model_name == 'shape':
                # 形状识别
                result = self._recognize_shape(image, image_path, model_name, save_result, request.user)
            else:
                # 文字识别
                result = self._recognize_text(image, image_path, model_name, language, save_result, request.user)

            return Response(result)

        except ValueError as e:
            logger.error(f"手写识别参数错误: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except ImportError as e:
            logger.error(f"手写识别依赖错误: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )
        except Exception as e:
            logger.error(f"手写识别失败: {str(e)}")
            return Response(
                {'error': f'手写识别失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _recognize_text(self, image, image_path, model_name, language, save_result, user):
        """
        识别手写文字
        """
        # 检查模型依赖
        if model_name == 'default' or model_name == 'chinese':
            if not TF_AVAILABLE:
                raise ImportError("Tensorflow未安装，无法使用手写识别功能")

        try:
            # 加载模型
            model = load_model(model_name)

            # 预处理图像
            image_array = preprocess_image(image, model_name)

            # 执行预测
            if MODEL_CONFIGS[model_name]['type'] == 'tensorflow':
                prediction = model.predict(image_array)
                result = postprocess_prediction(prediction, model_name)
            elif MODEL_CONFIGS[model_name]['type'] == 'onnx':
                # ONNX模型预测
                input_name = model.get_inputs()[0].name
                output_name = model.get_outputs()[0].name
                prediction = model.run([output_name], {input_name: image_array.astype(np.float32)})[0]
                result = postprocess_prediction(prediction, model_name)
            else:
                raise ValueError(f"不支持的模型类型: {MODEL_CONFIGS[model_name]['type']}")

            # 保存结果
            if save_result:
                handwriting = Handwriting(
                    id=uuid.uuid4(),
                    user=user,
                    title=f"手写识别 - {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    text_content=result.get('text', ''),
                    confidence=result.get('confidence', 0.0),
                    language=language,
                    model=model_name,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )

                # 保存原始图像
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

                # 添加ID到结果
                result['handwriting_id'] = str(handwriting.id)

            # 添加成功消息
            result['message'] = '识别成功'
            return result

        except Exception as e:
            logger.error(f"文字识别失败: {str(e)}")
            raise

    def _recognize_shape(self, image, image_path, model_name, save_result, user):
        """
        识别手写形状
        """
        # 检查模型依赖
        if MODEL_CONFIGS[model_name]['type'] == 'onnx' and not ONNX_AVAILABLE:
            raise ImportError("ONNX Runtime未安装，无法使用形状识别功能")

        try:
            # 加载模型
            model = load_model(model_name)

            # 预处理图像
            image_array = preprocess_image(image, model_name)

            # 执行预测
            if MODEL_CONFIGS[model_name]['type'] == 'onnx':
                # ONNX模型预测
                input_name = model.get_inputs()[0].name
                output_name = model.get_outputs()[0].name
                prediction = model.run([output_name], {input_name: image_array.astype(np.float32)})[0]
            else:
                # Tensorflow模型预测
                prediction = model.predict(image_array)

            # 后处理结果
            result = postprocess_prediction(prediction, model_name)

            # 保存结果
            if save_result:
                handwriting = Handwriting(
                    id=uuid.uuid4(),
                    user=user,
                    title=f"形状识别 - {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    text_content=result.get('shape', ''),
                    confidence=result.get('confidence', 0.0),
                    model=model_name,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )

                # 保存原始图像
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

                # 添加ID到结果
                result['handwriting_id'] = str(handwriting.id)

            # 添加成功消息
            result['message'] = '识别成功'
            return result

        except Exception as e:
            logger.error(f"形状识别失败: {str(e)}")
            raise

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

    @action(detail=False, methods=['get'])
    def supported_models(self, request):
        """获取支持的模型列表"""
        try:
            # 构建模型信息
            models_info = {}
            for model_name, config in MODEL_CONFIGS.items():
                # 检查模型文件是否存在
                model_exists = os.path.exists(config['path'])

                # 检查依赖是否满足
                dependencies_met = True
                if config['type'] == 'tensorflow' and not TF_AVAILABLE:
                    dependencies_met = False
                elif config['type'] == 'onnx' and not ONNX_AVAILABLE:
                    dependencies_met = False

                # 构建模型信息
                models_info[model_name] = {
                    'name': config['name'],
                    'type': config['type'],
                    'languages': config.get('languages', []),
                    'available': model_exists and dependencies_met,
                    'input_shape': config['input_shape'],
                    'preprocessing': config['preprocessing'],
                }

                # 如果是形状识别模型，添加支持的形状
                if model_name == 'shape':
                    models_info[model_name]['shapes'] = config['classes']

            return Response({
                'models': models_info,
                'default_model': 'default',
                'default_language': 'zh-CN'
            })
        except Exception as e:
            logger.error(f"获取支持的模型列表失败: {str(e)}")
            return Response(
                {'error': f'获取支持的模型列表失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def supported_languages(self, request):
        """获取支持的语言列表"""
        try:
            # 收集所有支持的语言
            languages = set()
            for config in MODEL_CONFIGS.values():
                if 'languages' in config:
                    languages.update(config['languages'])

            # 语言代码到名称的映射
            language_names = {
                'zh-CN': '简体中文',
                'en-US': '英语',
                'ja-JP': '日语',
                'ko-KR': '韩语',
                'fr-FR': '法语',
                'de-DE': '德语',
                'es-ES': '西班牙语',
                'it-IT': '意大利语',
                'ru-RU': '俄语',
            }

            # 构建语言信息
            languages_info = []
            for lang_code in sorted(languages):
                languages_info.append({
                    'code': lang_code,
                    'name': language_names.get(lang_code, lang_code),
                })

            return Response({
                'languages': languages_info,
                'default_language': 'zh-CN'
            })
        except Exception as e:
            logger.error(f"获取支持的语言列表失败: {str(e)}")
            return Response(
                {'error': f'获取支持的语言列表失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )