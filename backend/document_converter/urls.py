from django.urls import path
from . import views

app_name = 'document_converter'

urlpatterns = [
    path('convert/', views.DocumentConverterView.as_view(), name='convert'),
    path('download/<str:filename>/', views.download_converted_pdf, name='download'),
    path('progress/', views.convert_progress, name='progress'),
    path('cleanup/', views.cleanup_temp_files, name='cleanup'),
]
