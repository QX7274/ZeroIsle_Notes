"""
自定义中间件
"""

import time
import logging
import json
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache
from django.http import HttpResponseForbidden
from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from django.utils.cache import patch_vary_headers
from django.utils.http import is_same_domain

logger = logging.getLogger('backend')

class RequestLogMiddleware(MiddlewareMixin):
    """
    请求日志中间件
    记录每个请求的处理时间和基本信息
    """

    def process_request(self, request):
        request.start_time = time.time()

    def process_response(self, request, response):
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time

            # 获取请求信息
            request_data = {}
            if request.method in ['POST', 'PUT', 'PATCH']:
                if request.content_type == 'application/json':
                    try:
                        request_data = json.loads(request.body)
                    except:
                        request_data = {'error': 'Invalid JSON'}
                else:
                    request_data = request.POST.dict()

            # 记录请求日志
            try:
                username = request.user.username if request.user.is_authenticated else 'anonymous'
            except Exception as e:
                # 如果获取用户名失败，使用默认值
                logger.warning(f"获取用户名失败: {str(e)}")
                username = 'unknown'

            log_data = {
                'method': request.method,
                'path': request.path,
                'status': response.status_code,
                'duration': f"{duration:.2f}s",
                'user': username,
                'ip': self._get_client_ip(request),
            }

            # 根据状态码选择日志级别
            if response.status_code >= 500:
                logger.error(f"Request: {log_data}", extra={'request_data': request_data})
            elif response.status_code >= 400:
                logger.warning(f"Request: {log_data}", extra={'request_data': request_data})
            else:
                logger.info(f"Request: {log_data}")

        return response

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class RateLimitMiddleware(MiddlewareMixin):
    """
    请求频率限制中间件
    """

    def _get_client_ip(self, request):
        """提取客户端IP，优先使用代理头。"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')

    def process_request(self, request):
        # 获取客户端IP
        ip = self._get_client_ip(request)

        # 构建缓存键
        cache_key = f'ratelimit:{ip}'

        # 获取请求计数
        count = cache.get(cache_key, 0)

        # 检查是否超过限制
        if count >= settings.RATE_LIMIT:
            logger.warning(f"IP {ip} 请求频率过高")
            return HttpResponseForbidden("请求频率过高，请稍后再试")

        # 增加计数
        cache.set(cache_key, count + 1, settings.RATE_LIMIT_WINDOW)

        return None

class XSSProtectionMiddleware(MiddlewareMixin):
    """
    XSS防护中间件
    """
    def process_response(self, request, response):
        # 添加XSS防护头
        response['X-XSS-Protection'] = '1; mode=block'
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'SAMEORIGIN'
        return response

class EnhancedCsrfViewMiddleware(CsrfViewMiddleware):
    """
    增强的CSRF防护中间件
    """
    def process_view(self, request, callback, callback_args, callback_kwargs):
        # 检查请求方法
        if request.method not in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
            # 检查Referer头
            referer = request.META.get('HTTP_REFERER')
            if referer is None:
                logger.warning(f"CSRF验证失败: 缺少Referer头 - {request.path}")
                return self._reject(request, 'CSRF验证失败: 缺少Referer头')

            # 验证Referer域名
            if not is_same_domain(referer, request.get_host()):
                logger.warning(f"CSRF验证失败: Referer域名不匹配 - {request.path}")
                return self._reject(request, 'CSRF验证失败: Referer域名不匹配')

        return super().process_view(request, callback, callback_args, callback_kwargs)

    def process_response(self, request, response):
        # 添加CSRF Cookie
        response = super().process_response(request, response)

        # 设置Cookie安全属性
        if 'csrftoken' in response.cookies:
            response.cookies['csrftoken']['secure'] = True
            response.cookies['csrftoken']['httponly'] = True
            response.cookies['csrftoken']['samesite'] = 'Strict'

        return response

class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    安全头中间件
    """
    def process_response(self, request, response):
        # 添加安全相关的HTTP头
        response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

        # 添加CORS头
        if 'Origin' in request.headers:
            response['Access-Control-Allow-Origin'] = request.headers['Origin']
            response['Access-Control-Allow-Credentials'] = 'true'
            patch_vary_headers(response, ['Origin'])

        return response

class RequestLoggingMiddleware(MiddlewareMixin):
    """
    请求日志中间件
    """
    def process_request(self, request):
        # 记录请求开始时间
        request.start_time = time.time()
        return None

    def process_response(self, request, response):
        # 计算请求处理时间
        duration = time.time() - request.start_time

        # 记录请求日志
        logger.info(
            f"{request.method} {request.path} - {response.status_code} "
            f"- {duration:.2f}s - {request.META.get('REMOTE_ADDR')}"
        )

        return response
