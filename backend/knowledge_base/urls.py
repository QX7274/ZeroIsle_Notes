"""
知识库URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from knowledge_base import views

router = DefaultRouter()
router.register(r'knowledge-bases', views.KnowledgeBaseViewSet, basename='knowledgebase')

urlpatterns = [
    path('', include(router.urls)),
]

