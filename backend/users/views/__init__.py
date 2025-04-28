"""
用户模块视图初始化文件
导入所有视图以便在其他地方直接从users.views导入
"""

from .auth import (
    UserRegistrationView,
    UserLoginView,
    UserLogoutView,
    UserProfileView,
    PasswordChangeView,
    PasswordResetView,
    VerificationCodeView,
    UserBindingView
)
from .user import UserViewSet
from .profile import UserProfileViewSet
from .settings import UserSettingsViewSet
from .device import UserDeviceViewSet
from .third_party import ThirdPartyAuthViewSet
from .test import TestAPIView
