"""
登录尝试模型
用于记录用户登录尝试，防止暴力破解
"""

from mongoengine import Document, StringField, BooleanField, DateTimeField
from mongoengine.queryset.visitor import Q
from django.utils import timezone
from datetime import timedelta, timezone as datetime_timezone
import logging

logger = logging.getLogger(__name__)


def _as_utc(value):
    """把时间统一到 UTC 口径，供锁定判定比较。

    RISK-BE-011 附带修复：MongoDB 存的是 UTC；drivers/测试替身（mongomock）可能返回
    naive datetime。旧实现按 settings.TIME_ZONE 解释 naive 值，在 TIME_ZONE='Asia/Shanghai'
    下会被平移 8 小时，导致「刚失败 5 次」也判不出锁定。这里统一按 UTC 解释。
    """
    if value is None:
        return None
    if timezone.is_naive(value):
        return value.replace(tzinfo=datetime_timezone.utc)
    return value.astimezone(datetime_timezone.utc)


# 登录限制配置
MAX_FAILED_ATTEMPTS = 5  # 最大失败尝试次数
LOCKOUT_DURATION = timedelta(minutes=30)  # 锁定时长
ATTEMPT_WINDOW = timedelta(hours=1)  # 统计失败尝试的时间窗口


class LoginAttempt(Document):
    """
    登录尝试记录
    """
    ip_address = StringField(max_length=45, required=True, verbose_name="IP地址")
    user_agent = StringField(required=False, verbose_name="用户代理")
    username = StringField(max_length=150, required=False, verbose_name="用户名")
    user_id = StringField(required=False, verbose_name="用户ID")
    success = BooleanField(default=False, verbose_name="是否成功")
    timestamp = DateTimeField(default=timezone.now, verbose_name="尝试时间")
    failure_reason = StringField(required=False, verbose_name="失败原因")
    # RISK-BE-011：是否已被「成功登录」清除。保留记录用于审计，只做标记，
    # is_account_locked 统计窗口时排除 is_reset=True 的记录。
    is_reset = BooleanField(default=False, verbose_name="是否已被成功登录清除")

    meta = {
        'collection': 'login_attempts',
        'ordering': ['-timestamp'],
        'indexes': [
            {'fields': ['ip_address', 'timestamp']},
            {'fields': ['username', 'timestamp']},
            {'fields': ['user_id', 'timestamp']},
            {'fields': ['timestamp'], 'expireAfterSeconds': 86400 * 7},  # 7天后自动删除
        ],
        'verbose_name': "登录尝试",
        'verbose_name_plural': "登录尝试"
    }

    def __str__(self):
        return f"{self.ip_address} - {self.timestamp} - {'成功' if self.success else '失败'}"

    @classmethod
    def is_account_locked(cls, username=None, user_id=None, ip_address=None):
        """
        检查账户是否被锁定
        
        Args:
            username: 用户名
            user_id: 用户ID
            ip_address: IP地址
            
        Returns:
            tuple: (is_locked, remaining_seconds, failed_count)
        """
        if not username and not user_id and not ip_address:
            return False, 0, 0
            
        now = timezone.now()
        window_start = now - ATTEMPT_WINDOW
        
        # 构建查询条件；is_reset__ne=True：已被成功登录清除的失败记录不再计入窗口
        # （RISK-BE-011：与 reset_failed_attempts 的标记语义保持一致）
        query = {'success': False, 'is_reset__ne': True, 'timestamp__gte': window_start}
        if username:
            query['username'] = username
        elif user_id:
            query['user_id'] = user_id
        elif ip_address:
            query['ip_address'] = ip_address
            
        # 统计失败次数
        failed_attempts = cls.objects(**query).count()
        
        if failed_attempts >= MAX_FAILED_ATTEMPTS:
            # 获取最后一次失败尝试的时间
            last_attempt = cls.objects(**query).order_by('-timestamp').first()
            if last_attempt and last_attempt.timestamp:
                # 统一到 UTC 再比较（naive 值按 UTC 解释，见 _as_utc）
                lockout_end = _as_utc(last_attempt.timestamp) + LOCKOUT_DURATION
                now_utc = _as_utc(now)
                if now_utc < lockout_end:
                    remaining = (lockout_end - now_utc).total_seconds()
                    return True, int(remaining), failed_attempts
                    
        return False, 0, failed_attempts

    @classmethod
    def record_attempt(cls, ip_address, success, username=None, user_id=None, 
                       user_agent=None, failure_reason=None):
        """
        记录登录尝试
        
        Args:
            ip_address: IP地址
            success: 是否成功
            username: 用户名
            user_id: 用户ID
            user_agent: 用户代理
            failure_reason: 失败原因
            
        Returns:
            LoginAttempt: 创建的记录

        Note:
            success=True 时会自动清除该用户此前的失败记录（RISK-BE-011），
            等价于显式调用 reset_failed_attempts，保证「成功登录后窗口清零」。
        """
        try:
            attempt = cls(
                ip_address=ip_address,
                username=username,
                user_id=user_id,
                user_agent=user_agent,
                success=success,
                failure_reason=failure_reason,
                timestamp=timezone.now()
            )
            attempt.save()
            
            if not success:
                logger.warning(
                    f"登录失败记录: username={username}, ip={ip_address}, "
                    f"reason={failure_reason}"
                )
            else:
                logger.info(f"登录成功记录: username={username}, ip={ip_address}")
                # RISK-BE-011：成功登录即清零失败窗口；单独 try 避免清除失败影响成功记录返回
                try:
                    cls.reset_failed_attempts(username=username, user_id=user_id)
                except Exception as reset_error:
                    logger.error(f"清除失败尝试记录失败: {reset_error}")
                
            return attempt
        except Exception as e:
            logger.error(f"记录登录尝试失败: {e}")
            return None

    @classmethod
    def reset_failed_attempts(cls, username=None, user_id=None):
        """
        重置失败尝试计数（登录成功后调用）
        
        RISK-BE-011：旧实现只写日志、返回 None，失败记录仍留在 1 小时窗口里，
        「失败 4 次 → 成功登录 → 再失败 1 次」依旧会被锁 30 分钟。
        现在把匹配的失败记录标记为 is_reset=True（保留审计记录，不做物理删除），
        与 is_account_locked 的查询条件（is_reset__ne=True）保持一致。

        标识归一：views/mongo_auth.py 的失败分支用「用户输入的登录标识」（username 或
        email/phone）写入，成功分支用 MongoUser.username + user_id 写入；因此提供 user_id
        时会反查 username/email/phone，避免邮箱登录留下的失败记录清不掉。

        Args:
            username: 登录标识（username/email/phone 均可能）
            user_id: MongoUser 主键，用于反查该用户的其它登录标识

        Returns:
            int: 本次清除的失败记录条数；未提供任何标识时返回 0
        """
        names = cls._identity_usernames(username=username, user_id=user_id)
        if not names and not user_id:
            return 0

        identity_clauses = []
        if names:
            identity_clauses.append(Q(username__in=sorted(names)))
        if user_id:
            identity_clauses.append(Q(user_id=user_id))

        identity = identity_clauses[0]
        for clause in identity_clauses[1:]:
            identity = identity | clause

        modified = cls.objects(Q(success=False, is_reset__ne=True) & identity).update(
            set__is_reset=True
        )
        logger.info(
            f"用户登录成功，已清除失败尝试: username={username}, user_id={user_id}, cleared={modified}"
        )
        return modified

    @classmethod
    def _identity_usernames(cls, username=None, user_id=None):
        """把登录标识归一成一组 username 值（RISK-BE-011 的标识归一）。

        反查失败只告警、不阻塞按 username 重置。
        """
        names = set()
        if username:
            names.add(username)
        if user_id:
            try:
                import uuid as uuid_module

                from ..mongodb_models import User as MongoUser

                lookup_id = uuid_module.UUID(str(user_id)) if isinstance(user_id, str) else user_id
                mongo_user = MongoUser.objects(id=lookup_id).first()
                if mongo_user:
                    for value in (mongo_user.username, mongo_user.email, mongo_user.phone):
                        if value:
                            names.add(value)
            except Exception as exc:  # noqa: BLE001 - 反查失败不阻塞按 username 重置
                logger.warning(f"按 user_id 反查登录标识失败: user_id={user_id}, error={exc}")
        return names

    @classmethod
    def get_recent_attempts(cls, username=None, user_id=None, ip_address=None, limit=10):
        """
        获取最近的登录尝试记录
        
        Args:
            username: 用户名
            user_id: 用户ID
            ip_address: IP地址
            limit: 返回数量限制
            
        Returns:
            list: 登录尝试记录列表
        """
        query = {}
        if username:
            query['username'] = username
        if user_id:
            query['user_id'] = user_id
        if ip_address:
            query['ip_address'] = ip_address
            
        return list(cls.objects(**query).order_by('-timestamp').limit(limit))

    @classmethod
    def get_lockout_info(cls, username=None, ip_address=None):
        """
        获取锁定信息的友好格式
        
        Returns:
            dict: 包含锁定状态和详细信息
        """
        is_locked, remaining_seconds, failed_count = cls.is_account_locked(
            username=username, ip_address=ip_address
        )
        
        if is_locked:
            remaining_minutes = remaining_seconds // 60
            return {
                'locked': True,
                'remaining_seconds': remaining_seconds,
                'remaining_minutes': remaining_minutes,
                'failed_attempts': failed_count,
                'max_attempts': MAX_FAILED_ATTEMPTS,
                'message': f'账户已锁定，请在{remaining_minutes}分钟后重试'
            }
        else:
            attempts_remaining = MAX_FAILED_ATTEMPTS - failed_count
            return {
                'locked': False,
                'failed_attempts': failed_count,
                'attempts_remaining': attempts_remaining,
                'max_attempts': MAX_FAILED_ATTEMPTS,
                'message': None
            }

