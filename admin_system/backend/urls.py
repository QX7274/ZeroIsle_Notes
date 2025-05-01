from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'admin-logs', views.AdminLogViewSet)
router.register(r'announcements', views.SystemAnnouncementViewSet)
router.register(r'settings', views.SystemSettingViewSet)
router.register(r'roles', views.AdminRoleViewSet)
router.register(r'admin-users', views.AdminUserViewSet)
router.register(r'backups', views.SystemBackupViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),
    path('system/status/', views.system_status, name='system-status'),
    path('backups/create/', views.create_backup, name='create-backup'),
    path('backups/<int:pk>/restore/', views.restore_backup, name='restore-backup'),
]
