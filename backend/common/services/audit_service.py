"""
通用审计服务
"""

from ..mongodb_models import AuditLog

class AuditService:
    """
    提供创建审计日志的通用方法。
    """

    @staticmethod
    def log_action(
        user,
        action: str,
        target_object,
        details: dict = None,
        request=None
    ):
        """
        记录一个审计事件。

        Args:
            user: 执行操作的用户对象。
            action (str): 操作的唯一标识符 (e.g., 'reminder_completed')。
            target_object: 被操作的模型实例 (e.g., a Reminder instance)。
            details (dict, optional): 包含操作细节的字典。
            request (HttpRequest, optional): 当前的HTTP请求对象，用于获取IP和User-Agent。
        """
        try:
            ip_address = None
            user_agent = None
            if request:
                from common.utils import get_client_ip
                ip_address = get_client_ip(request)
                user_agent = request.META.get('HTTP_USER_AGENT', '')

            AuditLog.objects.create(
                user_id=str(user.id),
                action=action,
                target_model=target_object.__class__.__name__,
                target_id=str(target_object.id),
                details=details or {},
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as e:
            # 审计日志失败不应阻塞主流程，只记录错误
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create audit log: {e}", exc_info=True)
