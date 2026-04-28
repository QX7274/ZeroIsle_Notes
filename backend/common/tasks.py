"""
异步任务处理
"""

from celery import Celery
from django.conf import settings
import logging
from functools import wraps
import time
from typing import Any, Callable
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

# 创建Celery实例
app = Celery('backend')

# 使用Django的配置文件
app.config_from_object('django.conf:settings', namespace='CELERY')

# 自动发现任务
app.autodiscover_tasks()

def async_task(*args, **kwargs):
    """
    异步任务装饰器
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # 记录任务开始时间
            start_time = time.time()

            try:
                # 执行任务
                result = func(*args, **kwargs)

                # 记录任务完成时间
                duration = time.time() - start_time
                logger.info(f"任务 {func.__name__} 完成，耗时: {duration:.2f}秒")

                return result
            except Exception as e:
                # 记录错误
                logger.error(f"任务 {func.__name__} 失败: {str(e)}")
                raise
        return wrapper
    return decorator

class TaskManager:
    """
    任务管理器
    """
    def __init__(self):
        self.app = app

    def delay(self, task_name: str, *args, **kwargs) -> Any:
        """
        延迟执行任务
        """
        try:
            task = self.app.tasks[task_name]
            return task.delay(*args, **kwargs)
        except KeyError:
            logger.error(f"任务 {task_name} 不存在")
            raise

    def apply_async(self, task_name: str, args=None, kwargs=None, **options) -> Any:
        """
        异步执行任务
        """
        try:
            task = self.app.tasks[task_name]
            return task.apply_async(args=args, kwargs=kwargs, **options)
        except KeyError:
            logger.error(f"任务 {task_name} 不存在")
            raise

    def revoke(self, task_id: str, terminate: bool = False) -> None:
        """
        撤销任务
        """
        self.app.control.revoke(task_id, terminate=terminate)

    def get_task_status(self, task_id: str) -> dict:
        """
        获取任务状态
        """
        task = self.app.AsyncResult(task_id)
        return {
            'task_id': task_id,
            'status': task.status,
            'result': task.result if task.successful() else None,
            'error': str(task.result) if task.failed() else None
        }

    def get_active_tasks(self) -> list:
        """
        获取活动任务列表
        """
        inspector = self.app.control.inspect()
        active = inspector.active()
        return active if active else []

# 创建任务管理器实例
task_manager = TaskManager()

# 示例任务
@app.task(name='send_email')
@async_task
def send_email(to: str, subject: str, body: str) -> bool:
    """
    发送邮件任务
    """
    from django.core.mail import send_mail
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to],
            fail_silently=False
        )
        return True
    except Exception as e:
        logger.error(f"发送邮件失败: {str(e)}")
        return False

@app.task(name='process_data')
@async_task
def process_data(data: dict) -> dict:
    """
    处理数据任务
    """
    try:
        # 模拟数据处理
        time.sleep(2)
        return {'status': 'success', 'data': data}
    except Exception as e:
        logger.error(f"数据处理失败: {str(e)}")
        return {'status': 'error', 'message': str(e)}

@app.task(name='send_notification')
@async_task
def send_notification(user_id: str, title: str, message: str, notification_type: str = 'system', sender_id: str = None, related_object: dict = None, extra_data: dict = None) -> dict:
    """
    定时/即时发送站内通知任务
    - 在任务触发时创建通知记录；如需扩展多通道（邮件/短信/WS），可在此处继续分发
    Args:
        user_id: 接收者用户ID（字符串）
        title: 标题
        message: 内容
        notification_type: 通知类型
        sender_id: 发送者用户ID（可选）
        related_object: 关联对象（预留，当前未直接使用）
        extra_data: 额外数据（可选），当前策略为直接拼接到消息末尾（简化实现）
    Returns:
        dict: { 'notification_id': str, 'status': 'sent' }
    """
    try:
        # 延迟导入，避免循环依赖
        from users.mongodb_models import User
        from notification.services import NotificationService

        recipient = User.objects.get(id=user_id)
        sender = None
        if sender_id:
            try:
                sender = User.objects.get(id=sender_id)
            except Exception:
                sender = None

        # 合并额外数据（简单策略：附加到 message 文本中）
        if extra_data:
            try:
                import json
                message = f"{message}\n\n{json.dumps(extra_data, ensure_ascii=False)}"
            except Exception:
                pass

        svc = NotificationService()
        notification = svc.create_notification(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            sender=sender,
            related_object=None
        )
        # 标记已发送
        try:
            notification.mark_as_sent()
        except Exception:
            pass

        # WebSocket 推送（非阻塞主通知流程，失败只记录日志）
        ws_push_status = 'skipped'
        try:
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                payload = {
                    'id': str(notification.id),
                    'user_id': str(user_id),
                    'title': title,
                    'message': message,
                    'notification_type': notification_type,
                    'sender_id': str(sender_id) if sender_id else None,
                    'created_at': str(getattr(notification, 'created_at', '')),
                    'is_read': bool(getattr(notification, 'is_read', False))
                }
                async_to_sync(channel_layer.group_send)(
                    f'user_notifications_{user_id}',
                    {
                        'type': 'notification_message',
                        'message': payload
                    }
                )
                ws_push_status = 'sent'
            else:
                logger.warning('WebSocket推送跳过：channel_layer 不可用')
        except Exception as ws_error:
            ws_push_status = 'failed'
            logger.error(f"WebSocket推送失败(notification_id={notification.id}, user_id={user_id}): {str(ws_error)}")

        return { 'notification_id': str(notification.id), 'status': 'sent', 'ws_push': ws_push_status }
    except Exception as e:
        logger.error(f"发送通知任务失败: {str(e)}")
        return { 'status': 'error', 'error': str(e) }
