from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserProfileViewSet, UserActivityViewSet
from .views import PasswordResetView, VerifyResetCodeView, CompletePasswordResetView

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'profiles', UserProfileViewSet, basename='user-profile')
router.register(r'activities', UserActivityViewSet, basename='user-activity')

urlpatterns = [
    path('', include(router.urls)),

    # 密码重置相关路由
    path('password/reset/', PasswordResetView.as_view(), name='password_reset'),
    path('password/verify-code/', VerifyResetCodeView.as_view(), name='verify_reset_code'),
    path('password/complete-reset/', CompletePasswordResetView.as_view(), name='complete_password_reset'),
]
