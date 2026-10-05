"""仪表盘统计路由。

前端 statsService.getDashboardStats 调用的是 `/stats/dashboard`
（相对 axios baseURL `/api`，即 `/api/stats/dashboard/`），
因此这里挂在顶层而不是某个 app 之下 —— 统计本身跨 users/notes/content 多个领域。
"""

from django.urls import path

from content.dashboard_views import DashboardStatsView

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard-stats'),
]
