"""
代码执行模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from code.views import (
    CodeExecutionViewSet,
    CodeSnippetViewSet,
    CodeRunView,
    CodeDetectView,
    CodeCompleteView,
    CodeFormatView,
    CodeLintView
)

# 创建路由器
router = DefaultRouter()
router.register(r'executions', CodeExecutionViewSet, basename='code-execution')
router.register(r'snippets', CodeSnippetViewSet, basename='code-snippet')

# API路径
api_urls = [
    path('run/', CodeRunView.as_view(), name='code-run'),
    path('detect/', CodeDetectView.as_view(), name='code-detect'),
    path('complete/', CodeCompleteView.as_view(), name='code-complete'),
    path('format/', CodeFormatView.as_view(), name='code-format'),
    path('lint/', CodeLintView.as_view(), name='code-lint'),
]

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),

    # API URL
    path('api/', include(api_urls)),

    # 兼容旧版API
    path('run', CodeRunView.as_view(), name='code-run-legacy'),
    path('detect', CodeDetectView.as_view(), name='code-detect-legacy'),
    path('complete', CodeCompleteView.as_view(), name='code-complete-legacy'),
    path('format', CodeFormatView.as_view(), name='code-format-legacy'),
    path('lint', CodeLintView.as_view(), name='code-lint-legacy'),
]