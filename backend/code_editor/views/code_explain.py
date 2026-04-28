"""
代码解释视图
提供代码解释功能
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from ..serializers.code_request import CodeExplainRequestSerializer, CodeExplainResponseSerializer
from ..services.code_service import CodeService
from common.permissions import ReadOnly

import logging

logger = logging.getLogger(__name__)

class CodeExplainView(APIView):
    """
    代码解释视图
    """
    permission_classes = [IsAuthenticated | ReadOnly]
    
    def post(self, request):
        """解释代码"""
        serializer = CodeExplainRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            code_service = CodeService()
            result = code_service.explain_code(
                code=serializer.validated_data['code'],
                language=serializer.validated_data['language'],
                detail_level=serializer.validated_data.get('detail_level', 'medium')
            )
            
            response_serializer = CodeExplainResponseSerializer(data=result)
            if response_serializer.is_valid():
                return Response(response_serializer.data)
            else:
                return Response(response_serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"解释代码失败: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
