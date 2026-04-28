"""
文本处理服务
提供文本处理功能（升级：统一SDK/超时重试/可配置参数/用量返回/审计与token预算）
"""

import json
import logging
import time
import uuid
from typing import Dict, Any, Optional

from .base_provider import get_openai_client, classify_openai_error, retryable
from .token_counter import TokenCounter

logger = logging.getLogger(__name__)


class TextProcessingService:
    """
    文本处理服务
    - 统一使用 OpenAI v1 SDK 客户端
    - 可配置参数（model/temperature/max_tokens）
    - 指数退避重试 + 超时（由统一客户端配置）
    - 返回 usage/model/finish_reason/trace 信息
    - 基于 TokenCounter 的输入预算与截断
    """

    def __init__(self):
        """初始化文本处理服务（统一OpenAI客户端）"""
        self.client = get_openai_client()
        self.token_counter = TokenCounter()

    def process_text(
        self,
        text: str,
        task: str = 'summarize',
        *,
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        user: Optional[object] = None,
        conversation: Optional[object] = None,
    ) -> Dict[str, Any]:
        """
        处理文本

        Args:
            text: 文本内容
            task: 任务类型，可选：summarize/translate/analyze/extract_keywords/rewrite/...
            model: 模型名称
            temperature: 采样温度
            max_tokens: 最大生成tokens
            user: 可选，调用用户（用于审计扩展）
            conversation: 可选，对话标识（用于审计扩展）

        Returns:
            dict: {
              result, task, usage{prompt_tokens,completion_tokens,total_tokens},
              model, finish_reason, trace_id, duration_ms
            }
        """
        trace_id = uuid.uuid4().hex
        t0 = time.time()

        # 1) 构造提示词
        system_prompt = self._get_system_prompt(task)
        # 2) 进行简单的token预算：为输出预留 max_tokens，输入预算≈ 上下文上限 - 预留
        # 无法可靠获取各模型上限，这里采用经验预算：gpt-3.5/4 系列通常 8k/128k，本处保守假设 8k
        token_limit_guess = 8192
        reserved_for_output = max(512, max_tokens)
        budget_for_input = max(1024, token_limit_guess - reserved_for_output)

        # 基于预算对输入截断（粗略：4字符≈1token）
        approx_input_tokens = max(1, len(text) // 4)
        if approx_input_tokens > budget_for_input:
            # 预截断文本
            allowed_chars = budget_for_input * 4
            text = text[:allowed_chars]

        user_prompt = self._get_user_prompt(task, text)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # 进一步使用 TokenCounter 复核预算，若仍超限则继续裁剪
        try:
            total_prompt_tokens = self.token_counter.count_tokens(messages, model)
            while total_prompt_tokens > budget_for_input and len(user_prompt) > 200:
                # 按比例裁剪 user_prompt（保留前段）
                ratio = budget_for_input / max(total_prompt_tokens, 1)
                keep = max(200, int(len(user_prompt) * ratio))
                user_prompt = user_prompt[:keep]
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
                total_prompt_tokens = self.token_counter.count_tokens(messages, model)
        except Exception:
            # 安全回退：保持现有messages
            pass

        params = dict(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        try:
            call = lambda: self.client.chat.completions.create(**params)
            response = retryable(call, retries=3, base_delay=0.8, max_delay=6.0, logger_name='backend')()

            choice = response.choices[0]
            message = choice.message
            content = getattr(message, 'content', '') or ''
            finish_reason = getattr(choice, 'finish_reason', None)

            usage = {
                'prompt_tokens': getattr(response.usage, 'prompt_tokens', 0) if hasattr(response, 'usage') else 0,
                'completion_tokens': getattr(response.usage, 'completion_tokens', 0) if hasattr(response, 'usage') else 0,
            }
            usage['total_tokens'] = usage['prompt_tokens'] + usage['completion_tokens']

            # 任务特化处理：尽量解析JSON（提取概念/关系）
            parsed: Optional[Any] = None
            if task in ('extract_concepts', 'find_relations'):
                try:
                    parsed = json.loads(content)
                except Exception:
                    parsed = None

            duration_ms = int((time.time() - t0) * 1000)
            result: Dict[str, Any] = {
                'result': parsed if parsed is not None else content,
                'task': task,
                'usage': usage,
                'model': getattr(response, 'model', model) or model,
                'finish_reason': finish_reason,
                'trace_id': trace_id,
                'duration_ms': duration_ms,
                'raw_id': getattr(response, 'id', None),
            }

            # 回退策略：当任务要求JSON但解析失败时，提供简单降级结构
            if parsed is None and task == 'extract_concepts':
                # 简单按逗号/空格切分作为关键词降级
                keys = [k.strip() for k in content.replace('\n', ' ').replace('、', ',').split(',') if k.strip()]
                result['result'] = [{"name": k, "description": "", "weight": 0.5} for k in keys[:20]] if keys else content
            elif parsed is None and task == 'find_relations':
                # 降级为空列表，保留原文
                result['result'] = [] if content.strip() == '' else content

            return result

        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"Text processing error[{category}] (trace_id={trace_id}): {e}")
            raise Exception(f"文本处理失败[{category}]：{str(e)}")

    def _get_system_prompt(self, task: str) -> str:
        """获取系统提示词"""
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
        """获取用户提示词"""
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
