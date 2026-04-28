"""
代码执行视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from code.models import CodeExecution
from code.serializers import (
    CodeExecutionSerializer,
    CodeExecutionRequestSerializer,
    CodeExecutionResponseSerializer
)
from code.services import CodeExecutionService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class CodeExecutionViewSet(viewsets.ModelViewSet):
    """代码执行视图集"""
    serializer_class = CodeExecutionSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['language', 'status']
    search_fields = ['code']
    ordering_fields = ['created_at', 'execution_time', 'memory_usage']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return CodeExecution.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return CodeExecutionRequestSerializer
        return self.serializer_class
    
    def perform_create(self, serializer):
        """创建代码执行记录"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def execute(self, request):
        """执行代码"""
        serializer = CodeExecutionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # 创建代码执行记录
        execution = CodeExecution.objects.create(
            user=request.user,
            code=serializer.validated_data['code'],
            language=serializer.validated_data['language'],
            input_data=serializer.validated_data.get('input_data'),
            status='pending'
        )
        
        # 执行代码
        code_execution_service = CodeExecutionService()
        execution = code_execution_service.execute_code(execution)
        
        # 返回结果
        response_serializer = CodeExecutionResponseSerializer(execution)
        return Response(response_serializer.data)
    
    @action(detail=True, methods=['post'])
    def rerun(self, request, pk=None):
        """重新执行代码"""
        execution = self.get_object()
        
        # 重置状态
        execution.status = 'pending'
        execution.output = None
        execution.error = None
        execution.execution_time = 0
        execution.memory_usage = 0
        execution.save()
        
        # 执行代码
        code_execution_service = CodeExecutionService()
        execution = code_execution_service.execute_code(execution)
        
        # 返回结果
        response_serializer = CodeExecutionResponseSerializer(execution)
        return Response(response_serializer.data)
