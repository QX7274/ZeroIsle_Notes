"""
文本处理服务
提供文本处理功能
"""

import logging
from typing import Dict, Any, List, Optional
from django.conf import settings
import openai

logger = logging.getLogger(__name__)


class TextProcessingService:
    """
    文本处理服务
    提供文本处理功能
    """
    
    def __init__(self):
        """
        初始化文本处理服务
        """
        self.api_key = settings.OPENAI_API_KEY
        openai.api_key = self.api_key
    
    def process_text(self, text: str, task: str = 'summarize') -> Dict[str, Any]:
        """
        处理文本
        
        Args:
            text: 文本内容
            task: 任务类型，可选值：summarize, translate, analyze, extract_keywords, rewrite
            
        Returns:
            处理结果
        """
        # 根据任务类型生成提示词
        system_prompt = self._get_system_prompt(task)
        user_prompt = self._get_user_prompt(task, text)
        
        try:
            # 调用OpenAI API
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            result = response.choices[0].message.content
            
            return {
                'result': result,
                'task': task
            }
            
        except Exception as e:
            logger.error(f"Text processing error: {str(e)}")
            raise Exception(f"文本处理失败: {str(e)}")
    
    def _get_system_prompt(self, task: str) -> str:
        """
        获取系统提示词
        
        Args:
            task: 任务类型
            
        Returns:
            系统提示词
        """
        prompts = {
            'summarize': "你是一个专业的文本摘要助手，请提供简洁而全面的摘要。",
            'translate': "你是一个专业的翻译助手，请将文本翻译成中文，保持原意的同时使表达更加地道。",
            'analyze': "你是一个专业的文本分析师，请分析文本的主题、结构、风格和情感倾向。",
            'extract_keywords': "你是一个关键词提取助手，请从文本中提取最重要的关键词和短语。",
            'rewrite': "你是一个文本改写助手，请改写文本使其更加清晰、简洁和专业。"
        }
        
        return prompts.get(task, prompts['summarize'])
    
    def _get_user_prompt(self, task: str, text: str) -> str:
        """
        获取用户提示词
        
        Args:
            task: 任务类型
            text: 文本内容
            
        Returns:
            用户提示词
        """
        prompts = {
            'summarize': f"请对以下文本进行摘要：\n\n{text}",
            'translate': f"请将以下文本翻译成中文：\n\n{text}",
            'analyze': f"请分析以下文本：\n\n{text}",
            'extract_keywords': f"请从以下文本中提取关键词和短语：\n\n{text}",
            'rewrite': f"请改写以下文本：\n\n{text}"
        }
        
        return prompts.get(task, prompts['summarize'])
