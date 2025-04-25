"""
对话服务
"""

import logging
from django.utils import timezone
from ai_assistant.models import Conversation, Message, ModelConfig
from .openai_service import OpenAIService
from .baidu_service import BaiduService
from .xunfei_service import XunfeiService

logger = logging.getLogger('backend')

class ConversationService:
    """
    对话服务类
    处理对话相关的业务逻辑
    """
    
    def __init__(self):
        """初始化"""
        self.openai_service = OpenAIService()
        self.baidu_service = BaiduService()
        self.xunfei_service = XunfeiService()
    
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
    
    def send_message(self, conversation, content, user):
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
            
            # 根据模型选择服务
            if conversation.model.startswith('gpt-'):
                response = self.openai_service.chat_completion(
                    messages=messages,
                    model=conversation.model,
                    temperature=conversation.temperature,
                    max_tokens=conversation.max_tokens,
                    user=user,
                    conversation=conversation
                )
                assistant_content = response['choices'][0]['message']['content']
                
                # 计算令牌数
                usage = response.get('usage', {})
                prompt_tokens = usage.get('prompt_tokens', 0)
                completion_tokens = usage.get('completion_tokens', 0)
                
                # 更新用户消息的令牌数
                user_message.tokens = prompt_tokens - (conversation.messages.count() - 1) * 4
                user_message.save(update_fields=['tokens'])
                
                # 添加助手消息
                assistant_message = conversation.add_message('assistant', assistant_content, tokens=completion_tokens)
            
            elif conversation.model.startswith('ernie-'):
                response = self.baidu_service.chat_completion(
                    messages=messages,
                    model=conversation.model,
                    temperature=conversation.temperature,
                    max_tokens=conversation.max_tokens,
                    user=user,
                    conversation=conversation
                )
                assistant_content = response['result']
                
                # 添加助手消息
                assistant_message = conversation.add_message('assistant', assistant_content)
            
            elif conversation.model.startswith('spark-'):
                response = self.xunfei_service.chat_completion(
                    messages=messages,
                    model=conversation.model,
                    temperature=conversation.temperature,
                    max_tokens=conversation.max_tokens,
                    user=user,
                    conversation=conversation
                )
                assistant_content = response['payload']['text']
                
                # 添加助手消息
                assistant_message = conversation.add_message('assistant', assistant_content)
            
            else:
                raise ValueError(f"不支持的模型: {conversation.model}")
            
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
        获取对话历史
        
        Args:
            conversation: 对话对象
            
        Returns:
            list: 消息列表
        """
        messages = []
        
        # 添加系统提示词
        if conversation.system_prompt:
            messages.append({
                "role": "system",
                "content": conversation.system_prompt
            })
        
        # 添加对话历史
        for message in conversation.messages.all():
            if message.role != 'system':  # 系统消息已经添加过了
                messages.append({
                    "role": message.role,
                    "content": message.content
                })
        
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
