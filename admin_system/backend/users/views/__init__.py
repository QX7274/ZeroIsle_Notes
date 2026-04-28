"""用户模块视图初始化文件。"""

import importlib.util
from pathlib import Path

from .password_reset import PasswordResetView, VerifyResetCodeView, CompletePasswordResetView

# 桥接 users/views.py（文件）与 users/views/（包）同名冲突
_legacy_views_path = Path(__file__).resolve().parents[1] / 'views.py'
_spec = importlib.util.spec_from_file_location('users.views_legacy', _legacy_views_path)
_legacy_views_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_legacy_views_module)

UserProfileViewSet = _legacy_views_module.UserProfileViewSet
UserActivityViewSet = _legacy_views_module.UserActivityViewSet
