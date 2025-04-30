"""
代码示例生成视图
提供代码示例生成功能
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from ..serializers.code_request import CodeExampleRequestSerializer, CodeExampleResponseSerializer
from ..services.code_service import CodeService
from common.permissions import ReadOnly

import logging

logger = logging.getLogger(__name__)

class CodeExampleView(APIView):
    """
    代码示例生成视图
    """
    permission_classes = [IsAuthenticated | ReadOnly]
    
    def post(self, request):
        """生成代码示例"""
        serializer = CodeExampleRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            code_service = CodeService()
            result = code_service.generate_example(
                language=serializer.validated_data['language'],
                concept=serializer.validated_data['concept'],
                complexity=serializer.validated_data.get('complexity', 'medium')
            )
            
            response_serializer = CodeExampleResponseSerializer(data=result)
            if response_serializer.is_valid():
                return Response(response_serializer.data)
            else:
                return Response(response_serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"生成代码示例失败: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
