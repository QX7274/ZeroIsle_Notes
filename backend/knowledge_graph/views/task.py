"""
知识图谱任务管理视图
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
import uuid

from ..models.task import KGTask
from ..utils.response import KGResponse, ErrorCodes


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_build_task(request):
    """
    创建构建任务
    
    POST /api/knowledge-graph/task/build/
    {
        "scope": "all|user|notes",
        "parameters": {...}
    }
    """
    scope = request.data.get('scope')
    parameters = request.data.get('parameters', {})
    
    if not scope:
        return KGResponse.error(
            ErrorCodes.INVALID_PARAM,
            'scope is required',
            {'field': 'scope'},
            status.HTTP_400_BAD_REQUEST
        )
    
    # 创建任务
    task_id = str(uuid.uuid4())
    task = KGTask.objects.create(
        task_id=task_id,
        task_type='build',
        user=request.user,
        status='pending'
    )
    
    # TODO: 异步执行构建任务 (Celery)
    # build_graph_async.delay(task_id, scope, parameters)
    
    return KGResponse.success(
        {
            'task_id': task.task_id,
            'status': task.status,
            'created_at': task.created_at.isoformat()
        },
        status_code=status.HTTP_202_ACCEPTED
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_status(request, task_id):
    """
    获取任务状态
    
    GET /api/knowledge-graph/task/{task_id}/status/
    """
    try:
        task = KGTask.objects.get(task_id=task_id, user=request.user)
        
        response_data = {
            'task_id': task.task_id,
            'task_type': task.task_type,
            'status': task.status,
            'progress': task.progress,
            'stats': task.stats,
            'errors': task.errors,
            'created_at': task.created_at.isoformat(),
            'updated_at': task.updated_at.isoformat(),
        }
        
        if task.completed_at:
            response_data['completed_at'] = task.completed_at.isoformat()
        
        return KGResponse.success(response_data)
        
    except KGTask.DoesNotExist:
        return KGResponse.error(
            ErrorCodes.NOT_FOUND,
            'Task not found',
            {'task_id': task_id},
            status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_tasks(request):
    """
    列出用户的任务
    
    GET /api/knowledge-graph/task/list/?task_type=build&status=running
    """
    queryset = KGTask.objects.filter(user=request.user)
    
    # 过滤任务类型
    task_type = request.query_params.get('task_type')
    if task_type:
        queryset = queryset.filter(task_type=task_type)
    
    # 过滤状态
    task_status = request.query_params.get('status')
    if task_status:
        queryset = queryset.filter(status=task_status)
    
    # 排序
    queryset = queryset.order_by('-created_at')
    
    # 分页
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    
    offset = (page - 1) * page_size
    total = queryset.count()
    
    tasks = queryset[offset:offset + page_size]
    
    data = [
        {
            'task_id': task.task_id,
            'task_type': task.task_type,
            'status': task.status,
            'progress': task.progress,
            'created_at': task.created_at.isoformat(),
            'updated_at': task.updated_at.isoformat(),
        }
        for task in tasks
    ]
    
    pagination = {
        'total': total,
        'page': page,
        'page_size': page_size,
        'has_next': (page * page_size) < total,
    }
    
    return KGResponse.success(data, pagination=pagination)

