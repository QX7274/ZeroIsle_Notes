"""
缓存服务
提供统一的缓存管理，支持Redis和内存缓存
"""

import logging
import json
import hashlib
from typing import Any, Optional, Callable
from functools import wraps
from datetime import timedelta
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


class CacheService:
    """
    统一缓存服务
    
    特性:
    - 支持Django cache后端（Redis/内存）
    - 自动序列化/反序列化
    - 缓存键前缀管理
    - 缓存统计
    - 装饰器支持
    
    使用方法:
        from common.cache_service import cache_service
        
        # 基本使用
        cache_service.set('key', {'data': 'value'}, ttl=3600)
        data = cache_service.get('key')
        
        # 使用装饰器
        @cache_service.cached(ttl=300)
        def expensive_function(arg1, arg2):
            return compute_result(arg1, arg2)
    """
    
    # 缓存键前缀，避免冲突
    PREFIX = 'zeroislenotes:'
    
    # 默认TTL（秒）
    DEFAULT_TTL = 3600  # 1小时
    
    def __init__(self):
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
        }
    
    def _make_key(self, key: str) -> str:
        """生成带前缀的缓存键"""
        return f"{self.PREFIX}{key}"
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        获取缓存值
        
        Args:
            key: 缓存键
            default: 默认值
            
        Returns:
            缓存的值或默认值
        """
        try:
            full_key = self._make_key(key)
            value = cache.get(full_key)
            
            if value is not None:
                self._stats['hits'] += 1
                return value
            
            self._stats['misses'] += 1
            return default
            
        except Exception as e:
            logger.error(f"缓存获取失败: {key}, 错误: {e}")
            return default
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        设置缓存值
        
        Args:
            key: 缓存键
            value: 缓存值
            ttl: 过期时间（秒），默认1小时
            
        Returns:
            是否成功
        """
        try:
            full_key = self._make_key(key)
            timeout = ttl if ttl is not None else self.DEFAULT_TTL
            
            cache.set(full_key, value, timeout)
            self._stats['sets'] += 1
            return True
            
        except Exception as e:
            logger.error(f"缓存设置失败: {key}, 错误: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        删除缓存
        
        Args:
            key: 缓存键
            
        Returns:
            是否成功
        """
        try:
            full_key = self._make_key(key)
            cache.delete(full_key)
            self._stats['deletes'] += 1
            return True
            
        except Exception as e:
            logger.error(f"缓存删除失败: {key}, 错误: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """
        删除匹配模式的缓存键（需要Redis后端）
        
        Args:
            pattern: 键模式，如 'user:*'
            
        Returns:
            删除的键数量
        """
        try:
            # 尝试获取Redis客户端
            if hasattr(cache, 'client'):
                client = cache.client.get_client()
                full_pattern = self._make_key(pattern)
                keys = client.keys(full_pattern)
                if keys:
                    return client.delete(*keys)
            return 0
            
        except Exception as e:
            logger.error(f"缓存模式删除失败: {pattern}, 错误: {e}")
            return 0
    
    def get_or_set(self, key: str, default_func: Callable, ttl: Optional[int] = None) -> Any:
        """
        获取缓存，如果不存在则设置
        
        Args:
            key: 缓存键
            default_func: 生成默认值的函数
            ttl: 过期时间
            
        Returns:
            缓存的值
        """
        value = self.get(key)
        if value is not None:
            return value
        
        value = default_func()
        self.set(key, value, ttl)
        return value
    
    def cached(self, ttl: Optional[int] = None, key_prefix: str = ''):
        """
        缓存装饰器
        
        Args:
            ttl: 过期时间（秒）
            key_prefix: 键前缀
            
        使用方法:
            @cache_service.cached(ttl=300, key_prefix='user_notes')
            def get_user_notes(user_id):
                return fetch_notes(user_id)
        """
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # 生成缓存键
                cache_key = self._generate_cache_key(func, args, kwargs, key_prefix)
                
                # 尝试从缓存获取
                cached_value = self.get(cache_key)
                if cached_value is not None:
                    return cached_value
                
                # 执行函数
                result = func(*args, **kwargs)
                
                # 缓存结果
                self.set(cache_key, result, ttl)
                
                return result
            
            return wrapper
        return decorator
    
    def _generate_cache_key(self, func: Callable, args: tuple, kwargs: dict, prefix: str = '') -> str:
        """生成缓存键"""
        # 使用函数名和参数生成唯一键
        key_parts = [
            prefix or func.__module__,
            func.__name__,
            str(args),
            str(sorted(kwargs.items()))
        ]
        key_str = ':'.join(key_parts)
        
        # 使用MD5哈希避免过长的键
        key_hash = hashlib.md5(key_str.encode()).hexdigest()[:16]
        
        return f"{prefix or func.__name__}:{key_hash}"
    
    def get_stats(self) -> dict:
        """获取缓存统计"""
        total = self._stats['hits'] + self._stats['misses']
        hit_rate = self._stats['hits'] / total if total > 0 else 0
        
        return {
            **self._stats,
            'total_requests': total,
            'hit_rate': round(hit_rate * 100, 2),
        }
    
    def clear_stats(self):
        """清除统计"""
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
        }


# 常用缓存键生成器
class CacheKeys:
    """缓存键常量"""
    
    @staticmethod
    def user_profile(user_id: str) -> str:
        return f"user:profile:{user_id}"
    
    @staticmethod
    def user_notes(user_id: str, page: int = 1) -> str:
        return f"user:notes:{user_id}:page:{page}"
    
    @staticmethod
    def note_detail(note_id: str) -> str:
        return f"note:{note_id}"
    
    @staticmethod
    def search_results(query_hash: str) -> str:
        return f"search:{query_hash}"
    
    @staticmethod
    def knowledge_graph(user_id: str) -> str:
        return f"kg:{user_id}"
    
    @staticmethod
    def notification_prefs(user_id: str) -> str:
        return f"notif:prefs:{user_id}"


# 全局缓存服务实例
cache_service = CacheService()


# TTL常量（秒）
class CacheTTL:
    """缓存过期时间常量"""
    ONE_MINUTE = 60
    FIVE_MINUTES = 300
    FIFTEEN_MINUTES = 900
    ONE_HOUR = 3600
    SIX_HOURS = 21600
    ONE_DAY = 86400
    ONE_WEEK = 604800
