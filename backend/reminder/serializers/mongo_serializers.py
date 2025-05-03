"""
提醒MongoDB序列化器
"""

from rest_framework import serializers
from reminder.mongodb_models import Reminder, ReminderNotification
from django.utils import timezone
from datetime import timedelta

class MongoReminderSerializer(serializers.Serializer):
    """
    提醒MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=200, required=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    due_date = serializers.DateTimeField(required=True)
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES, default='medium')
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES, default='once')
    category = serializers.ChoiceField(choices=Reminder.CATEGORY_CHOICES, default='other', required=False)
    color = serializers.CharField(max_length=7, default='#3498db', required=False)
    tags = serializers.CharField(required=False, allow_blank=True, default='')
    is_completed = serializers.BooleanField(default=False)
    is_enabled = serializers.BooleanField(default=True)
    note = serializers.CharField(required=False, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True)
    repeat_end_date = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, data):
        """验证数据"""
        # 验证due_date
        due_date = data.get('due_date')
        if due_date and due_date < timezone.now():
            raise serializers.ValidationError({'due_date': '到期时间不能早于当前时间'})

        # 验证note
        note_id = data.get('note')
        if note_id:
            from notes.mongodb_models import Note
            note = Note.objects(id=note_id).first()
            if not note:
                raise serializers.ValidationError({'note': '笔记不存在'})
            data['note_obj'] = note

        return data

    def create(self, validated_data):
        """创建提醒"""
        user = self.context['request'].user
        note = validated_data.pop('note_obj', None) if 'note_obj' in validated_data else None
        validated_data.pop('note', None)

        # 创建提醒
        reminder = Reminder(
            user=user,
            note=note,
            **validated_data
        )
        reminder.save()

        # 创建通知
        self._create_notification(reminder)

        return reminder

    def update(self, instance, validated_data):
        """更新提醒"""
        # 处理note字段
        if 'note_obj' in validated_data:
            instance.note = validated_data.pop('note_obj')
            validated_data.pop('note', None)

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 如果更新了due_date或frequency，更新通知
        if 'due_date' in validated_data or 'frequency' in validated_data:
            # 删除旧的通知
            ReminderNotification.objects(reminder=instance, status='pending').delete()
            # 创建新的通知
            self._create_notification(instance)

        instance.save()
        return instance

    def _create_notification(self, reminder):
        """创建提醒通知"""
        # 只为未完成且启用的提醒创建通知
        if reminder.is_completed or not reminder.is_enabled:
            return

        # 创建通知
        notification = ReminderNotification(
            reminder=reminder,
            scheduled_time=reminder.due_date,
            status='pending'
        )
        notification.save()

    def to_representation(self, instance):
        """转换为表示形式"""
        data = {
            'id': str(instance.id),
            'user': str(instance.user.id),
            'title': instance.title,
            'description': instance.description or '',
            'due_date': instance.due_date,
            'priority': instance.priority,
            'frequency': instance.frequency,
            'category': getattr(instance, 'category', 'other'),
            'color': getattr(instance, 'color', '#3498db'),
            'tags': getattr(instance, 'tags', ''),
            'is_completed': instance.is_completed,
            'is_enabled': instance.is_enabled,
            'created_at': instance.created_at,
            'updated_at': instance.updated_at,
            'is_overdue': instance.is_overdue
        }

        # 添加note信息
        if instance.note:
            data['note'] = str(instance.note.id)
            data['note_title'] = instance.note.title
        else:
            data['note'] = None
            data['note_title'] = None

        # 添加完成时间
        if instance.completed_at:
            data['completed_at'] = instance.completed_at

        # 添加重复结束时间
        if hasattr(instance, 'repeat_end_date') and instance.repeat_end_date:
            data['repeat_end_date'] = instance.repeat_end_date

        # 添加下一次提醒时间
        next_occurrence = instance.get_next_occurrence()
        if next_occurrence:
            data['next_occurrence'] = next_occurrence

        # 添加优先级和频率的显示名称
        priority_display = dict(Reminder.PRIORITY_CHOICES).get(instance.priority, '')
        frequency_display = dict(Reminder.FREQUENCY_CHOICES).get(instance.frequency, '')
        category_display = dict(Reminder.CATEGORY_CHOICES).get(getattr(instance, 'category', 'other'), '')
        data['priority_display'] = priority_display
        data['frequency_display'] = frequency_display
        data['category_display'] = category_display

        # 添加标签列表
        if getattr(instance, 'tags', ''):
            data['tag_list'] = [tag.strip() for tag in instance.tags.split(',') if tag.strip()]
        else:
            data['tag_list'] = []

        # 添加剩余时间（以秒为单位）
        if not instance.is_completed and instance.due_date > timezone.now():
            data['time_remaining'] = int((instance.due_date - timezone.now()).total_seconds())
        else:
            data['time_remaining'] = 0

        return data

class MongoReminderNotificationSerializer(serializers.Serializer):
    """
    提醒通知MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    reminder = serializers.CharField(required=True)
    scheduled_time = serializers.DateTimeField(required=True)
    status = serializers.ChoiceField(choices=ReminderNotification.STATUS_CHOICES, default='pending')
    sent_time = serializers.DateTimeField(read_only=True)
    error_message = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def validate(self, data):
        """验证数据"""
        # 验证reminder
        reminder_id = data.get('reminder')
        reminder = Reminder.objects(id=reminder_id).first()
        if not reminder:
            raise serializers.ValidationError({'reminder': '提醒不存在'})
        data['reminder_obj'] = reminder

        return data

    def create(self, validated_data):
        """创建通知"""
        reminder = validated_data.pop('reminder_obj')
        validated_data.pop('reminder')

        # 创建通知
        notification = ReminderNotification(
            reminder=reminder,
            **validated_data
        )
        notification.save()
        return notification

    def update(self, instance, validated_data):
        """更新通知"""
        # 处理reminder字段
        if 'reminder_obj' in validated_data:
            instance.reminder = validated_data.pop('reminder_obj')
            validated_data.pop('reminder', None)

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 如果状态变为已发送，设置发送时间
        if 'status' in validated_data and validated_data['status'] == 'sent' and not instance.sent_time:
            instance.sent_time = timezone.now()

        instance.save()
        return instance

    def to_representation(self, instance):
        """转换为表示形式"""
        data = {
            'id': str(instance.id),
            'reminder': str(instance.reminder.id),
            'reminder_title': instance.reminder.title,
            'scheduled_time': instance.scheduled_time,
            'status': instance.status,
            'created_at': instance.created_at,
            'updated_at': instance.updated_at
        }

        # 添加发送时间
        if instance.sent_time:
            data['sent_time'] = instance.sent_time

        # 添加错误信息
        if instance.error_message:
            data['error_message'] = instance.error_message

        # 添加状态显示名称
        status_display = dict(ReminderNotification.STATUS_CHOICES).get(instance.status, '')
        data['status_display'] = status_display

        return data
