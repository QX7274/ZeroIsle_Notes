"""
说话人模型
"""

import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Speaker(models.Model):
    """
    说话人模型
    存储说话人信息
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='speakers',
        verbose_name='用户'
    )
    name = models.CharField(max_length=100, verbose_name='名称')
    display_name = models.CharField(max_length=100, blank=True, null=True, verbose_name='显示名称')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    voice_profile = models.JSONField(default=dict, blank=True, verbose_name='声音特征')
    external_id = models.CharField(max_length=100, blank=True, null=True, verbose_name='外部ID')
    avatar = models.CharField(max_length=255, blank=True, null=True, verbose_name='头像URL')

    # 关联到MongoDB中的SpeakerProfile
    profile_id = models.UUIDField(blank=True, null=True, verbose_name='档案ID')

    # 统计信息
    recognition_count = models.IntegerField(default=0, verbose_name='识别次数')
    total_speaking_time = models.FloatField(default=0.0, verbose_name='总发言时长(秒)')

    # 状态
    is_favorite = models.BooleanField(default=False, verbose_name='是否收藏')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '说话人'
        verbose_name_plural = '说话人'
        ordering = ['-is_favorite', 'name']
        unique_together = ('user', 'name')

    def __str__(self):
        return self.display_name or self.name

    def update_stats(self, speaking_time=0.0):
        """更新统计信息"""
        self.recognition_count += 1
        self.total_speaking_time += speaking_time
        self.updated_at = timezone.now()
        self.save()

        return self

    def get_profile(self):
        """获取说话人档案"""
        if not self.profile_id:
            return None

        try:
            from voice_recognition.models.speaker_profile import SpeakerProfile
            return SpeakerProfile.objects.get(id=self.profile_id)
        except Exception:
            return None
