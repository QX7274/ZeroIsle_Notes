from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SystemSettingViewSet, AnnouncementViewSet, SystemBackupViewSet
from .admin_views import AdminUserViewSet, RoleViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'system', SystemSettingViewSet, basename='system-setting')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'backups', SystemBackupViewSet, basename='system-backup')
# 管理员与角色：前端 AdminManagement 页面依赖这两个接口，此前后端完全缺失。
# 管理员 = users 集合中 is_staff/is_superuser 的受控视图（方案 B 口径），
# 不是新增的管理员表；角色为只读的两档视图。详见 admin_views.py 的说明。
router.register(r'admins', AdminUserViewSet, basename='admin-user')
router.register(r'roles', RoleViewSet, basename='role')

urlpatterns = [
    path('', include(router.urls)),
]
