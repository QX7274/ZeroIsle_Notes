"""
MongoDB测试视图
用于测试MongoDB连接
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from mongodb_service import mongodb_service
import logging

logger = logging.getLogger(__name__)

class MongoDBTestView(APIView):
    """
    MongoDB测试视图
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        测试MongoDB连接
        """
        try:
            # 获取MongoDB连接状态
            connection_status = mongodb_service.get_connection_status()
            
            # 获取所有集合
            collections = mongodb_service.db.list_collection_names()
            
            return Response({
                'status': 'success',
                'message': 'MongoDB连接成功',
                'connection_status': connection_status,
                'collections': collections
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"MongoDB连接测试失败: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'MongoDB连接测试失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
