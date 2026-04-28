"""
代码格式化视图
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from code.serializers import CodeFormatRequestSerializer, CodeFormatResponseSerializer
from code.services import CodeService

@method_decorator(csrf_exempt, name='dispatch')
class CodeFormatView(APIView):
    """代码格式化视图"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """格式化代码"""
        serializer = CodeFormatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            code_service = CodeService()
            result = code_service.format_code(
                code=serializer.validated_data['code'],
                language=serializer.validated_data['language'],
                style=serializer.validated_data.get('style')
            )
            
            response_serializer = CodeFormatResponseSerializer(data=result)
            if response_serializer.is_valid():
                return Response(response_serializer.data)
            else:
                return Response(response_serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
