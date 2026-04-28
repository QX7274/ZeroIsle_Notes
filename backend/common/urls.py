"""
通用模块URL配置
"""

from rest_framework.routers import DefaultRouter
from .views.task_status import TaskStatusViewSet

router = DefaultRouter()
router.register(r'tasks', TaskStatusViewSet, basename='task-status')

urlpatterns = router.urls
