from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, 
    UserRegistrationView, 
    UserLoginView,
    UserProfileView
)

router = DefaultRouter()
router.register(r'users', UserViewSet)

auth_urls = [
    path('register/', UserRegistrationView.as_view(), name='user-register'),
    path('login/', UserLoginView.as_view(), name='user-login'),
    path('me/', UserProfileView.as_view(), name='user-profile'),
    path('change_password/', UserProfileView.as_view({'post': 'change_password'}), name='user-change-password'),
    path('reset_password/', UserProfileView.as_view({'post': 'reset_password'}), name='user-reset-password'),
    path('wechat_login/', UserViewSet.as_view({'post': 'wechat_login'}), name='user-wechat-login'),
    path('qq_login/', UserViewSet.as_view({'post': 'qq_login'}), name='user-qq-login'),
]

urlpatterns = [
    path('', include(router.urls)),
    path('users/', include(auth_urls)),
]