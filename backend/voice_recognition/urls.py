from django.urls import path
from . import views

urlpatterns = [
    path('voice-transcription', views.transcribe_audio, name='transcribe_audio'),
    path('meeting-summary', views.generate_meeting_summary, name='generate_meeting_summary'),
]