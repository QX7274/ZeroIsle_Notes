"""
用户模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    UserRegistrationView,
    UserLoginView,
    UserLogoutView,
    UserProfileView,
    PasswordChangeView,
    PasswordResetView,
    VerificationCodeView,
    UserViewSet,
    UserProfileViewSet,
    UserSettingsViewSet,
    UserDeviceViewSet,
    ThirdPartyAuthViewSet
)

# 创建路由器
router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'profiles', UserProfileViewSet, basename='profile')
router.register(r'settings', UserSettingsViewSet, basename='settings')
router.register(r'devices', UserDeviceViewSet, basename='device')
router.register(r'third-party', ThirdPartyAuthViewSet, basename='third-party')

# 认证相关URL
auth_urls = [
    # 注册相关
    path('register/', UserRegistrationView.as_view({'post': 'create'}), name='register'),
    path('register/username/', UserRegistrationView.as_view({'post': 'register_with_username'}), name='register-username'),
    path('register/email/', UserRegistrationView.as_view({'post': 'register_with_email'}), name='register-email'),
    path('register/phone/', UserRegistrationView.as_view({'post': 'register_with_phone'}), name='register-phone'),

    # 登录相关
    path('login/', UserLoginView.as_view({'post': 'create'}), name='login'),
    path('login/code/', UserLoginView.as_view({'post': 'login_with_code'}), name='login-code'),
    path('login/password/', UserLoginView.as_view({'post': 'login_with_password'}), name='login-password'),
    path('login/email/', UserLoginView.as_view({'post': 'login_with_email'}), name='login-email'),

    # 其他认证相关
    path('logout/', UserLogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('password/change/', PasswordChangeView.as_view(), name='password_change'),
    path('password/reset/', PasswordResetView.as_view(), name='password_reset'),
    path('verification-code/', VerificationCodeView.as_view({'post': 'create'}), name='verification_code'),

    # 兼容旧版API
    path('me/', UserProfileView.as_view(), name='user-profile'),
    path('wechat_login/', ThirdPartyAuthViewSet.as_view({'post': 'wechat_login'}), name='wechat-login'),
    path('qq_login/', ThirdPartyAuthViewSet.as_view({'post': 'qq_login'}), name='qq-login'),

    # 发送验证码
    path('send_verification_code/', VerificationCodeView.as_view({'post': 'create'}), name='send-verification-code'),
]

urlpatterns = [
    # 认证相关URL
    path('', include(auth_urls)),

    # API路由
    path('', include(router.urls)),
]