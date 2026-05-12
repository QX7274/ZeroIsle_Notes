"""
代码执行视图
"""

from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from code.mongodb_models import CodeExecution
from code.serializers import (
    CodeExecutionRequestSerializer,
    CodeExecutionResponseSerializer,
    CodeExecutionSerializer,
)
from code.services import CodeExecutionService
from common.pagination import StandardResultsSetPagination
from common.permissions import IsOwner
from users.utils import get_mongo_user_from_django


class CodeExecutionViewSet(viewsets.ViewSet):
    """代码执行视图集"""

    serializer_class = CodeExecutionSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['language', 'status']
    search_fields = ['code']
    ordering_fields = ['created_at', 'execution_time', 'memory_usage']
    ordering = ['-created_at']
    lookup_field = 'id'

    def get_serializer_class(self):
        if getattr(self, 'action', None) == 'create':
            return CodeExecutionRequestSerializer
        return self.serializer_class

    def get_serializer(self, *args, **kwargs):
        serializer_class = self.get_serializer_class()
        return serializer_class(*args, **kwargs)

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(list(queryset), self.request, view=self)
        self._paginator = paginator
        return page

    def get_paginated_response(self, data):
        return self._paginator.get_paginated_response(data)

    def _get_mongo_user(self, request):
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user
        return get_mongo_user_from_django(request.user)

    def _get_required_mongo_user(self, request):
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return None, Response(
                {'detail': '当前用户缺少 Mongo 用户映射，无法访问该接口'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return mongo_user, None

    def get_queryset(self):
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return CodeExecution.objects.none()
        return CodeExecution.objects.filter(user=mongo_user).order_by('-created_at')

    def get_object(self, pk):
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return None
        return CodeExecution.objects.filter(id=pk, user=mongo_user).first()

    def list(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        execution = self.get_object(pk)
        if not execution:
            return Response({'detail': '执行记录不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(execution)
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        execution = self.get_object(pk)
        if not execution:
            return Response({'detail': '执行记录不存在'}, status=status.HTTP_404_NOT_FOUND)
        execution.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request):
        return self.execute(request)

    @action(detail=False, methods=['post'])
    def execute(self, request):
        serializer = CodeExecutionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mongo_user, error_response = self._get_required_mongo_user(request)
        if error_response:
            return error_response

        execution = CodeExecution(
            user=mongo_user,
            code=serializer.validated_data['code'],
            language=serializer.validated_data['language'],
            input_data=serializer.validated_data.get('input_data'),
            status='pending',
        )
        execution.save()

        code_execution_service = CodeExecutionService()
        execution = code_execution_service.execute_code(execution)

        response_serializer = CodeExecutionResponseSerializer(execution)
        return Response(response_serializer.data)

    @action(detail=True, methods=['post'])
    def rerun(self, request, pk=None):
        execution = self.get_object(pk)
        if not execution:
            return Response({'detail': '执行记录不存在'}, status=status.HTTP_404_NOT_FOUND)

        execution.status = 'pending'
        execution.output = ''
        execution.error = ''
        execution.execution_time = 0
        execution.memory_usage = 0
        execution.save()

        code_execution_service = CodeExecutionService()
        execution = code_execution_service.execute_code(execution)

        response_serializer = CodeExecutionResponseSerializer(execution)
        return Response(response_serializer.data)

