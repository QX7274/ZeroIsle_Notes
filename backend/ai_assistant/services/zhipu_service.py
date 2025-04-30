"""
智谱AI服务
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

class ZhipuService:
    """
    智谱AI服务
    提供与智谱AI API的交互
    """
    
    def __init__(self):
        """初始化服务"""
        self.api_key = settings.ZHIPU_API_KEY
        self.base_url = "https://open.bigmodel.cn/api/paas/v3"
        
    def _generate_token(self) -> str:
        """
        生成API访问令牌
        
        Returns:
            str: 访问令牌
        """
        try:
            api_key = self.api_key
            if not api_key:
                raise ValueError("未配置智谱API密钥")
                
            # 解析API密钥
            id, secret = api_key.split(".")
            
            # 计算过期时间（1小时后）
            expiration = int(time.time()) + 3600
            
            # 构建payload
            payload = {
                "api_key": id,
                "exp": expiration,
                "timestamp": int(time.time())
            }
            
            # 将payload转换为JSON字符串
            payload_str = json.dumps(payload)
            
            # 使用HMAC-SHA256计算签名
            signature = hmac.new(
                secret.encode('utf-8'),
                payload_str.encode('utf-8'),
                digestmod=hashlib.sha256
            ).digest()
            
            # 将签名进行Base64编码
            signature_b64 = base64.b64encode(signature).decode('utf-8')
            
            # 构建JWT令牌
            jwt_token = f"{id}.{base64.b64encode(payload_str.encode('utf-8')).decode('utf-8')}.{signature_b64}"
            
            return jwt_token
            
        except Exception as e:
            logger.error(f"生成智谱API令牌失败: {str(e)}")
            raise
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "chatglm_turbo",
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
            token = self._generate_token()
            
            # 转换模型名称
            if model == "chatglm_turbo":
                model_id = "chatglm_turbo"
            elif model == "chatglm_pro":
                model_id = "chatglm_pro"
            else:
                model_id = "chatglm_turbo"
            
            # 构建请求URL
            url = f"{self.base_url}/chat/completions"
            
            # 构建请求头
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
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
                logger.error(f"智谱API请求失败: {response.status_code} - {response.text}")
                raise Exception(f"智谱API请求失败: {response.status_code}")
            
            # 解析响应
            result = response.json()
            
            return {
                "result": result["choices"][0]["message"]["content"],
                "model": model_id,
                "usage": result.get("usage", {})
            }
            
        except Exception as e:
            logger.error(f"智谱聊天补全失败: {str(e)}")
            raise
