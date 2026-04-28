"""
通用异步任务状态视图
"""

from rest_framework_mongoengine import viewsets as mongo_viewsets
from rest_framework.permissions import IsAuthenticated

from ..mongodb_models import AsyncTask
from ..serializers import AsyncTaskSerializer

class TaskStatusViewSet(mongo_viewsets.ReadOnlyModelViewSet):
    """
    提供一个只读端点，用于查询用户自己的异步任务状态。
    """
    serializer_class = AsyncTaskSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        """只返回当前登录用户创建的任务。"""
        return AsyncTask.objects.filter(user=self.request.user)
