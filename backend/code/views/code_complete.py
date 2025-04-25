"""
代码补全视图
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from code.serializers import CodeCompleteRequestSerializer, CodeCompleteResponseSerializer
from code.services import CodeService

@method_decorator(csrf_exempt, name='dispatch')
class CodeCompleteView(APIView):
    """代码补全视图"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """补全代码"""
        serializer = CodeCompleteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            code_service = CodeService()
            result = code_service.complete_code(
                code=serializer.validated_data['code'],
                language=serializer.validated_data['language'],
                cursor_position=serializer.validated_data.get('cursor_position'),
                max_suggestions=serializer.validated_data.get('max_suggestions', 5)
            )
            
            response_serializer = CodeCompleteResponseSerializer(data=result)
            if response_serializer.is_valid():
                return Response(response_serializer.data)
            else:
                return Response(response_serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
