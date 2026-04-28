"""Common middleware package.

兼容旧结构：项目里同时存在
- common/middleware.py（历史单文件实现）
- common/middleware/（当前包）

Django settings 中使用 `common.middleware.ClassName`，这里需要把历史单文件中的
中间件类显式桥接出来，避免同名包/模块导致的循环导入。
"""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from .dev_auth_middleware import DevAuthMiddleware

_legacy_path = Path(__file__).resolve().parent.parent / "middleware.py"
_spec = spec_from_file_location("common_legacy_middleware", _legacy_path)
_legacy = module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_legacy)

RequestLogMiddleware = _legacy.RequestLogMiddleware
RateLimitMiddleware = _legacy.RateLimitMiddleware
XSSProtectionMiddleware = _legacy.XSSProtectionMiddleware
EnhancedCsrfViewMiddleware = _legacy.EnhancedCsrfViewMiddleware
SecurityHeadersMiddleware = _legacy.SecurityHeadersMiddleware
RequestLoggingMiddleware = _legacy.RequestLoggingMiddleware

__all__ = [
    "DevAuthMiddleware",
    "RequestLogMiddleware",
    "RateLimitMiddleware",
    "XSSProtectionMiddleware",
    "EnhancedCsrfViewMiddleware",
    "SecurityHeadersMiddleware",
    "RequestLoggingMiddleware",
]



