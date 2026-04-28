"""
OpenAI服务
"""

import logging
import json
from django.conf import settings
from ai_assistant.models import UsageRecord, ModelConfig
from .token_counter import TokenCounter
from .base_provider import BaseProvider, get_openai_client, classify_openai_error, retryable

logger = logging.getLogger('backend')

class OpenAIService(BaseProvider):
    """
    OpenAI服务类
    处理与OpenAI API的交互
    """

    def __init__(self):
        """初始化统一客户端"""
        self.client = get_openai_client()
        # 保留 self.api_key 以兼容其他方法中的检查逻辑
        from django.conf import settings as _settings
        self.api_key = getattr(_settings, 'OPENAI_API_KEY', None)
        self.token_counter = TokenCounter()
    
    def chat_completion(self, messages, model="gpt-3.5-turbo", temperature=0.7, max_tokens=None, user=None, conversation=None, stream=False, tools=None, response_format=None):
        """
        聊天补全 (统一返回结构)
        - 非流式：返回 { content, usage, tool_calls? }
        - 流式：直接返回 SDK 流对象
        """
        api_key = getattr(settings, 'OPENAI_API_KEY', None)
        if not api_key:
            logger.warning("OpenAI API密钥未配置（将由客户端报错），请检查环境变量 OPENAI_API_KEY")

        try:
            params = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream,
            }
            if tools:
                params["tools"] = tools
            if response_format:
                params["response_format"] = response_format

            # 调用OpenAI，流式模式不重试，非流式加指数退避重试
            if stream:
                response = self.client.chat.completions.create(**params)
                return response
            else:
                call = lambda: self.client.chat.completions.create(**params)
                response = retryable(call, retries=3, base_delay=0.8, max_delay=6.0, logger_name='backend')()

            choice = response.choices[0]
            message = choice.message
            content = getattr(message, 'content', None)
            # 统一提取 tool_calls（展平为普通 dict 列表）
            raw_tool_calls = getattr(message, 'tool_calls', None) or []
            tool_calls = []
            if raw_tool_calls:
                for tc in raw_tool_calls:
                    try:
                        # 优先使用 pydantic 的 model_dump
                        if hasattr(tc, 'model_dump'):
                            tool_calls.append(tc.model_dump())
                        else:
                            # 手动构造字典作为备用
                            tool_calls.append({
                                'id': tc.id,
                                'type': tc.type,
                                'function': {
                                    'name': tc.function.name,
                                    'arguments': tc.function.arguments
                                }
                            })
                    except Exception as e:
                        logger.warning(f"序列化 tool_call 失败: {e}，将使用字符串表示。")
                        tool_calls.append(str(tc))

            usage = {
                'prompt_tokens': getattr(response.usage, 'prompt_tokens', 0) if hasattr(response, 'usage') else 0,
                'completion_tokens': getattr(response.usage, 'completion_tokens', 0) if hasattr(response, 'usage') else 0,
            }

            result = {'content': content, 'usage': usage}
            if tool_calls:
                result['tool_calls'] = tool_calls
            return result

        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"OpenAI聊天补全失败[{category}]: {e}")
            raise

    def count_tokens(self, messages, model="gpt-3.5-turbo"):
        """
        计算令牌数

        Args:
            messages: 消息列表
            model: 模型名称

        Returns:
            int: 令牌数
        """
        return self.token_counter.count_tokens(messages, model)

    def generate_content(self, prompt: str, type: str = 'text', length: str = 'medium', model: str = 'gpt-3.5-turbo'):
        """
        生成类工具（统一入口）
        Args:
            prompt: 提示词
            type: 生成类型（text/ideas/title/outline/code）
            length: 长度（short/medium/long）
            model: 模型名称
        Returns:
            dict: { content, usage }
        """
        # 根据类型与长度构建系统提示
        length_hint = {
            'short': '50-100 字',
            'medium': '100-200 字',
            'long': '200-400 字'
        }.get(length, '100-200 字')
        system_prompt = {
            'text': f'你是一个中文写作助手，请用清晰、准确且自然的中文输出，长度约为{length_hint}。',
            'ideas': '你是一个头脑风暴助手，请输出要点式清单，简洁明了。',
            'title': '你是一个标题生成助手，请生成不超过20字的中文标题，提供3个备选方案。',
            'outline': '你是一个大纲助手，请输出分层级的大纲（最多两级）。',
            'code': '你是一个代码助手，请输出可运行的代码片段，并用代码块格式。'
        }.get(type, '你是一个中文写作助手，请用清晰、准确且自然的中文输出。')

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
        params = {
            'model': model,
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 1000
        }
        try:
            call = lambda: self.client.chat.completions.create(**params)
            response = retryable(call, retries=3, base_delay=0.8, max_delay=6.0, logger_name='backend')()
            content = response.choices[0].message.content
            usage = {
                'prompt_tokens': getattr(response.usage, 'prompt_tokens', 0) if hasattr(response, 'usage') else 0,
                'completion_tokens': getattr(response.usage, 'completion_tokens', 0) if hasattr(response, 'usage') else 0,
            }
            return {'content': content, 'usage': usage}
        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"生成内容失败[{category}]: {e}")
            raise

    def get_available_models(self):
        """
        获取可用模型 (使用新版SDK)
        """
        if not self.api_key:
            logger.error("OpenAI API密钥未配置")
            return []

        try:
            response = self.client.models.list()
            models = response.data

            # 过滤出聊天模型并转换为dict
            chat_models = [
                model.model_dump() for model in models
                if getattr(model, 'id', '').startswith('gpt-')
            ]

            return chat_models
        except Exception as e:
            category = classify_openai_error(e)
            logger.error(f"获取OpenAI模型失败[{category}]: {e}")
            return []
