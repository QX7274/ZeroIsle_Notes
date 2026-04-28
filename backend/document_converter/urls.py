from django.urls import path
from .views import (
    health_check,
    DocumentConverterView,
    download_converted_pdf,
    Base64ConvertView,
    generate_download_token,
    conversion_status_by_id
)

app_name = 'document_converter'

urlpatterns = [
    # Health check endpoint
    path('health/', health_check, name='health_check'),

    # Conversion endpoints
    path('convert/', DocumentConverterView.as_view(), name='convert_document'),
    path('convert-base64/', Base64ConvertView.as_view(), name='convert_base64'),

    # Download and status
    path('download/<str:filename>/', download_converted_pdf, name='download_pdf'),
    path('status/<str:task_id>/', conversion_status_by_id, name='conversion_status_by_id'),

    # Token generation
    path('generate-download-token/', generate_download_token, name='generate_download_token'),
]
