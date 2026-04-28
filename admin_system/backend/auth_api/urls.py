from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    LogoutView,
    CheckAuthView,
    ChangePasswordView,
    AdminLoginLogViewSet
)

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'logs', AdminLoginLogViewSet, basename='admin-login-log')

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('check/', CheckAuthView.as_view(), name='check-auth'),
    path('password/', ChangePasswordView.as_view(), name='change-password'),
    path('refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('', include(router.urls)),
]
