from django.urls import path
from .views import (
    CodeView,
    CodeDetectView,
    CodeCompleteView,
    CodeFormatView,
    CodeLintView
)

urlpatterns = [
    path('run', CodeView.as_view(), name='code-run'),
    path('detect', CodeDetectView.as_view(), name='code-detect'),
    path('complete', CodeCompleteView.as_view(), name='code-complete'),
    path('format', CodeFormatView.as_view(), name='code-format'),
    path('lint', CodeLintView.as_view(), name='code-lint'),
] 