"""
知识图谱统一响应格式工具
"""

from rest_framework.response import Response
from rest_framework import status
import time


class KGResponse:
    """知识图谱统一响应格式"""
    
    @staticmethod
    def success(data, pagination=None, meta=None, status_code=200):
        """成功响应"""
        response_data = {
            'data': data,
            'error': None,
        }
        
        if pagination:
            response_data['pagination'] = pagination
        
        if meta:
            response_data['meta'] = meta
        else:
            response_data['meta'] = {'query_time_ms': 0}
        
        return Response(response_data, status=status_code)
    
    @staticmethod
    def error(code, message, details=None, status_code=400):
        """错误响应"""
        response_data = {
            'data': None,
            'error': {
                'code': code,
                'message': message,
            }
        }
        
        if details:
            response_data['error']['details'] = details
        
        return Response(response_data, status=status_code)


class PaginationHelper:
    """分页辅助类"""
    
    SORT_WHITELIST = ['created_at', 'updated_at', 'weight', 'confidence']
    MAX_PAGE_SIZE = 1000
    DEFAULT_PAGE_SIZE = 20
    
    @staticmethod
    def validate_and_get_params(request):
        """验证并获取分页参数"""
        try:
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 20))
            sort_by = request.query_params.get('sort_by', 'created_at')
            sort_order = request.query_params.get('sort_order', 'desc')
            
            # 验证
            if page < 1:
                page = 1
            if page_size < 1 or page_size > PaginationHelper.MAX_PAGE_SIZE:
                page_size = PaginationHelper.DEFAULT_PAGE_SIZE
            if sort_by not in PaginationHelper.SORT_WHITELIST:
                sort_by = 'created_at'
            if sort_order not in ['asc', 'desc']:
                sort_order = 'desc'
            
            return {
                'page': page,
                'page_size': page_size,
                'sort_by': sort_by,
                'sort_order': sort_order,
            }
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def get_pagination_meta(queryset, page, page_size):
        """获取分页元数据"""
        total = queryset.count()
        has_next = (page * page_size) < total
        
        return {
            'total': total,
            'page': page,
            'page_size': page_size,
            'has_next': has_next,
            'total_pages': (total + page_size - 1) // page_size,
        }


class ErrorCodes:
    """标准错误码定义"""
    
    # 400 Bad Request
    INVALID_PARAM = 'KG_400_INVALID_PARAM'
    
    # 403 Forbidden
    FORBIDDEN = 'KG_403_FORBIDDEN'
    
    # 404 Not Found
    NOT_FOUND = 'KG_404_NOT_FOUND'
    
    # 409 Conflict
    CONFLICT = 'KG_409_CONFLICT'
    
    # 422 Unprocessable Entity
    UNPROCESSABLE = 'KG_422_UNPROCESSABLE'
    
    # 429 Too Many Requests
    RATE_LIMIT = 'KG_429_RATE_LIMIT'
    
    # 500 Internal Server Error
    INTERNAL = 'KG_500_INTERNAL'

