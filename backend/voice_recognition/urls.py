"""
语音识别模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AudioFileViewSet,
    TranscriptionViewSet,
    LanguageViewSet,
    SpeakerViewSet,
    transcribe_audio,
    generate_meeting_summary,
    process_voice_command
)
from .views.offline_model import (
    get_service_status,
    list_offline_models,
    download_offline_model,
    delete_offline_model,
    change_offline_model,
    toggle_service_mode
)
from .views.diarization import (
    process_diarization,
    get_diarization_status
)
from .views.speaker_management import (
    rename_speaker,
    merge_speakers,
    list_speakers
)
from .views.realtime_transcription import (
    create_session,
    add_audio_chunk,
    get_results,
    finish_session,
    get_session_status
)

# 创建路由器
router = DefaultRouter()
router.register(r'audio-files', AudioFileViewSet, basename='audio-file')
router.register(r'transcriptions', TranscriptionViewSet, basename='transcription')
router.register(r'languages', LanguageViewSet, basename='language')
router.register(r'speakers', SpeakerViewSet, basename='speaker')

# API端点
urlpatterns = [
    # API路由
    path('', include(router.urls)),

    # 语音转写相关
    path('transcribe/', transcribe_audio, name='transcribe_audio'),
    path('meeting/', generate_meeting_summary, name='generate_meeting_summary'),
    path('command/', process_voice_command, name='process_voice_command'),

    # 历史记录
    path('history/', TranscriptionViewSet.as_view({'get': 'list'}), name='transcription_history'),

    # 会议纪要
    path('meeting-summary/', generate_meeting_summary, name='meeting_summary'),

    # 离线模型管理
    path('service-status/', get_service_status, name='service_status'),
    path('offline-models/', list_offline_models, name='list_offline_models'),
    path('offline-models/download/', download_offline_model, name='download_offline_model'),
    path('offline-models/delete/', delete_offline_model, name='delete_offline_model'),
    path('offline-models/change/', change_offline_model, name='change_offline_model'),
    path('toggle-mode/', toggle_service_mode, name='toggle_service_mode'),

    # 说话人分离
    path('diarization/', process_diarization, name='process_diarization'),
    path('diarization-status/', get_diarization_status, name='get_diarization_status'),

    # 说话人管理
    path('speakers/', list_speakers, name='list_speakers'),
    path('speakers/rename/', rename_speaker, name='rename_speaker'),
    path('speakers/merge/', merge_speakers, name='merge_speakers'),

    # 实时转写
    path('realtime/create-session/', create_session, name='create_session'),
    path('realtime/add-audio/', add_audio_chunk, name='add_audio_chunk'),
    path('realtime/get-results/', get_results, name='get_results'),
    path('realtime/finish-session/', finish_session, name='finish_session'),
    path('realtime/session-status/', get_session_status, name='get_session_status'),
]