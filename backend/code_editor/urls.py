"""
代码编辑模块 URL 配置
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from code.views import (
    CodeCompleteView,
    CodeDetectView,
    CodeExampleView,
    CodeExecutionViewSet,
    CodeExplainView,
    CodeFormatView,
    CodeLintView,
    CodeRunView,
    CodeSnippetViewSet,
)

router = DefaultRouter()
router.register(r'executions', CodeExecutionViewSet, basename='code-execution')
router.register(r'snippets', CodeSnippetViewSet, basename='code-snippet')

api_urls = [
    path('run/', CodeRunView.as_view(), name='code-run-api'),
    path('detect/', CodeDetectView.as_view(), name='code-detect-api'),
    path('complete/', CodeCompleteView.as_view(), name='code-complete-api'),
    path('format/', CodeFormatView.as_view(), name='code-format-api'),
    path('lint/', CodeLintView.as_view(), name='code-lint-api'),
    path('explain/', CodeExplainView.as_view(), name='code-explain-api'),
    path('example/', CodeExampleView.as_view(), name='code-example-api'),
]

urlpatterns = [
    path('', include(router.urls)),
    path('run/', CodeRunView.as_view(), name='code-run'),
    path('detect/', CodeDetectView.as_view(), name='code-detect'),
    path('complete/', CodeCompleteView.as_view(), name='code-complete'),
    path('format/', CodeFormatView.as_view(), name='code-format'),
    path('lint/', CodeLintView.as_view(), name='code-lint'),
    path('explain/', CodeExplainView.as_view(), name='code-explain'),
    path('example/', CodeExampleView.as_view(), name='code-example'),
    path('api/', include(api_urls)),
    path('run', CodeRunView.as_view(), name='code-run-legacy'),
    path('detect', CodeDetectView.as_view(), name='code-detect-legacy'),
    path('complete', CodeCompleteView.as_view(), name='code-complete-legacy'),
    path('format', CodeFormatView.as_view(), name='code-format-legacy'),
    path('lint', CodeLintView.as_view(), name='code-lint-legacy'),
    path('explain', CodeExplainView.as_view(), name='code-explain-legacy'),
    path('example', CodeExampleView.as_view(), name='code-example-legacy'),
]
