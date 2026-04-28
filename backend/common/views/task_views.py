"""
通用异步任务视图
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from ..mongodb_models import AsyncTask
from ..serializers import AsyncTaskSerializer

class AsyncTaskStatusView(APIView):
    """
    查询异步任务状态的视图。
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id, format=None):
        """
        通过任务ID获取任务状态。
        """
        try:
            # 仅允许用户查询自己的任务
            task = AsyncTask.objects.get(id=task_id, user_id=str(request.user.id))
            serializer = AsyncTaskSerializer(task)
            return Response(serializer.data)
        except AsyncTask.DoesNotExist:
            return Response({"error": "任务不存在或您没有权限查看"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
