"""
代码检测视图
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from code.serializers import CodeDetectRequestSerializer, CodeDetectResponseSerializer
from code.services import CodeService

@method_decorator(csrf_exempt, name='dispatch')
class CodeDetectView(APIView):
    """代码检测视图"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """检测代码语言"""
        serializer = CodeDetectRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            code_service = CodeService()
            result = code_service.detect_language(
                code=serializer.validated_data['code'],
                hint_language=serializer.validated_data.get('language')
            )
            
            response_serializer = CodeDetectResponseSerializer(data=result)
            if response_serializer.is_valid():
                return Response(response_serializer.data)
            else:
                return Response(response_serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
