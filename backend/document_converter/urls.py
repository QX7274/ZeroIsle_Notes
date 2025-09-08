from django.urls import path
from . import views

app_name = 'document_converter'

urlpatterns = [
    # 原有的文件上传转换接口
    path('convert/', views.DocumentConverterView.as_view(), name='convert'),
    path('download/<str:filename>/', views.download_converted_pdf, name='download'),
    path('progress/', views.convert_progress, name='progress'),
    path('cleanup/', views.cleanup_temp_files, name='cleanup'),

    # 新增的API接口
    path('convert/base64/', views.Base64ConvertView.as_view(), name='convert_base64'),
    path('health/', views.health_check, name='health'),
    path('status/', views.conversion_status, name='status'),
]
