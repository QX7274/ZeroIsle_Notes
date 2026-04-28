"""
对话服务
"""

import json

import logging
from django.utils import timezone
from ai_assistant.models import Conversation, Message, ModelConfig, UsageRecord
from .openai_service import OpenAIService
from .baidu_service import BaiduService
from .xunfei_service import XunfeiService
from .token_counter import TokenCounter
from ..tools import tool_registry

logger = logging.getLogger('backend')

class ConversationService:
    """
    对话服务类
    处理对话相关的业务逻辑
    """

    def __init__(self):
        """初始化 (使用服务注册表)"""
        self.providers = {
            'openai': OpenAIService(),
            'baidu': BaiduService(),
            'xunfei': XunfeiService(),
        }
        self.provider_routing = {
            'gpt-': 'openai',
            'ernie-': 'baidu',
            'spark-': 'xunfei',
        }
        self.token_counter = TokenCounter()
        self.tool_registry = tool_registry

    def _get_provider(self, model_name: str):
        """根据模型名称获取服务提供者"""
        for prefix, provider_key in self.provider_routing.items():
            if model_name.startswith(prefix):
                provider = self.providers.get(provider_key)
                if provider:
                    return provider
        raise ValueError(f"不支持的模型或提供者: {model_name}")

    def create_conversation(self, user, title=None, model=None, system_prompt=None):
        """
        创建对话

        Args:
            user: 用户对象
            title: 对话标题
            model: 模型名称
            system_prompt: 系统提示词

        Returns:
            Conversation: 创建的对话
        """
        try:
            # 如果未指定模型，使用默认模型
            if not model:
                default_model = ModelConfig.get_default()
                model = default_model.name if default_model else "gpt-3.5-turbo"

            # 创建对话
            conversation = Conversation.objects.create(
                user=user,
                title=title or "新对话",
                model=model,
                system_prompt=system_prompt
            )

            # 如果有系统提示词，添加系统消息
            if system_prompt:
                conversation.add_message('system', system_prompt)

            return conversation
        except Exception as e:
            logger.error(f"创建对话失败: {e}")
            raise

    def send_message(self, conversation, content, user, tools=None, response_format=None):
        """
        发送消息

        Args:
            conversation: 对话对象
            content: 消息内容
            user: 用户对象

        Returns:
            Message: 助手回复的消息
        """
        try:
            # 添加用户消息
            user_message = conversation.add_message('user', content)

            # 获取对话历史
            messages = self._get_conversation_messages(conversation)

            # 根据模型获取服务提供者并发送消息
            provider = self._get_provider(conversation.model)
            response = provider.chat_completion(
                messages=messages,
                model=conversation.model,
                temperature=conversation.temperature,
                max_tokens=conversation.max_tokens,
                user=user,
                conversation=conversation,
                tools=tools,
                response_format=response_format
            )

            # Handle response with potential tool calls
            usage = response.get('usage', {})
            prompt_tokens = usage.get('prompt_tokens', 0)
            completion_tokens = usage.get('completion_tokens', 0)

            if response.get('tool_calls'):
                # Step 1: Save the assistant's message with tool calls
                conversation.add_message(
                    role='assistant',
                    content=None,
                    tool_calls=response['tool_calls'],
                    tokens=completion_tokens
                )

                # Step 2: Execute tools and collect results
                for tool_call in response['tool_calls']:
                    tool_name = tool_call['function']['name']
                    tool_to_call = self.tool_registry.get(tool_name)
                    if not tool_to_call:
                        tool_output = f"Error: Tool '{tool_name}' not found."
                    else:
                        tool_function = tool_to_call['function']
                        try:
                            tool_args = json.loads(tool_call['function']['arguments'])
                            logger.info(f"Calling tool '{tool_name}' with args: {tool_args}")
                            tool_output = tool_function(**tool_args)
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to decode arguments for tool '{tool_name}': {e}. Arguments: {tool_call['function']['arguments']}")
                            tool_output = f"Error: Invalid arguments provided for tool '{tool_name}'. Arguments must be a valid JSON object."
                        except Exception as e:
                            logger.error(f"Error executing tool '{tool_name}': {e}", exc_info=True)
                            tool_output = f"Error executing tool '{tool_name}': {e}"

                    # Step 3: Add tool result message to conversation
                    conversation.add_message(
                        role='tool',
                        content=tool_output,
                        tool_call_id=tool_call['id']
                    )

                # Step 4: Get updated message history and send back to model
                messages_after_tools = self._get_conversation_messages(conversation)
                final_response = provider.chat_completion(
                    messages=messages_after_tools,
                    model=conversation.model,
                    temperature=conversation.temperature,
                    max_tokens=conversation.max_tokens,
                    user=user,
                    conversation=conversation
                )
                assistant_content = final_response.get('content', 'Error processing tool results.')
                assistant_message = conversation.add_message('assistant', assistant_content)
            else:
                # Handle standard text response
                assistant_content = response.get('content', 'Error: No content in response')
                assistant_message = conversation.add_message('assistant', assistant_content, tokens=completion_tokens)

            # Update user message tokens and record usage
            if prompt_tokens > 0:
                user_message.tokens = prompt_tokens
                user_message.save(update_fields=['tokens'])

            # Centralized Usage Recording
            try:
                model_config = ModelConfig.objects.get(name=conversation.model)
                provider_name = self._get_provider(conversation.model).__class__.__name__.replace('Service', '').lower()
                input_cost = (prompt_tokens / 1000) * float(model_config.price_per_1k_tokens_input)
                output_cost = (completion_tokens / 1000) * float(model_config.price_per_1k_tokens_output)
                total_cost = input_cost + output_cost

                UsageRecord.create_record(
                    user=user,
                    model=conversation.model,
                    provider=provider_name,
                    conversation=conversation,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    cost=total_cost
                )
            except ModelConfig.DoesNotExist:
                logger.warning(f"ModelConfig not found for {conversation.model}. Cannot record cost.")
            except Exception as e:
                logger.error(f"Failed to record usage: {e}")

            # 如果对话没有标题，使用第一条消息生成标题
            if conversation.title == "新对话" and conversation.messages.count() <= 3:
                conversation.title = self._generate_title(content, assistant_content)
                conversation.save(update_fields=['title'])

            # 更新对话的最后消息时间
            conversation.last_message_at = timezone.now()
            conversation.save(update_fields=['last_message_at'])

            return assistant_message
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            # 添加错误消息
            error_message = f"抱歉，处理您的请求时出现了错误: {str(e)}"
            return conversation.add_message('assistant', error_message)

    def _get_conversation_messages(self, conversation):
        """
        获取对话历史 (增加上下文裁剪)
        """
        try:
            model_config = ModelConfig.objects.get(name=conversation.model)
            token_limit = model_config.token_limit
        except ModelConfig.DoesNotExist:
            token_limit = 4096  # Fallback to a default limit

        messages = []
        system_message = None
        if conversation.system_prompt:
            system_message = {"role": "system", "content": conversation.system_prompt}

        history_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in conversation.messages.all() if msg.role != 'system'
        ]

        # 简单的滚动窗口裁剪
        current_tokens = self.token_counter.count_tokens(history_messages, conversation.model)
        while current_tokens > token_limit and len(history_messages) > 1:
            history_messages.pop(0) # Remove the oldest message
            current_tokens = self.token_counter.count_tokens(history_messages, conversation.model)

        if system_message:
            messages.append(system_message)
        messages.extend(history_messages)

        return messages

    def _generate_title(self, user_message, assistant_message):
        """
        生成对话标题

        Args:
            user_message: 用户消息
            assistant_message: 助手消息

        Returns:
            str: 生成的标题
        """
        # 使用用户消息的前20个字符作为标题
        title = user_message[:20]
        if len(user_message) > 20:
            title += "..."
        return title
