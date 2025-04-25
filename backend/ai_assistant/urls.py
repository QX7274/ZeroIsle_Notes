"""
AI助手模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConversationViewSet,
    MessageViewSet,
    PromptTemplateViewSet,
    ModelConfigViewSet,
    UsageRecordViewSet,
    FeedbackViewSet
)
from . import views as legacy_views

# 创建路由器
router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'prompt-templates', PromptTemplateViewSet, basename='prompt-template')
router.register(r'models', ModelConfigViewSet, basename='model-config')
router.register(r'usage-records', UsageRecordViewSet, basename='usage-record')
router.register(r'feedback', FeedbackViewSet, basename='feedback')

# 兼容旧版API
legacy_urls = [
    path('chat/', legacy_views.chat_completion, name='ai_chat'),
    path('transcribe/', legacy_views.transcribe_audio, name='ai_transcribe'),
    path('process-text/', legacy_views.process_text, name='ai_process_text'),
    path('analyze-image/', legacy_views.analyze_image, name='ai_analyze_image'),
]

urlpatterns = [
    # API路由
    path('', include(router.urls)),

    # 兼容旧版API
    *legacy_urls,
]
