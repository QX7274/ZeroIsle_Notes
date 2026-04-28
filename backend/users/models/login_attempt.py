"""
登录尝试模型
用于记录用户登录尝试，防止暴力破解
"""

from mongoengine import Document, StringField, BooleanField, DateTimeField
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

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
        
        # 构建查询条件
        query = {'success': False, 'timestamp__gte': window_start}
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
            if last_attempt:
                lockout_end = last_attempt.timestamp + LOCKOUT_DURATION
                if now < lockout_end:
                    remaining = (lockout_end - now).total_seconds()
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
                
            return attempt
        except Exception as e:
            logger.error(f"记录登录尝试失败: {e}")
            return None

    @classmethod
    def reset_failed_attempts(cls, username=None, user_id=None):
        """
        重置失败尝试计数（登录成功后调用）
        
        注意：这里不删除记录，只是用于日志和审计
        实际的锁定检查基于时间窗口内的失败次数
        """
        logger.info(f"用户登录成功，重置锁定状态: username={username}, user_id={user_id}")

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

