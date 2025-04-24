from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import CodeService
from .serializers import CodeRequestSerializer, CodeResponseSerializer
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

@method_decorator(csrf_exempt, name='dispatch')
class CodeView(APIView):
    def __init__(self):
        self.code_service = CodeService()

    def post(self, request):
        serializer = CodeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = self.code_service.process_code(
                serializer.validated_data['code'],
                serializer.validated_data['language'],
                serializer.validated_data.get('input')
            )
            response_serializer = CodeResponseSerializer(result)
            return Response(response_serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class CodeDetectView(APIView):
    def __init__(self):
        self.code_service = CodeService()

    def post(self, request):
        serializer = CodeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = self.code_service.detect_code(
                serializer.validated_data['code'],
                serializer.validated_data['language']
            )
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class CodeCompleteView(APIView):
    def __init__(self):
        self.code_service = CodeService()

    def post(self, request):
        serializer = CodeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = self.code_service.complete_code(
                serializer.validated_data['code'],
                serializer.validated_data['language']
            )
            return Response({'completedCode': result})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class CodeFormatView(APIView):
    def __init__(self):
        self.code_service = CodeService()

    def post(self, request):
        serializer = CodeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = self.code_service.format_code(
                serializer.validated_data['code'],
                serializer.validated_data['language']
            )
            return Response({'formattedCode': result})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class CodeLintView(APIView):
    def __init__(self):
        self.code_service = CodeService()

    def post(self, request):
        serializer = CodeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = self.code_service.lint_code(
                serializer.validated_data['code'],
                serializer.validated_data['language']
            )
            return Response({'issues': result})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 