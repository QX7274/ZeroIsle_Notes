"""
统一的API响应格式处理模块

提供标准化的API响应格式和错误处理方法
"""

from rest_framework.response import Response
from rest_framework import status


class APIResponse:
    """
    统一的API响应类
    
    所有API端点应使用此类来返回响应，确保格式一致
    
    响应格式:
    {
        "code": 0,           # 0表示成功，其他值表示错误码
        "message": "success",# 响应消息
        "data": {...}        # 实际数据
    }
    """
    
    @staticmethod
    def success(data=None, message='success', code=0):
        """
        返回成功响应
        
        Args:
            data: 响应数据，可以是任何可序列化的对象
            message: 响应消息，默认为'success'
            code: 响应码，默认为0表示成功
            
        Returns:
            Response: Django REST Framework Response对象
        """
        return Response({
            'code': code,
            'message': message,
            'data': data
        }, status=status.HTTP_200_OK)
    
    @staticmethod
    def error(message, code=5000, status_code=status.HTTP_400_BAD_REQUEST, data=None):
        """
        返回错误响应
        
        Args:
            message: 错误消息
            code: 错误码，默认为5000（服务器错误）
            status_code: HTTP状态码，默认为400
            data: 额外的错误数据，可选
            
        Returns:
            Response: Django REST Framework Response对象
        """
        return Response({
            'code': code,
            'message': message,
            'data': data
        }, status=status_code)
    
    @staticmethod
    def created(data=None, message='created', code=0):
        """
        返回创建成功响应
        
        Args:
            data: 创建的对象数据
            message: 响应消息，默认为'created'
            code: 响应码，默认为0
            
        Returns:
            Response: Django REST Framework Response对象
        """
        return Response({
            'code': code,
            'message': message,
            'data': data
        }, status=status.HTTP_201_CREATED)
    
    @staticmethod
    def no_content(message='success', code=0):
        """
        返回204 No Content响应
        
        Args:
            message: 响应消息
            code: 响应码
            
        Returns:
            Response: Django REST Framework Response对象
        """
        return Response({
            'code': code,
            'message': message,
            'data': None
        }, status=status.HTTP_204_NO_CONTENT)
    
    @staticmethod
    def unauthorized(message='Unauthorized', code=1001):
        """
        返回未认证错误
        
        Args:
            message: 错误消息
            code: 错误码，默认为1001
            
        Returns:
            Response: Django REST Framework Response对象
        """
        return APIResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_401_UNAUTHORIZED
        )
    
    @staticmethod
    def forbidden(message='Forbidden', code=1002):
        """
        返回权限不足错误
        
        Args:
            message: 错误消息
            code: 错误码，默认为1002
            
        Returns:
            Response: Django REST Framework Response对象
        """
        return APIResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    @staticmethod
    def not_found(message='Not Found', code=2001):
        """
        返回资源不存在错误
        
        Args:
            message: 错误消息
            code: 错误码，默认为2001
            
        Returns:
            Response: Django REST Framework Response对象
        """
        return APIResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_404_NOT_FOUND
        )

