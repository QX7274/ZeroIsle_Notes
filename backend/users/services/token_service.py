"""
令牌服务，处理黑名单等逻辑 (MongoEngine 版本)
"""

from django.utils import timezone
from datetime import datetime
from users.mongodb_models import TokenBlacklist
import logging

logger = logging.getLogger(__name__)

class TokenBlacklistService:
    """
    使用 MongoEngine 管理 JWT 黑名单的服务。
    """

    @classmethod
    def add_to_blacklist(cls, token, user=None, reason=None):
        """
        将一个JWT（Access/Refresh）添加到黑名单。

        Args:
            token: simple-jwt的Token对象（AccessToken/RefreshToken）。
            user: 可选，关联的用户对象，用于审计。
            reason: 可选，加入黑名单的原因。
        """
        jti = token.get('jti')
        if not jti:
            return

        exp_ts = token.get('exp')
        if not exp_ts:
            logger.warning(f"无法将没有 'exp' 的令牌加入黑名单: jti={jti}")
            return

        # 使用 timezone-aware datetime
        expires_dt = datetime.fromtimestamp(exp_ts, tz=timezone.utc)

        try:
            # 使用 modify(upsert=True) 来原子性地创建或更新文档
            TokenBlacklist.objects(jti=jti).modify(
                upsert=True,
                set__jti=jti,
                set_on_insert__user=user,
                set_on_insert__reason=reason or 'manual',
                set_on_insert__expires_at=expires_dt,
                set_on_insert__created_at=timezone.now()
            )
        except Exception as e:
            logger.error(f"无法将令牌加入黑名单数据库: {e}")
            # 在数据库不可用时忽略，避免影响主流程
            pass

    @classmethod
    def is_blacklisted(cls, token):
        """
        检查一个令牌是否在黑名单中。

        Args:
            token: simple-jwt的Token对象。

        Returns:
            bool: 如果令牌在黑名单中，则返回True。
        """
        jti = token.get('jti')
        if not jti:
            # 没有jti的令牌无法被有效拉黑，视为有风险
            return True

        try:
            # 直接查询数据库
            return TokenBlacklist.objects(jti=jti).count() > 0
        except Exception as e:
            logger.error(f"黑名单检查失败: {e}")
            # 在数据库不可用时，为安全起见，可以默认拒绝令牌
            # 但这里选择开放失败，以避免数据库问题导致全站不可用
            return False
