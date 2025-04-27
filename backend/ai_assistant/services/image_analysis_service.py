"""
图像分析服务
提供图像分析功能
"""

import os
import base64
import logging
from typing import Dict, Any, List, Optional
from django.conf import settings
import openai

logger = logging.getLogger(__name__)


class ImageAnalysisService:
    """
    图像分析服务
    提供图像分析功能
    """
    
    def __init__(self):
        """
        初始化图像分析服务
        """
        self.api_key = settings.OPENAI_API_KEY
        openai.api_key = self.api_key
    
    def analyze_image(self, file_path: str, task: str = 'describe', prompt: str = '') -> Dict[str, Any]:
        """
        分析图像
        
        Args:
            file_path: 图像文件路径
            task: 任务类型，可选值：describe, analyze, extract_text, identify_objects
            prompt: 自定义提示词
            
        Returns:
            分析结果
        """
        # 读取图像文件
        with open(file_path, 'rb') as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        # 根据任务类型生成提示词
        system_prompt = self._get_system_prompt(task)
        user_prompt = prompt if prompt else self._get_user_prompt(task)
        
        try:
            # 调用OpenAI API
            response = openai.ChatCompletion.create(
                model="gpt-4-vision-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            result = response.choices[0].message.content
            
            return {
                'result': result,
                'task': task
            }
            
        except Exception as e:
            logger.error(f"Image analysis error: {str(e)}")
            raise Exception(f"图像分析失败: {str(e)}")
    
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
            'extract_text': "你是一个OCR助手，请从图像中提取所有可见的文本内容，保持原始格式。",
            'identify_objects': "你是一个物体识别助手，请识别并列出图像中的所有物体，并标注它们的位置。"
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
            'describe': "请详细描述这张图片中的内容。",
            'analyze': "请分析这张图片，提供你的专业见解。",
            'extract_text': "请提取图片中的所有文本内容。",
            'identify_objects': "请识别并列出图片中的所有物体。"
        }
        
        return prompts.get(task, prompts['describe'])
