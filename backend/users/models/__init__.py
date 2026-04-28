"""
用户模块模型初始化文件

明确区分 Django ORM 模型 与 MongoDB(MongoEngine) 文档模型，
并提供清晰的命名以避免歧义。

对外约定：
- 默认导出的 User 为 Django ORM 模型（用于Django认证与管理后台）
- 提供 MongoUser 等别名用于直接访问 MongoEngine 文档模型
- VerificationCode 默认为本目录中的文档模型；提供 MongoVerificationCode 以兼容需要 Realm/Mongo 版本的场景
"""

# Django ORM 模型（用于 Django 认证、管理后台等）
from .user import User as DjangoUser
from .social_account import SocialAccount

# 本目录下的 MongoEngine 文档模型（项目内使用较多的文档定义）
from .verification_code import VerificationCode
from .third_party_account import ThirdPartyAccount
from .user_profile import UserProfile
from .user_settings import UserSettings
from .user_device import UserDevice
from .login_attempt import LoginAttempt

# 兼容导入：明确从 mongodb_models 引入的 MongoEngine 文档模型
from ..mongodb_models import (
    User as MongoUser,
    VerificationCode as MongoVerificationCode,
    UserProfile as MongoUserProfile,
    UserSettings as MongoUserSettings,
    TokenBlacklist,
)

# 默认导出：保持与 Django 生态一致
User = DjangoUser

__all__ = [
    # 默认/常用导出
    'User',  # Django ORM
    'SocialAccount',
    'VerificationCode',
    'ThirdPartyAccount',
    'UserProfile',
    'UserSettings',
    'UserDevice',
    'LoginAttempt',

    # 显式 MongoEngine 文档模型别名
    'MongoUser',
    'MongoVerificationCode',
    'MongoUserProfile',
    'MongoUserSettings',
    'TokenBlacklist',

    # 明确 Django 模型别名（如需显式区分时使用）
    'DjangoUser',
]
