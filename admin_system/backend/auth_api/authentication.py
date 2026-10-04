"""管理后台鉴权（方案 B）：复用主后端的 users 集合与自定义 JWT。

设计要点
--------
管理后台此前用 Django ORM 的 \`django.contrib.auth.models.User\` 做登录，
而 \`admin_backend/settings.py\` 的数据库引擎是 \`dummy\`，
导致 \`authenticate()\` 直接抛 \`ImproperlyConfigured\` —— 管理员**永远登录不进来**。

方案 B 的做法：管理员就是主后端 \`users\` 集合里 \`is_staff=True\` 的用户，
认证与权限全部复用主后端那套**已验证可用**的实现：

1. 密码校验：\`django.contrib.auth.hashers.check_password\`
   （与主后端 \`MongoUser.check_password\` 完全一致，哈希格式相同）；
2. 令牌签发/校验：\`rest_framework_simplejwt\`（与主后端同一套 \`SIMPLE_JWT\` 配置）；
3. 身份对象：直接返回 mongoengine 用户文档，
   其已具备 \`is_authenticated\` / \`is_anonymous\` / \`is_staff\` / \`is_superuser\`，
   DRF 的 \`IsAuthenticated\` 与权限类都能正常工作。

为什么不再依赖 Django ORM
--------------------------
管理后台与主后端共用同一个 MongoDB 库，用户数据本来就只存在于 MongoDB。
引入 SQL 库去做"管理员账号"（原方案 A）意味着维护两套身份 + 一套映射；
而主后端的自定义 JWT 已经解决了 UUID 主键等本项目踩过的坑
（RISK-BE-003），直接复用成本最低、风险最小。
"""

from __future__ import annotations

import logging

from django.contrib.auth.hashers import check_password as django_check_password
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

logger = logging.getLogger(__name__)

# 与管理后台 models.UserProfile 的 status 取值保持一致
STATUS_BANNED = 'banned'


def get_user_model():
    """延迟获取管理后台的用户模型，避免 import 期触发 MongoDB 连接。"""
    from users.models import UserProfile

    return UserProfile


def authenticate_admin(username, password):
    """校验管理员凭据。成功返回用户文档，失败返回 None。

    只接受 is_staff=True 的账号——这是"管理员"的判定口径，
    与主后端 \`users.permissions.IsOwnerOrAdmin\` 里对管理员的定义一致。
    """
    if not username or not password:
        return None

    UserModel = get_user_model()
    user = UserModel.objects(username=username).first()
    if user is None:
        return None

    # 未声明 password 字段的 Document 取不到该属性；
    # 此时说明这条用户没有可校验的密码哈希，按认证失败处理（不抛异常，避免枚举账号）。
    stored_hash = getattr(user, 'password', None)
    if not stored_hash:
        logger.warning('管理员 %s 没有密码哈希，拒绝登录', username)
        return None

    if not django_check_password(password, stored_hash):
        return None

    if not getattr(user, 'is_active', True):
        return None
    if getattr(user, 'status', None) == STATUS_BANNED:
        return None
    if not getattr(user, 'is_staff', False):
        # 是合法用户但不是管理员：不签发管理后台令牌
        logger.info('用户 %s 非 staff，拒绝进入管理后台', username)
        return None

    return user


class AdminJWTAuthentication(BaseAuthentication):
    """基于 SimpleJWT 的管理后台认证类。

    与主后端 \`users.jwt_auth.CustomJWTAuthentication\` 的区别：
    主后端那份还要处理 Django ORM 用户映射与开发令牌等兼容逻辑；
    管理后台只需要"校验令牌 → 取 MongoDB 用户 → 确认是 staff"这一条最小路径，
    因此这里保持简单，避免把主后端的历史兼容分支带进来。
    """

    def authenticate(self, request):
        from rest_framework_simplejwt.authentication import JWTAuthentication

        jwt_auth = JWTAuthentication()
        header = jwt_auth.get_header(request)
        if header is None:
            return None
        raw_token = jwt_auth.get_raw_token(header)
        if raw_token is None:
            return None

        # 令牌无效/过期时 JWTAuthentication 会抛 AuthenticationFailed，交由 DRF 处理
        validated_token = jwt_auth.get_validated_token(raw_token)
        user = self._resolve_user(validated_token)
        return (user, validated_token)

    def _resolve_user(self, validated_token):
        from rest_framework_simplejwt.settings import api_settings as jwt_settings

        claim = jwt_settings.USER_ID_CLAIM
        try:
            user_id = validated_token[claim]
        except KeyError:
            raise exceptions.AuthenticationFailed('令牌中缺少用户标识')

        UserModel = get_user_model()
        try:
            # 管理后台与主后端主键口径已对齐为 binary UUID（阶段3），
            # 但令牌里的 id 可能是带/不带连字符的字符串，两种都试一次。
            user_id_str = str(user_id)
            user = UserModel.objects(
                id__in=[user_id_str, user_id_str.replace('-', '')]
            ).first()
        except Exception as exc:  # noqa: BLE001
            logger.error('解析令牌用户失败: %s', exc)
            raise exceptions.AuthenticationFailed('无效的令牌或用户不存在')

        if user is None:
            raise exceptions.AuthenticationFailed('用户不存在')
        if not getattr(user, 'is_active', True):
            raise exceptions.AuthenticationFailed('用户已被禁用')
        if not getattr(user, 'is_staff', False):
            raise exceptions.AuthenticationFailed('该账号没有管理后台访问权限')

        return user


class IsAdminStaff(BasePermission):
    """权限类：要求已认证且是 staff（或 superuser）。

    替代原先依赖 Django ORM 的 \`IsAdminUser\`
    （它读 \`request.user.is_staff\`，而 request.user 现在来自 MongoDB，语义一致）。
    """

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return False
        return bool(
            getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)
        )
