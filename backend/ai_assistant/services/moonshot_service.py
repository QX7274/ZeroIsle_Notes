"""
Moonshot AI服务
"""

import os
import json
import requests
from typing import Dict, List, Any, Optional
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class MoonshotService:
    """
    Moonshot AI服务
    提供与Moonshot AI API的交互
    """
    
    def __init__(self):
        """初始化服务"""
        self.api_key = settings.MOONSHOT_API_KEY
        self.base_url = "https://api.moonshot.cn/v1"
        
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "moonshot_v1",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        user: Optional[Any] = None,
        conversation: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        聊天补全
        
        Args:
            messages: 消息列表
            model: 模型名称
            temperature: 温度参数
            max_tokens: 最大令牌数
            user: 用户对象
            conversation: 对话对象
            
        Returns:
            Dict: 聊天补全结果
        """
        try:
            # 转换模型名称
            if model == "moonshot_v1":
                model_id = "moonshot-v1-8k"
            else:
                model_id = "moonshot-v1-8k"
            
            # 构建请求URL
            url = f"{self.base_url}/chat/completions"
            
            # 构建请求头
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            # 构建请求体
            data = {
                "model": model_id,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            # 发送请求
            response = requests.post(url, headers=headers, json=data)
            
            # 检查响应状态
            if response.status_code != 200:
                logger.error(f"Moonshot API请求失败: {response.status_code} - {response.text}")
                raise Exception(f"Moonshot API请求失败: {response.status_code}")
            
            # 解析响应
            result = response.json()
            
            return {
                "result": result["choices"][0]["message"]["content"],
                "model": model_id,
                "usage": result.get("usage", {})
            }
            
        except Exception as e:
            logger.error(f"Moonshot聊天补全失败: {str(e)}")
            raise
