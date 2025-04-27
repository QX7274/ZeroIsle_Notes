"""
缓存配置
"""

from django.core.cache import cache
from django.conf import settings
import logging
from functools import wraps
import json
import hashlib

logger = logging.getLogger(__name__)

def cache_page(timeout):
    """
    页面缓存装饰器
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # 构建缓存键
            cache_key = f"view:{request.path}:{request.GET.urlencode()}"
            
            # 尝试从缓存获取
            response = cache.get(cache_key)
            if response is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return response
            
            # 执行视图函数
            response = view_func(request, *args, **kwargs)
            
            # 缓存响应
            cache.set(cache_key, response, timeout)
            logger.debug(f"缓存设置: {cache_key}")
            
            return response
        return _wrapped_view
    return decorator

def cache_data(key_prefix, timeout=300):
    """
    数据缓存装饰器
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 构建缓存键
            key_parts = [key_prefix]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
            cache_key = hashlib.md5(":".join(key_parts).encode()).hexdigest()
            
            # 尝试从缓存获取
            result = cache.get(cache_key)
            if result is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return result
            
            # 执行函数
            result = func(*args, **kwargs)
            
            # 缓存结果
            cache.set(cache_key, result, timeout)
            logger.debug(f"缓存设置: {cache_key}")
            
            return result
        return wrapper
    return decorator

class CacheManager:
    """
    缓存管理器
    """
    def __init__(self):
        self.default_timeout = settings.CACHES['default']['TIMEOUT']
    
    def get(self, key, default=None):
        """获取缓存值"""
        return cache.get(key, default)
    
    def set(self, key, value, timeout=None):
        """设置缓存值"""
        cache.set(key, value, timeout or self.default_timeout)
    
    def delete(self, key):
        """删除缓存值"""
        cache.delete(key)
    
    def clear(self):
        """清空缓存"""
        cache.clear()
    
    def get_or_set(self, key, default, timeout=None):
        """获取缓存值，如果不存在则设置"""
        return cache.get_or_set(key, default, timeout or self.default_timeout)
    
    def incr(self, key, delta=1):
        """增加缓存值"""
        return cache.incr(key, delta)
    
    def decr(self, key, delta=1):
        """减少缓存值"""
        return cache.decr(key, delta)
    
    def get_many(self, keys):
        """批量获取缓存值"""
        return cache.get_many(keys)
    
    def set_many(self, data, timeout=None):
        """批量设置缓存值"""
        cache.set_many(data, timeout or self.default_timeout)
    
    def delete_many(self, keys):
        """批量删除缓存值"""
        cache.delete_many(keys)
    
    def touch(self, key, timeout=None):
        """更新缓存过期时间"""
        cache.touch(key, timeout or self.default_timeout)

# 创建缓存管理器实例
cache_manager = CacheManager() 