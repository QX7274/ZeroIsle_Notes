from datetime import datetime, timedelta
from django.db.models import Q
from reminder.models import Reminder
from users.models import User
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