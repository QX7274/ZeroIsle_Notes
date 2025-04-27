"""
异步任务处理
"""

from celery import Celery
from django.conf import settings
import logging
from functools import wraps
import time
from typing import Any, Callable

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