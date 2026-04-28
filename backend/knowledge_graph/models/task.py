"""
知识图谱任务模型
用于追踪构建、导入、导出等长时间运行的任务
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class KGTask(models.Model):
    """知识图谱任务模型"""
    
    TASK_TYPE_CHOICES = [
        ('build', '构建'),
        ('import', '导入'),
        ('export', '导出'),
        ('analyze', '分析'),
    ]
    
    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('running', '运行中'),
        ('success', '成功'),
        ('failed', '失败'),
        ('partial', '部分成功'),
    ]
    
    # 基本信息
    task_id = models.CharField(
        max_length=36,
        unique=True,
        primary_key=True,
        default=uuid.uuid4,
        help_text="任务唯一标识符"
    )
    task_type = models.CharField(
        max_length=20,
        choices=TASK_TYPE_CHOICES,
        help_text="任务类型"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="任务状态"
    )
    
    # 进度信息
    progress = models.IntegerField(
        default=0,
        help_text="进度百分比 (0-100)"
    )
    
    # 用户信息
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        help_text="执行任务的用户"
    )
    
    # 统计信息
    stats = models.JSONField(
        default=dict,
        help_text="任务统计信息 {nodes_added, edges_added, skipped, conflicts}"
    )
    
    # 错误信息
    errors = models.JSONField(
        default=list,
        help_text="任务错误列表 [{line, msg}]"
    )
    
    # 时间戳
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="创建时间"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="更新时间"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="完成时间"
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['task_type']),
        ]
        verbose_name = "知识图谱任务"
        verbose_name_plural = "知识图谱任务"
    
    def __str__(self):
        return f"{self.get_task_type_display()}:{self.task_id}"
    
    def mark_completed(self, status='success', stats=None, errors=None):
        """标记任务完成"""
        self.status = status
        self.progress = 100 if status == 'success' else self.progress
        self.completed_at = timezone.now()
        
        if stats:
            self.stats = stats
        if errors:
            self.errors = errors
        
        self.save()
    
    def update_progress(self, progress, stats=None):
        """更新任务进度"""
        self.progress = min(progress, 100)
        if stats:
            self.stats = stats
        self.save()
    
    def add_error(self, line=None, msg=None):
        """添加错误信息"""
        if not self.errors:
            self.errors = []
        
        self.errors.append({
            'line': line,
            'msg': msg,
            'timestamp': timezone.now().isoformat()
        })
        self.save()

