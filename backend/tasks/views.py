"""
异步任务视图
"""

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AsyncTask
from .serializers import AsyncTaskSerializer

class TaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    只读视图集，用于查询异步任务的状态。
    """
    queryset = AsyncTask.objects.all()
    serializer_class = AsyncTaskSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        """
        确保用户只能查询自己的任务。
        """
        return AsyncTask.objects.filter(user=self.request.user)
