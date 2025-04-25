"""
语音识别模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AudioFileViewSet,
    TranscriptionViewSet,
    LanguageViewSet,
    SpeakerViewSet
)
from . import views as legacy_views

# 创建路由器
router = DefaultRouter()
router.register(r'audio-files', AudioFileViewSet, basename='audio-file')
router.register(r'transcriptions', TranscriptionViewSet, basename='transcription')
router.register(r'languages', LanguageViewSet, basename='language')
router.register(r'speakers', SpeakerViewSet, basename='speaker')

# 兼容旧版API
legacy_urls = [
    path('voice-transcription', legacy_views.transcribe_audio, name='transcribe_audio'),
    path('meeting-summary', legacy_views.generate_meeting_summary, name='generate_meeting_summary'),
]

urlpatterns = [
    # API路由
    path('', include(router.urls)),

    # 兼容旧版API
    *legacy_urls,
]