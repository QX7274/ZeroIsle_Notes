"""
用户模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.token_views import CustomTokenRefreshView, CustomLogoutView
from .views import (
    # UserLogoutView, # Replaced by CustomLogoutView
    UserProfileView,
    PasswordChangeView,
    PasswordResetView,
    UserViewSet,
    UserProfileViewSet,
    UserSettingsViewSet,
    UserDeviceViewSet,
    ThirdPartyAuthViewSet,
    UserBindingView,
    TestAPIView
)
# 导入MongoDB视图
from .views.mongo_auth import (
    MongoUserRegistrationView,
    MongoUserLoginView,
    MongoVerificationCodeView
)
# 导入MongoDB Realm视图
from .views.realm_auth import (
    RealmRegisterView,
    RealmLoginView,
    realm_sync_user
)
# 导入密码重置API视图
from .views.password_reset_api import (
    send_email_verification,
    send_sms_verification,
    reset_password
)
# 导入GDPR合规视图
from .views.gdpr_views import (
    export_user_data,
    request_account_deletion,
    cancel_account_deletion
)

# 创建路由器
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'profiles', UserProfileViewSet, basename='profile')
router.register(r'settings', UserSettingsViewSet, basename='settings')
router.register(r'devices', UserDeviceViewSet, basename='device')
router.register(r'third-party', ThirdPartyAuthViewSet, basename='third-party')
router.register(r'binding', UserBindingView, basename='binding')

# 认证相关URL
auth_urls = [
    # 测试API
    path('test/', TestAPIView.as_view(), name='test-api'),

    # 注册相关 (MongoDB版本)
    path('register/', MongoUserRegistrationView.as_view({'post': 'create'}), name='register'),
    path('register/username/', MongoUserRegistrationView.as_view({'post': 'register_with_username'}), name='register-username'),
    path('register/email/', MongoUserRegistrationView.as_view({'post': 'register_with_email'}), name='register-email'),
    path('register/phone/', MongoUserRegistrationView.as_view({'post': 'register_with_phone'}), name='register-phone'),

    # 登录相关 (MongoDB版本)
    path('login/', MongoUserLoginView.as_view({'post': 'create'}), name='login'),

    # 保留旧版登录API路由，但使用MongoDB视图
    path('login/code/', MongoUserLoginView.as_view({'post': 'create'}), name='login-code'),
    path('login/password/', MongoUserLoginView.as_view({'post': 'create'}), name='login-password'),
    path('login/email/', MongoUserLoginView.as_view({'post': 'create'}), name='login-email'),

    # 其他认证相关
    path('logout/', CustomLogoutView.as_view(), name='logout'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update'}), name='profile'),
    path('password/change/', PasswordChangeView.as_view(), name='password_change'),
    path('password/reset/', PasswordResetView.as_view(), name='password_reset'),
    path('verification-code/', MongoVerificationCodeView.as_view({'post': 'create'}), name='verification_code'),

    # 绑定相关
    path('bind/email/', UserBindingView.as_view({'post': 'bind_email'}), name='bind-email'),
    path('bind/phone/', UserBindingView.as_view({'post': 'bind_phone'}), name='bind-phone'),
    path('bind/wechat/', UserBindingView.as_view({'post': 'bind_wechat'}), name='bind-wechat'),
    path('bind/qq/', UserBindingView.as_view({'post': 'bind_qq'}), name='bind-qq'),

    # 兼容旧版API
    path('me/', UserProfileView.as_view({'get': 'get', 'put': 'put', 'patch': 'patch'}), name='user-profile'),
    path('avatar/upload/', UserProfileView.as_view({'post': 'upload_avatar'}), name='upload-avatar'),
    path('wechat_login/', ThirdPartyAuthViewSet.as_view({'post': 'wechat_login'}), name='wechat-login'),
    path('qq_login/', ThirdPartyAuthViewSet.as_view({'post': 'qq_login'}), name='qq-login'),

    # 发送验证码
    path('send_verification_code/', MongoVerificationCodeView.as_view({'post': 'create'}), name='send-verification-code'),

    # 密码重置API（供管理系统调用）
    path('send-email-verification/', send_email_verification, name='send-email-verification'),
    path('send-sms-verification/', send_sms_verification, name='send-sms-verification'),
    path('reset-password/', reset_password, name='reset-password-api'),

    # MongoDB Realm认证API
    path('realm/register/', RealmRegisterView.as_view(), name='realm-register'),
    path('realm/login/', RealmLoginView.as_view(), name='realm-login'),
    path('realm/sync-user/', realm_sync_user, name='realm-sync-user'),

    # GDPR Compliance APIs
    path('gdpr/export/', export_user_data, name='gdpr-export'),
    path('gdpr/delete/', request_account_deletion, name='gdpr-delete'),
    path('gdpr/delete/cancel/', cancel_account_deletion, name='gdpr-delete-cancel'),
]

urlpatterns = [
    # 认证相关URL
    path('', include(auth_urls)),

    # API路由
    path('', include(router.urls)),
]