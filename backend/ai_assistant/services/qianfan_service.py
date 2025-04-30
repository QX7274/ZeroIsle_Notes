"""
百度千帆服务
"""

import os
import json
import time
import hmac
import base64
import hashlib
import requests
from typing import Dict, List, Any, Optional
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class QianfanService:
    """
    百度千帆服务
    提供与百度千帆API的交互
    """
    
    def __init__(self):
        """初始化服务"""
        self.api_key = settings.QIANFAN_API_KEY
        self.secret_key = settings.QIANFAN_SECRET_KEY
        self.base_url = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop"
        self.access_token = None
        self.token_expires_at = 0
        
    def _get_access_token(self) -> str:
        """
        获取访问令牌
        
        Returns:
            str: 访问令牌
        """
        try:
            # 检查是否已有有效的访问令牌
            current_time = time.time()
            if self.access_token and current_time < self.token_expires_at:
                return self.access_token
                
            # 构建请求URL
            url = "https://aip.baidubce.com/oauth/2.0/token"
            
            # 构建请求参数
            params = {
                "grant_type": "client_credentials",
                "client_id": self.api_key,
                "client_secret": self.secret_key
            }
            
            # 发送请求
            response = requests.post(url, params=params)
            
            # 检查响应状态
            if response.status_code != 200:
                logger.error(f"获取百度千帆访问令牌失败: {response.status_code} - {response.text}")
                raise Exception(f"获取百度千帆访问令牌失败: {response.status_code}")
            
            # 解析响应
            result = response.json()
            
            # 保存访问令牌和过期时间
            self.access_token = result["access_token"]
            self.token_expires_at = current_time + result["expires_in"] - 60  # 提前60秒过期
            
            return self.access_token
            
        except Exception as e:
            logger.error(f"获取百度千帆访问令牌失败: {str(e)}")
            raise
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "qianfan_llama",
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
            # 获取访问令牌
            access_token = self._get_access_token()
            
            # 转换模型名称
            if model == "qianfan_llama":
                model_id = "llama_2_7b"
            elif model == "qianfan_bloomz":
                model_id = "bloomz_7b"
            else:
                model_id = "llama_2_7b"
            
            # 构建请求URL
            url = f"{self.base_url}/chat/{model_id}?access_token={access_token}"
            
            # 构建请求头
            headers = {
                "Content-Type": "application/json"
            }
            
            # 构建请求体
            data = {
                "messages": messages,
                "temperature": temperature,
                "max_output_tokens": max_tokens
            }
            
            # 发送请求
            response = requests.post(url, headers=headers, json=data)
            
            # 检查响应状态
            if response.status_code != 200:
                logger.error(f"百度千帆API请求失败: {response.status_code} - {response.text}")
                raise Exception(f"百度千帆API请求失败: {response.status_code}")
            
            # 解析响应
            result = response.json()
            
            return {
                "result": result["result"],
                "model": model_id,
                "usage": result.get("usage", {})
            }
            
        except Exception as e:
            logger.error(f"百度千帆聊天补全失败: {str(e)}")
            raise
