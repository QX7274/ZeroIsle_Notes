from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AnalyticsReportViewSet,
    DashboardWidgetViewSet,
    ReportTemplateViewSet,
    AnalyticsViewSet
)

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'reports', AnalyticsReportViewSet, basename='analytics-report')
router.register(r'widgets', DashboardWidgetViewSet, basename='dashboard-widget')
router.register(r'templates', ReportTemplateViewSet, basename='report-template')
router.register(r'analytics', AnalyticsViewSet, basename='analytics')

# 定义URL模式
urlpatterns = [
    path('', include(router.urls)),
]
