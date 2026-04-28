"""
性能监控中间件
监控请求响应时间、慢查询和错误率
"""

import logging
import time
from typing import Callable
from django.http import HttpRequest, HttpResponse
from django.conf import settings

logger = logging.getLogger(__name__)


class PerformanceMonitorMiddleware:
    """
    性能监控中间件
    
    功能:
    - 记录每个请求的响应时间
    - 标记慢请求
    - 记录请求统计
    
    配置 (settings.py):
        PERFORMANCE_MONITOR = {
            'ENABLED': True,
            'SLOW_REQUEST_THRESHOLD': 1.0,  # 秒
            'LOG_ALL_REQUESTS': False,
        }
    """
    
    def __init__(self, get_response: Callable):
        self.get_response = get_response
        
        # 配置
        config = getattr(settings, 'PERFORMANCE_MONITOR', {})
        self.enabled = config.get('ENABLED', True)
        self.slow_threshold = config.get('SLOW_REQUEST_THRESHOLD', 1.0)
        self.log_all = config.get('LOG_ALL_REQUESTS', False)
        
        # 统计信息（内存中）
        self._stats = {
            'total_requests': 0,
            'slow_requests': 0,
            'errors': 0,
            'total_time': 0.0,
        }
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not self.enabled:
            return self.get_response(request)
        
        # 记录开始时间
        start_time = time.time()
        
        # 处理请求
        response = self.get_response(request)
        
        # 计算耗时
        duration = time.time() - start_time
        
        # 更新统计
        self._stats['total_requests'] += 1
        self._stats['total_time'] += duration
        
        if response.status_code >= 400:
            self._stats['errors'] += 1
        
        # 检测慢请求
        is_slow = duration > self.slow_threshold
        if is_slow:
            self._stats['slow_requests'] += 1
            logger.warning(
                f"慢请求: {request.method} {request.path} "
                f"耗时: {duration:.3f}s "
                f"状态: {response.status_code}"
            )
        elif self.log_all:
            logger.info(
                f"请求: {request.method} {request.path} "
                f"耗时: {duration:.3f}s "
                f"状态: {response.status_code}"
            )
        
        # 添加响应头（调试用）
        if settings.DEBUG:
            response['X-Response-Time'] = f"{duration:.3f}s"
        
        return response
    
    def get_stats(self) -> dict:
        """获取统计信息"""
        avg_time = (
            self._stats['total_time'] / self._stats['total_requests']
            if self._stats['total_requests'] > 0
            else 0
        )
        
        error_rate = (
            self._stats['errors'] / self._stats['total_requests'] * 100
            if self._stats['total_requests'] > 0
            else 0
        )
        
        slow_rate = (
            self._stats['slow_requests'] / self._stats['total_requests'] * 100
            if self._stats['total_requests'] > 0
            else 0
        )
        
        return {
            'total_requests': self._stats['total_requests'],
            'slow_requests': self._stats['slow_requests'],
            'errors': self._stats['errors'],
            'average_response_time': round(avg_time, 3),
            'error_rate': round(error_rate, 2),
            'slow_request_rate': round(slow_rate, 2),
        }


class QueryCountMiddleware:
    """
    数据库查询计数中间件
    仅在DEBUG模式下启用
    """
    
    def __init__(self, get_response: Callable):
        self.get_response = get_response
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not settings.DEBUG:
            return self.get_response(request)
        
        from django.db import connection
        
        # 记录初始查询数
        initial_queries = len(connection.queries)
        
        # 处理请求
        response = self.get_response(request)
        
        # 计算查询数
        query_count = len(connection.queries) - initial_queries
        
        # 添加响应头
        response['X-DB-Query-Count'] = str(query_count)
        
        # 记录过多查询
        if query_count > 20:
            logger.warning(
                f"查询过多: {request.method} {request.path} "
                f"查询数: {query_count}"
            )
        
        return response


class RequestThrottleMiddleware:
    """
    请求限流中间件
    基于IP地址的简单限流
    """
    
    def __init__(self, get_response: Callable):
        self.get_response = get_response
        
        # 配置
        config = getattr(settings, 'REQUEST_THROTTLE', {})
        self.enabled = config.get('ENABLED', True)
        self.rate_limit = config.get('RATE_LIMIT', 100)  # 每分钟请求数
        self.window = config.get('WINDOW', 60)  # 时间窗口（秒）
        
        # 请求计数（内存中，生产环境应使用Redis）
        self._request_counts = {}
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not self.enabled:
            return self.get_response(request)
        
        # 获取客户端IP
        ip = self._get_client_ip(request)
        
        # 检查限流
        current_time = time.time()
        
        if ip in self._request_counts:
            count, window_start = self._request_counts[ip]
            
            # 检查是否在同一窗口内
            if current_time - window_start < self.window:
                if count >= self.rate_limit:
                    logger.warning(f"请求限流: IP {ip} 超过限制 {self.rate_limit}/min")
                    return HttpResponse(
                        '{"error": "请求过于频繁，请稍后再试"}',
                        content_type='application/json',
                        status=429
                    )
                self._request_counts[ip] = (count + 1, window_start)
            else:
                # 新窗口
                self._request_counts[ip] = (1, current_time)
        else:
            self._request_counts[ip] = (1, current_time)
        
        # 清理过期记录
        self._cleanup()
        
        return self.get_response(request)
    
    def _get_client_ip(self, request: HttpRequest) -> str:
        """获取客户端IP"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
    
    def _cleanup(self):
        """清理过期记录"""
        current_time = time.time()
        expired_ips = [
            ip for ip, (_, window_start) in self._request_counts.items()
            if current_time - window_start > self.window * 2
        ]
        for ip in expired_ips:
            del self._request_counts[ip]
