"""
用户模块模型初始化文件
导入所有模型以便在其他地方直接从users.models导入
"""

# 从MongoDB模型导入User
from ..mongodb_models import User
from .user import User as DjangoUser
from .verification_code import VerificationCode
from .third_party_account import ThirdPartyAccount
from .user_profile import UserProfile
from .user_settings import UserSettings
from .user_device import UserDevice
from .login_attempt import LoginAttempt
