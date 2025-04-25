"""
令牌计数器
"""

import logging
import tiktoken

logger = logging.getLogger('backend')

class TokenCounter:
    """
    令牌计数器类
    计算文本的令牌数
    """
    
    def __init__(self):
        """初始化"""
        self.encoders = {}
    
    def get_encoder(self, model):
        """
        获取编码器
        
        Args:
            model: 模型名称
            
        Returns:
            tiktoken.Encoding: 编码器
        """
        if model in self.encoders:
            return self.encoders[model]
        
        try:
            if model.startswith("gpt-4"):
                encoding_name = "cl100k_base"
            elif model.startswith("gpt-3.5-turbo"):
                encoding_name = "cl100k_base"
            else:
                encoding_name = tiktoken.encoding_for_model(model)
            
            encoder = tiktoken.get_encoding(encoding_name)
            self.encoders[model] = encoder
            return encoder
        except Exception as e:
            logger.error(f"获取编码器失败: {e}")
            # 默认使用p50k_base编码器
            encoder = tiktoken.get_encoding("p50k_base")
            self.encoders[model] = encoder
            return encoder
    
    def count_tokens(self, messages, model):
        """
        计算消息列表的令牌数
        
        Args:
            messages: 消息列表
            model: 模型名称
            
        Returns:
            int: 令牌数
        """
        try:
            encoder = self.get_encoder(model)
            
            # 根据不同模型使用不同的计算方法
            if model.startswith("gpt-3.5-turbo") or model.startswith("gpt-4"):
                return self._count_chat_tokens(messages, encoder, model)
            else:
                return self._count_text_tokens(messages, encoder)
        except Exception as e:
            logger.error(f"计算令牌数失败: {e}")
            # 简单估算：每4个字符约1个令牌
            return sum(len(str(m.get('content', ''))) // 4 for m in messages)
    
    def _count_chat_tokens(self, messages, encoder, model):
        """
        计算聊天消息的令牌数
        
        Args:
            messages: 消息列表
            encoder: 编码器
            model: 模型名称
            
        Returns:
            int: 令牌数
        """
        # 每条消息的基础令牌数
        tokens_per_message = 4
        
        # 如果是gpt-4，每条消息额外加3个令牌
        if model.startswith("gpt-4"):
            tokens_per_message = 3
        
        # 所有消息共享的令牌数
        tokens_per_request = 3
        
        total_tokens = tokens_per_request
        
        for message in messages:
            total_tokens += tokens_per_message
            
            for key, value in message.items():
                if key == "name":  # 名称字段单独计算
                    total_tokens += 1
                else:
                    total_tokens += len(encoder.encode(str(value)))
        
        return total_tokens
    
    def _count_text_tokens(self, messages, encoder):
        """
        计算文本的令牌数
        
        Args:
            messages: 消息列表或文本
            encoder: 编码器
            
        Returns:
            int: 令牌数
        """
        if isinstance(messages, str):
            return len(encoder.encode(messages))
        
        if isinstance(messages, list):
            text = ""
            for message in messages:
                if isinstance(message, dict):
                    text += str(message.get('content', '')) + " "
                else:
                    text += str(message) + " "
            return len(encoder.encode(text))
        
        return 0
