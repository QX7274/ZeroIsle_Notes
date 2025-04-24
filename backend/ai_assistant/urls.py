"""AI助手URL配置"""
from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat_completion, name='ai_chat'),
    path('transcribe/', views.transcribe_audio, name='ai_transcribe'),
    path('process-text/', views.process_text, name='ai_process_text'),
    path('analyze-image/', views.analyze_image, name='ai_analyze_image'),
]
