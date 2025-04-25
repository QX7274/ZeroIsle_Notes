"""
OpenAI服务
"""

import logging
import json
import requests
from django.conf import settings
from ai_assistant.models import UsageRecord, ModelConfig
from .token_counter import TokenCounter

logger = logging.getLogger('backend')

class OpenAIService:
    """
    OpenAI服务类
    处理与OpenAI API的交互
    """
    
    def __init__(self):
        """初始化"""
        self.api_key = settings.OPENAI_API_KEY
        self.api_base = "https://api.openai.com/v1"
        self.token_counter = TokenCounter()
    
    def chat_completion(self, messages, model="gpt-3.5-turbo", temperature=0.7, max_tokens=None, user=None, conversation=None):
        """
        聊天补全
        
        Args:
            messages: 消息列表
            model: 模型名称
            temperature: 温度
            max_tokens: 最大令牌数
            user: 用户对象
            conversation: 对话对象
            
        Returns:
            dict: API响应
        """
        if not self.api_key:
            logger.error("OpenAI API密钥未配置")
            raise ValueError("OpenAI API密钥未配置")
        
        try:
            # 构建请求数据
            data = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
            }
            
            if max_tokens:
                data["max_tokens"] = max_tokens
            
            # 发送请求
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                data=json.dumps(data)
            )
            
            # 检查响应
            if response.status_code != 200:
                logger.error(f"OpenAI API请求失败: {response.status_code} {response.text}")
                raise ValueError(f"OpenAI API请求失败: {response.status_code}")
            
            result = response.json()
            
            # 记录使用情况
            if user:
                usage = result.get('usage', {})
                prompt_tokens = usage.get('prompt_tokens', 0)
                completion_tokens = usage.get('completion_tokens', 0)
                
                # 计算成本
                try:
                    model_config = ModelConfig.objects.get(name=model, provider='openai')
                    input_cost = (prompt_tokens / 1000) * float(model_config.price_per_1k_tokens_input)
                    output_cost = (completion_tokens / 1000) * float(model_config.price_per_1k_tokens_output)
                    total_cost = input_cost + output_cost
                except ModelConfig.DoesNotExist:
                    total_cost = 0
                
                UsageRecord.create_record(
                    user=user,
                    model=model,
                    provider='openai',
                    conversation=conversation,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    cost=total_cost
                )
            
            return result
        except Exception as e:
            logger.error(f"OpenAI聊天补全失败: {e}")
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
    
    def get_available_models(self):
        """
        获取可用模型
        
        Returns:
            list: 可用模型列表
        """
        if not self.api_key:
            logger.error("OpenAI API密钥未配置")
            return []
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.api_base}/models",
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"获取OpenAI模型失败: {response.status_code} {response.text}")
                return []
            
            result = response.json()
            models = result.get('data', [])
            
            # 过滤出聊天模型
            chat_models = [
                model for model in models 
                if model['id'].startswith('gpt-')
            ]
            
            return chat_models
        except Exception as e:
            logger.error(f"获取OpenAI模型失败: {e}")
            return []
