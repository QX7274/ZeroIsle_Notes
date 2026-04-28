"""
代码检查视图
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from code.serializers import CodeLintRequestSerializer, CodeLintResponseSerializer
from code.services import CodeService

@method_decorator(csrf_exempt, name='dispatch')
class CodeLintView(APIView):
    """代码检查视图"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """检查代码"""
        serializer = CodeLintRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            code_service = CodeService()
            result = code_service.lint_code(
                code=serializer.validated_data['code'],
                language=serializer.validated_data['language'],
                rules=serializer.validated_data.get('rules')
            )
            
            response_serializer = CodeLintResponseSerializer(data=result)
            if response_serializer.is_valid():
                return Response(response_serializer.data)
            else:
                return Response(response_serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
