"""
提醒模型
"""

import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Reminder(models.Model):
    """提醒模型"""
    PRIORITY_CHOICES = (
        ('low', _('低')),
        ('medium', _('中')),
        ('high', _('高')),
    )
    
    FREQUENCY_CHOICES = (
        ('once', _('一次')),
        ('daily', _('每天')),
        ('weekly', _('每周')),
        ('monthly', _('每月')),
        ('yearly', _('每年')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reminders', verbose_name=_('用户'))
    title = models.CharField(_('标题'), max_length=200)
    description = models.TextField(_('描述'), blank=True, null=True)
    due_date = models.DateTimeField(_('到期时间'))
    priority = models.CharField(_('优先级'), max_length=10, choices=PRIORITY_CHOICES, default='medium')
    frequency = models.CharField(_('频率'), max_length=10, choices=FREQUENCY_CHOICES, default='once')
    is_completed = models.BooleanField(_('是否完成'), default=False)
    is_enabled = models.BooleanField(_('是否启用'), default=True)
    note = models.ForeignKey('notes.Note', on_delete=models.SET_NULL, related_name='reminders', null=True, blank=True, verbose_name=_('关联笔记'))
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('提醒')
        verbose_name_plural = _('提醒')
        ordering = ['due_date', '-priority']
    
    def __str__(self):
        return self.title
    
    @property
    def is_overdue(self):
        """是否已过期"""
        return self.due_date < timezone.now() and not self.is_completed
    
    def get_next_occurrence(self):
        """获取下一次提醒时间"""
        if self.is_completed or not self.is_enabled:
            return None
        
        if self.frequency == 'once':
            return self.due_date
        
        now = timezone.now()
        if self.due_date > now:
            return self.due_date
        
        # 计算下一次提醒时间
        if self.frequency == 'daily':
            days = 1
        elif self.frequency == 'weekly':
            days = 7
        elif self.frequency == 'monthly':
            days = 30
        elif self.frequency == 'yearly':
            days = 365
        else:
            return None
        
        # 计算从原始到期日到现在经过了多少个周期
        delta = now - self.due_date
        cycles = delta.days // days + 1
        
        # 计算下一次提醒时间
        from datetime import timedelta
        next_date = self.due_date + timedelta(days=cycles * days)
        
        return next_date
