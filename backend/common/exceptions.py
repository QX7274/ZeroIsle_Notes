"""
自定义异常和异常处理
"""

from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException
from rest_framework import status
from django.utils.translation import gettext_lazy as _

def custom_exception_handler(exc, context):
    """
    自定义异常处理器
    为所有异常提供一致的响应格式
    
    Args:
        exc: 异常对象
        context: 异常上下文
    
    Returns:
        Response: DRF响应对象
    """
    # 调用DRF默认的异常处理器
    response = exception_handler(exc, context)
    
    if response is not None:
        # 确保响应包含code字段
        if isinstance(exc, APIException):
            code = getattr(exc, 'code', exc.__class__.__name__)
        else:
            code = 'Error'
            
        # 构建标准错误响应
        error_data = {
            'code': code,
            'message': response.data.get('detail', str(response.data)) if hasattr(response, 'data') else str(exc),
            'status': response.status_code,
        }
        
        # 添加字段错误（如果有）
        field_errors = {}
        if hasattr(response, 'data') and isinstance(response.data, dict):
            for key, value in response.data.items():
                if key != 'detail':
                    field_errors[key] = value
                    
        if field_errors:
            error_data['field_errors'] = field_errors
            
        response.data = error_data
        
    return response

class ServiceUnavailableException(APIException):
    """服务不可用异常"""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = _('服务暂时不可用，请稍后再试')
    default_code = 'service_unavailable'

class ResourceNotFoundException(APIException):
    """资源未找到异常"""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = _('请求的资源不存在')
    default_code = 'resource_not_found'

class InvalidRequestException(APIException):
    """无效请求异常"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _('无效的请求参数')
    default_code = 'invalid_request'

class AuthenticationFailedException(APIException):
    """认证失败异常"""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = _('认证失败')
    default_code = 'authentication_failed'

class PermissionDeniedException(APIException):
    """权限拒绝异常"""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = _('没有执行该操作的权限')
    default_code = 'permission_denied'

class ThirdPartyServiceException(APIException):
    """第三方服务异常"""
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = _('第三方服务异常')
    default_code = 'third_party_service_error'
