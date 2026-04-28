"""
图像分析服务 - 增强版
提供图像分析、OCR、物体识别等功能（升级：统一SDK/输入校验/结构化返回/错误分类）
"""

import os
import time
import uuid
import base64
import logging
from typing import Dict, Any, List
from django.conf import settings
from .base_provider import get_openai_client, classify_openai_error

logger = logging.getLogger(__name__)


class ImageAnalysisService:
    """
    图像分析服务 - 增强版
    提供图像分析、OCR、物体识别、图像搜索等功能
    """

    ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}
    MAX_FILE_MB = 15

    def __init__(self):
        """初始化图像分析服务"""
        self.use_local_ocr = getattr(settings, 'USE_LOCAL_OCR', False)

    def _validate_image(self, file_path: str) -> float:
        if not os.path.exists(file_path):
            raise FileNotFoundError("图像文件不存在")
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的图像格式: {ext}")
        size_mb = os.path.getsize(file_path) / (1024 * 1024)
        if size_mb > self.MAX_FILE_MB:
            raise ValueError(f"图片过大（{size_mb:.1f}MB），上限 {self.MAX_FILE_MB}MB")
        return size_mb

    def analyze_image(self, file_path: str, task: str = 'describe', prompt: str = '') -> Dict[str, Any]:
        """
        分析图像 - 增强版

        Args:
            file_path: 图像文件路径
            task: 任务类型，可选值：describe, analyze, extract_text, identify_objects, search
            prompt: 自定义提示词

        Returns:
            分析结果
        """
        # 如果是OCR任务且启用本地OCR，使用本地OCR
        if task == 'extract_text' and self.use_local_ocr:
            return self._local_ocr(file_path)

        # 读取图像文件
        with open(file_path, 'rb') as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')

        # 根据任务类型生成提示词
        system_prompt = self._get_system_prompt(task)
        user_prompt = prompt if prompt else self._get_user_prompt(task)

        try:
            client = get_openai_client()
            # 使用 v1 SDK chat.completions，并采用支持视觉的最新模型（如 gpt-4o-mini）
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1500,
                temperature=0.2
            )

            result = resp.choices[0].message.content

            return {
                'result': result,
                'task': task,
                'success': True
            }

        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"Image analysis error[{category}]: {e}")
            # 如果API失败且是OCR任务，尝试使用本地OCR
            if task == 'extract_text':
                try:
                    return self._local_ocr(file_path)
                except Exception:
                    pass

            return {
                'result': '',
                'task': task,
                'error': str(e),
                'success': False
            }

    def _local_ocr(self, file_path: str) -> Dict[str, Any]:
        """
        使用本地OCR提取文本

        Args:
            file_path: 图像文件路径

        Returns:
            OCR结果
        """
        try:
            # 尝试使用pytesseract
            try:
                import pytesseract
                from PIL import Image

                image = Image.open(file_path)
                text = pytesseract.image_to_string(image, lang='chi_sim+eng')

                return {
                    'result': text,
                    'task': 'extract_text',
                    'method': 'local_ocr',
                    'success': True
                }
            except ImportError:
                logger.warning("pytesseract not installed, trying paddleocr")

                # 尝试使用PaddleOCR
                try:
                    from paddleocr import PaddleOCR

                    ocr = PaddleOCR(use_angle_cls=True, lang='ch')
                    result = ocr.ocr(file_path, cls=True)

                    # 提取文本
                    text_lines = []
                    if result:
                        for line in result:
                            if line:
                                for item in line:
                                    if len(item) >= 2:
                                        text_lines.append(item[1][0])

                    text = '\n'.join(text_lines)

                    return {
                        'result': text,
                        'task': 'extract_text',
                        'method': 'paddleocr',
                        'success': True
                    }
                except ImportError:
                    logger.error("No OCR library available")
                    return {
                        'result': '',
                        'task': 'extract_text',
                        'error': 'No OCR library available',
                        'success': False
                    }
        except Exception as e:
            logger.error(f"Local OCR error: {str(e)}")
            return {
                'result': '',
                'task': 'extract_text',
                'error': str(e),
                'success': False
            }
    
    def _get_system_prompt(self, task: str) -> str:
        """
        获取系统提示词

        Args:
            task: 任务类型

        Returns:
            系统提示词
        """
        prompts = {
            'describe': "你是一个专业的图像描述助手，请详细描述图像中的内容，包括主体、背景、颜色、情绪等方面。",
            'analyze': "你是一个专业的图像分析师，请分析图像中的内容，提供深入的见解和解释。",
            'extract_text': "你是一个OCR助手，请从图像中提取所有可见的文本内容，保持原始格式和排版。",
            'identify_objects': "你是一个物体识别助手，请识别并列出图像中的所有物体，并标注它们的位置和特征。",
            'search': "你是一个图像搜索助手，请提取图像中的关键信息和特征，生成适合搜索的关键词和描述。"
        }

        return prompts.get(task, prompts['describe'])

    def _get_user_prompt(self, task: str) -> str:
        """
        获取用户提示词

        Args:
            task: 任务类型

        Returns:
            用户提示词
        """
        prompts = {
            'describe': "请详细描述这张图片中的内容，包括场景、物体、人物、颜色、氛围等。",
            'analyze': "请分析这张图片，提供你的专业见解，包括构图、主题、意义等。",
            'extract_text': "请提取图片中的所有文本内容，保持原始格式和排版，包括标题、正文、标注等。",
            'identify_objects': "请识别并列出图片中的所有物体，包括它们的位置、大小、颜色等特征。",
            'search': "请分析这张图片，提取关键信息和特征，生成适合用于搜索的关键词和简短描述。"
        }

        return prompts.get(task, prompts['describe'])

    def batch_analyze_images(self, file_paths: List[str], task: str = 'describe') -> List[Dict[str, Any]]:
        """
        批量分析图像

        Args:
            file_paths: 图像文件路径列表
            task: 任务类型

        Returns:
            分析结果列表
        """
        results = []
        for file_path in file_paths:
            try:
                result = self.analyze_image(file_path, task)
                results.append({
                    'file_path': file_path,
                    **result
                })
            except Exception as e:
                logger.error(f"Batch analysis error for {file_path}: {str(e)}")
                results.append({
                    'file_path': file_path,
                    'result': '',
                    'error': str(e),
                    'success': False
                })

        return results

    def compare_images(self, file_path1: str, file_path2: str) -> Dict[str, Any]:
        """比较两张图像（统一SDK + 输入校验 + 结构化返回）"""
        trace_id = uuid.uuid4().hex
        t0 = time.time()
        try:
            # 校验
            size1 = self._validate_image(file_path1)
            size2 = self._validate_image(file_path2)

            # 读取两张图像
            with open(file_path1, 'rb') as f1:
                base64_image1 = base64.b64encode(f1.read()).decode('utf-8')
            with open(file_path2, 'rb') as f2:
                base64_image2 = base64.b64encode(f2.read()).decode('utf-8')

            client = get_openai_client()
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "你是一个专业的图像比较助手，请比较两张图像的异同并给出要点列表。"},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "请比较这两张图片，说明它们的相似之处和不同之处。"},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image1}", "detail": "high"}},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image2}", "detail": "high"}},
                        ],
                    },
                ],
                max_tokens=1200,
                temperature=0.2,
            )

            result_text = resp.choices[0].message.content
            duration_ms = int((time.time() - t0) * 1000)
            return {
                'result': result_text,
                'success': True,
                'trace_id': trace_id,
                'duration_ms': duration_ms,
                'file_sizes_mb': [round(size1, 2), round(size2, 2)],
            }
        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"Image comparison error[{category}] (trace_id={trace_id}): {str(e)}")
            return {
                'result': '',
                'error': str(e),
                'error_category': category,
                'success': False,
                'trace_id': trace_id,
            }
