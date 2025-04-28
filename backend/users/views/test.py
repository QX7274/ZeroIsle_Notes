"""
测试视图
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.http import JsonResponse

class TestAPIView(APIView):
    """
    测试API视图
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """
        简单的测试端点，返回成功消息
        """
        return Response({
            'status': 'success',
            'message': 'API服务正常运行',
            'data': {
                'server': 'Django',
                'version': '3.2',
                'environment': 'development'
            }
        }, status=status.HTTP_200_OK)
