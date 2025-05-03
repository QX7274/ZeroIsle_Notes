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
            'extract_keywords': "你是一个关键词提取助手，请从文本中提取最重要的关键词和短语，用逗号分隔。",
            'rewrite': "你是一个文本改写助手，请改写文本使其更加清晰、简洁和专业，保持原意。",
            'code_recognition': "你是一个代码识别助手，请识别并格式化文本中的代码，只返回格式化后的代码，不要添加任何解释。",
            'explain': "你是一个解释助手，请用简单易懂的语言解释文本中的概念、术语或内容。",
            'grammar': "你是一个语法检查助手，请检查并修正文本中的语法、拼写和标点错误，只返回修正后的文本。",
            'simplify': "你是一个文本简化助手，请将复杂的文本简化为更容易理解的表达，保持核心含义。",
            'math_formula': "你是一个数学公式识别助手，请将文本中的数学公式转换为LaTeX格式，只返回LaTeX代码，不要添加任何解释。",
            'classify_text': "你是一个文本分类助手，请根据内容将文本分类到最合适的类别中，并给出分类理由。",
            'extract_topic': "你是一个主题提取助手，请从文本中提取主要主题，只返回一个简短的主题描述，不超过10个字。",
            'extract_concepts': "你是一个概念提取助手，请从文本中提取关键概念，并以JSON格式返回，格式为[{\"name\": \"概念名称\", \"description\": \"概念描述\", \"weight\": 权重值}]，权重值为0到1之间的小数。",
            'find_relations': "你是一个关系发现助手，请分析文本中提到的概念之间的关系，并以JSON格式返回，格式为[{\"source\": \"源概念\", \"target\": \"目标概念\", \"relation\": \"关系类型\", \"description\": \"关系描述\"}]。"
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
            'extract_keywords': f"请从以下文本中提取关键词和短语，用逗号分隔：\n\n{text}",
            'rewrite': f"请改写以下文本，保持原意但使表达更清晰：\n\n{text}",
            'code_recognition': f"请识别并格式化以下文本中的代码，只返回格式化后的代码：\n\n{text}",
            'explain': f"请用简单易懂的语言解释以下内容：\n\n{text}",
            'grammar': f"请检查并修正以下文本中的语法、拼写和标点错误，只返回修正后的文本：\n\n{text}",
            'simplify': f"请将以下复杂的文本简化为更容易理解的表达，保持核心含义：\n\n{text}",
            'math_formula': f"请将以下文本中的数学公式转换为LaTeX格式，只返回LaTeX代码：\n\n{text}",
            'classify_text': f"请根据内容将以下文本分类到最合适的类别中，并给出分类理由：\n\n{text}",
            'extract_topic': f"请从以下文本中提取主要主题，只返回一个简短的主题描述，不超过10个字：\n\n{text}",
            'extract_concepts': f"请从以下文本中提取关键概念，并以JSON格式返回，格式为[{{\"name\": \"概念名称\", \"description\": \"概念描述\", \"weight\": 权重值}}]，权重值为0到1之间的小数：\n\n{text}",
            'find_relations': f"请分析以下文本中提到的概念之间的关系，并以JSON格式返回，格式为[{{\"source\": \"源概念\", \"target\": \"目标概念\", \"relation\": \"关系类型\", \"description\": \"关系描述\"}}]：\n\n{text}"
        }

        return prompts.get(task, prompts['summarize'])
