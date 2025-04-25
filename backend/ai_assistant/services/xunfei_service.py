"""
讯飞服务
"""

import logging
import json
import requests
import time
import hmac
import hashlib
import base64
import uuid
from urllib.parse import urlencode
from django.conf import settings
from ai_assistant.models import UsageRecord

logger = logging.getLogger('backend')

class XunfeiService:
    """
    讯飞服务类
    处理与讯飞星火API的交互
    """
    
    def __init__(self):
        """初始化"""
        self.app_id = settings.XUNFEI_APP_ID
        self.api_key = settings.XUNFEI_API_KEY
        self.api_secret = settings.XUNFEI_API_SECRET
        self.api_base = "https://spark-api.xf-yun.com/v2.1/chat"
    
    def _create_signature(self, host, path, method="POST"):
        """
        创建签名
        
        Args:
            host: 主机名
            path: 路径
            method: 请求方法
            
        Returns:
            tuple: (签名, 日期, 签名原始字符串)
        """
        # 生成RFC1123格式的时间戳
        date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
        
        # 拼接签名原始字符串
        signature_origin = f"host: {host}\ndate: {date}\n{method} {path} HTTP/1.1"
        
        # 使用hmac-sha256进行加密
        signature_sha = hmac.new(
            self.api_secret.encode('utf-8'),
            signature_origin.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()
        
        # Base64编码
        signature = base64.b64encode(signature_sha).decode('utf-8')
        
        return signature, date, signature_origin
    
    def _create_authorization(self, signature, date):
        """
        创建授权头
        
        Args:
            signature: 签名
            date: 日期
            
        Returns:
            str: 授权头
        """
        authorization_origin = f'api_key="{self.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
        return base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')
    
    def chat_completion(self, messages, model="spark-3.5", temperature=0.7, max_tokens=None, user=None, conversation=None):
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
        if not self.app_id or not self.api_key or not self.api_secret:
            logger.error("讯飞API密钥未配置")
            raise ValueError("讯飞API密钥未配置")
        
        try:
            # 解析URL
            url_parts = requests.utils.urlparse(self.api_base)
            host = url_parts.netloc
            path = url_parts.path
            
            # 创建签名
            signature, date, _ = self._create_signature(host, path)
            authorization = self._create_authorization(signature, date)
            
            # 构建请求头
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Date": date,
                "Host": host,
                "Authorization": authorization
            }
            
            # 转换消息格式
            spark_messages = []
            for msg in messages:
                role = msg["role"]
                if role == "system":
                    role = "user"
                spark_messages.append({
                    "role": role,
                    "content": msg["content"]
                })
            
            # 构建请求数据
            data = {
                "header": {
                    "app_id": self.app_id,
                    "uid": str(uuid.uuid4())
                },
                "parameter": {
                    "chat": {
                        "domain": model.replace("spark-", "general"),
                        "temperature": temperature,
                        "max_tokens": max_tokens or 2048
                    }
                },
                "payload": {
                    "message": {
                        "text": spark_messages
                    }
                }
            }
            
            # 发送请求
            response = requests.post(
                self.api_base,
                headers=headers,
                data=json.dumps(data)
            )
            
            # 检查响应
            if response.status_code != 200:
                logger.error(f"讯飞API请求失败: {response.status_code} {response.text}")
                raise ValueError(f"讯飞API请求失败: {response.status_code}")
            
            result = response.json()
            
            # 检查错误
            if result.get("code") != 0:
                logger.error(f"讯飞API请求失败: {result.get('code')} {result.get('message')}")
                raise ValueError(f"讯飞API请求失败: {result.get('message')}")
            
            # 记录使用情况
            if user:
                # 讯飞API不提供令牌计数，这里简单估算
                prompt_tokens = sum(len(str(m.get('content', ''))) // 4 for m in messages)
                completion_tokens = len(str(result.get('payload', {}).get('text', ''))) // 4
                
                UsageRecord.create_record(
                    user=user,
                    model=model,
                    provider='xunfei',
                    conversation=conversation,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens
                )
            
            return result
        except Exception as e:
            logger.error(f"讯飞聊天补全失败: {e}")
            raise
