from datetime import datetime, timedelta
from mongoengine.queryset.visitor import Q
from reminder.mongodb_models import Reminder
from users.mongodb_models import User
from notification.services import NotificationService

class ReminderService:
    def __init__(self):
        self.notification_service = NotificationService()

    def get_upcoming_reviews(self, user_id):
        """获取即将需要复习的提醒"""
        now = datetime.now()
        # 获取未来24小时内需要复习的提醒
        upcoming_reviews = Reminder.objects.filter(
            Q(user_id=user_id) &
            Q(review_time__lte=now + timedelta(days=1)) &
            Q(review_time__gte=now) &
            Q(is_completed=False)
        ).order_by('review_time')
        return upcoming_reviews

    def schedule_review_notification(self, reminder):
        """安排复习通知"""
        self.notification_service.schedule_notification(
            user_id=reminder.user_id,
            title="复习提醒",
            message=f"该复习 {reminder.title} 了",
            scheduled_time=reminder.review_time,
            data={
                "type": "review",
                "reminder_id": reminder.id
            }
        )

    def update_review_schedule(self, reminder):
        """更新复习计划"""
        if reminder.review_interval:
            reminder.review_time = datetime.now() + timedelta(days=reminder.review_interval)
            reminder.save()
            self.schedule_review_notification(reminder)

    def mark_as_reviewed(self, reminder_id):
        """标记为已复习"""
        try:
            reminder = Reminder.objects.get(id=reminder_id)
            reminder.last_reviewed = datetime.now()
            reminder.review_count += 1
            reminder.save()
            self.update_review_schedule(reminder)
            return True
        except Reminder.DoesNotExist:
            return False

    def get_review_statistics(self, user_id):
        """获取复习统计数据"""
        total_reviews = Reminder.objects.filter(user_id=user_id).count()
        completed_reviews = Reminder.objects.filter(
            user_id=user_id,
            is_completed=True
        ).count()
        upcoming_reviews = self.get_upcoming_reviews(user_id).count()

        return {
            "total": total_reviews,
            "completed": completed_reviews,
            "upcoming": upcoming_reviews,
            "completion_rate": (completed_reviews / total_reviews * 100) if total_reviews > 0 else 0
        }

    def _get_or_create_exception(self, reminder, target_date):
        """查找或创建给定日期的例外记录"""
        from .mongodb_models import ReminderException
        # 精确到天进行比较
        for ex in reminder.exceptions:
            if ex.original_occurrence_date.date() == target_date.date():
                return ex
        
        # 如果没找到，创建一个新的
        new_exception = ReminderException(original_occurrence_date=target_date)
        reminder.exceptions.append(new_exception)
        return new_exception

    def complete_reminder(self, user, reminder_id, scope='this_instance', completion_date=None, request=None):
        """完成提醒（重构版）"""
        from .mongodb_models import Reminder
        from common.services.audit_service import AuditService

        reminder = Reminder.objects.get(id=reminder_id, user=user)
        action_details = {'scope': scope}

        if reminder.frequency != 'once' and scope == 'this_instance':
            if not completion_date:
                raise ValueError("对于重复提醒的单次操作，必须提供completion_date")
            action_details['completion_date'] = completion_date.isoformat()
            
            exception = self._get_or_create_exception(reminder, completion_date)
            exception.status = 'completed'
            exception.new_due_date = None # 完成操作清除延期
        else:
            reminder.is_completed = True
            reminder.completed_at = datetime.now()
        
        reminder.save()
        AuditService.log_action(user, 'reminder_completed', reminder, details=action_details, request=request)
        return reminder

    def cancel_reminder(self, user, reminder_id, scope='this_instance', cancellation_date=None, request=None):
        """取消提醒（重构版）"""
        from .mongodb_models import Reminder
        from common.services.audit_service import AuditService

        reminder = Reminder.objects.get(id=reminder_id, user=user)
        action_details = {'scope': scope, 'reason': 'user_cancelled'}

        if reminder.frequency != 'once' and scope == 'this_instance':
            if not cancellation_date:
                raise ValueError("对于重复提醒的单次操作，必须提供cancellation_date")
            action_details['cancellation_date'] = cancellation_date.isoformat()

            exception = self._get_or_create_exception(reminder, cancellation_date)
            exception.status = 'cancelled'
        else:
            reminder.is_enabled = False
        
        reminder.save()
        AuditService.log_action(user, 'reminder_cancelled', reminder, details=action_details, request=request)
        return reminder

    def delay_reminder(self, user, reminder_id, new_due_date, scope='this_instance', original_due_date=None, request=None):
        """延期提醒（重构版）"""
        from .mongodb_models import Reminder
        from common.services.audit_service import AuditService

        reminder = Reminder.objects.get(id=reminder_id, user=user)
        action_details = {'scope': scope, 'new_due_date': new_due_date.isoformat()}

        if reminder.frequency != 'once' and scope == 'this_instance':
            if not original_due_date:
                raise ValueError("对于重复提醒的延期操作，必须提供original_due_date")
            action_details['original_due_date'] = original_due_date.isoformat()

            exception = self._get_or_create_exception(reminder, original_due_date)
            exception.status = 'rescheduled'
            exception.new_due_date = new_due_date
        else:
            reminder.due_date = new_due_date
        
        reminder.save()
        AuditService.log_action(user, 'reminder_delayed', reminder, details=action_details, request=request)
        return reminder