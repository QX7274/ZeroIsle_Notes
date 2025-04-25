"""
自定义中间件
"""

import time
import logging
import json
from django.utils.deprecation import MiddlewareMixin

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
            log_data = {
                'method': request.method,
                'path': request.path,
                'status': response.status_code,
                'duration': f"{duration:.2f}s",
                'user': request.user.username if request.user.is_authenticated else 'anonymous',
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
