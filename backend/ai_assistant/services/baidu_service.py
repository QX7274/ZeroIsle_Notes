"""
百度服务
"""

import logging
import json
import requests
import time
from django.conf import settings
from .base_provider import BaseProvider
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Define retryable exceptions
RETRYABLE_EXCEPTIONS = (
    requests.exceptions.RequestException,
    ValueError,  # Can be raised on status code != 200
)

logger = logging.getLogger('backend')

class BaiduService(BaseProvider):
    """
    百度服务类
    处理与百度文心API的交互
    """

    def __init__(self):
        """初始化"""
        self.api_key = settings.BAIDU_API_KEY
        self.secret_key = settings.BAIDU_SECRET_KEY
        self.api_base = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat"
        self.access_token = None
        self.token_expire_time = 0

    @retry(
        retry=retry_if_exception_type(requests.exceptions.RequestException),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        stop=stop_after_attempt(3)
    )
    def _get_access_token(self):
        """
        获取访问令牌

        Returns:
            str: 访问令牌
        """
        # 如果令牌未过期，直接返回
        if self.access_token and time.time() < self.token_expire_time:
            return self.access_token

        try:
            url = "https://aip.baidubce.com/oauth/2.0/token"
            params = {
                "grant_type": "client_credentials",
                "client_id": self.api_key,
                "client_secret": self.secret_key
            }

            response = requests.post(url, params=params, timeout=(10, 60)) # 10s connect, 60s read

            if response.status_code != 200:
                logger.error(f"获取百度访问令牌失败: {response.status_code} {response.text}")
                raise ValueError(f"获取百度访问令牌失败: {response.status_code}")

            result = response.json()
            self.access_token = result.get("access_token")
            # 令牌有效期通常为30天，这里设置为29天
            self.token_expire_time = time.time() + 29 * 24 * 60 * 60

            return self.access_token
        except Exception as e:
            logger.error(f"获取百度访问令牌失败: {e}")
            raise

    @retry(
        retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        stop=stop_after_attempt(3)
    )
    def chat_completion(self, messages, model="ernie-bot-4", temperature=0.7, max_tokens=None, user=None, conversation=None):
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
        if not self.api_key or not self.secret_key:
            logger.error("百度API密钥未配置")
            raise ValueError("百度API密钥未配置")

        try:
            # 获取访问令牌
            access_token = self._get_access_token()

            # 构建请求数据
            data = {
                "messages": messages,
                "temperature": temperature,
            }

            if max_tokens:
                data["max_tokens"] = max_tokens

            # 根据模型选择API端点
            model_endpoint = {
                "ernie-bot": "/ernie-bot",
                "ernie-bot-4": "/ernie-bot-4",
                "ernie-bot-turbo": "/ernie-bot-turbo",
            }.get(model, "/ernie-bot")

            # 发送请求
            headers = {
                "Content-Type": "application/json"
            }

            response = requests.post(
                f"{self.api_base}{model_endpoint}?access_token={access_token}",
                headers=headers,
                data=json.dumps(data),
                timeout=(10, 120) # 10s connect, 120s read
            )

            # 检查响应
            if response.status_code != 200:
                logger.error(f"百度API请求失败: {response.status_code} {response.text}")
                raise ValueError(f"百度API请求失败: {response.status_code}")

            result = response.json()

            # 检查错误
            if result.get("error_code"):
                logger.error(f"百度API请求失败: {result.get('error_code')} {result.get('error_msg')}")
                raise ValueError(f"百度API请求失败: {result.get('error_msg')}")



            usage = result.get('usage', {})
            prompt_tokens = usage.get('prompt_tokens', 0)
            completion_tokens = usage.get('completion_tokens', 0)

            # Return a standardized dictionary
            return {
                'content': result.get('result', ''),
                'usage': {
                    'prompt_tokens': prompt_tokens,
                    'completion_tokens': completion_tokens
                }
            }
        except Exception as e:
            logger.error(f"百度聊天补全失败: {e}")
            raise

    def get_available_models(self):
        """获取可用模型 (百度API不支持，返回硬编码列表)"""
        return [
            {'id': 'ernie-bot', 'provider': 'baidu'},
            {'id': 'ernie-bot-4', 'provider': 'baidu'},
            {'id': 'ernie-bot-turbo', 'provider': 'baidu'},
        ]

    def count_tokens(self, messages, model="ernie-bot-4"):
        """估算令牌数 (百度API不支持，简单估算)"""
        return sum(len(str(m.get('content', ''))) for m in messages)


