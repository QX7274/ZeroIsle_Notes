from abc import ABC, abstractmethod
from typing import List, Dict, Any, Callable
import logging
import os
import time
import random
import httpx
from django.conf import settings

try:
    # v1 SDK
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

logger = logging.getLogger(__name__)


# ---- Unified OpenAI client (singleton) ----
class _OpenAIClientManager:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is not None:
            return cls._client
        if OpenAI is None:
            raise RuntimeError("OpenAI SDK v1 未安装或导入失败")

        api_key = getattr(settings, 'OPENAI_API_KEY', os.environ.get('OPENAI_API_KEY'))
        if not api_key:
            logger.warning('OPENAI_API_KEY 未配置，将在调用处抛出错误')

        # Conservative timeouts and basic retries
        timeout = httpx.Timeout(120.0)  # set default for all phases
        # openai v1 client支持 max_retries
        cls._client = OpenAI(api_key=api_key, timeout=timeout, max_retries=3)
        logger.info('OpenAI v1 客户端已初始化（统一入口）')
        return cls._client


def get_openai_client():
    """Get shared OpenAI v1 client"""
    return _OpenAIClientManager.get_client()


def classify_openai_error(exc: Exception) -> str:
    """简单错误分类：网络/限流/授权/超时/其他"""
    name = exc.__class__.__name__.lower()
    text = str(exc).lower()
    if 'timeout' in name or 'timeout' in text:
        return 'timeout'
    if 'rate' in text or 'too many requests' in text or '429' in text:
        return 'rate_limit'
    if 'unauthorized' in text or 'invalid api key' in text or '401' in text:
        return 'auth'
    if 'network' in text or 'connection' in text:
        return 'network'
    return 'other'


def retryable(func: Callable, *, retries: int = 3, base_delay: float = 0.5, max_delay: float = 8.0, retry_on: List[str] = None, logger_name: str = None):
    """
    带指数退避的重试调用封装
    retry_on: 错误类别（来自 classify_openai_error），如 ['timeout','rate_limit','network']
    返回：func 的返回值
    """
    retry_on = retry_on or ['timeout', 'rate_limit', 'network']
    log = logging.getLogger(logger_name) if logger_name else logger

    def wrapper(*args, **kwargs):
        attempt = 0
        while True:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                category = classify_openai_error(e)
                attempt += 1
                if category not in retry_on or attempt > retries:
                    log.error(f"调用失败（category={category}, attempt={attempt}）：{e}")
                    raise
                delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
                # 添加抖动避免惊群
                delay = delay * (0.8 + 0.4 * random.random())
                log.warning(f"调用失败（{category}），第{attempt}次重试，等待{delay:.2f}s...")
                time.sleep(delay)
    return wrapper


class BaseProvider(ABC):
    """AI服务提供者的抽象基类"""

    @abstractmethod
    def chat_completion(self, messages: List[Dict[str, str]], model: str, stream: bool = False, tools: List[Dict[str, Any]] = None, response_format: Dict[str, str] = None, **kwargs) -> Any:
        """
        执行聊天补全
        """
        pass

    @abstractmethod
    def get_available_models(self) -> List[Dict[str, Any]]:
        """获取可用模型列表"""
        pass

    @abstractmethod
    def count_tokens(self, messages: List[Dict[str, str]], model: str) -> int:
        """计算令牌数"""
        pass

