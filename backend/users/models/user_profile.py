"""
用户资料模型
"""

from django.db import models
from django.conf import settings

class UserProfile(models.Model):
    """
    用户资料模型
    存储用户的扩展资料信息
    """
    GENDER_CHOICES = (
        ('male', '男'),
        ('female', '女'),
        ('other', '其他'),
        ('unknown', '未知'),
    )
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name='用户'
    )
    nickname = models.CharField(max_length=50, blank=True, verbose_name='昵称')
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='unknown', verbose_name='性别')
    birthday = models.DateField(blank=True, null=True, verbose_name='生日')
    location = models.CharField(max_length=100, blank=True, verbose_name='位置')
    website = models.URLField(blank=True, verbose_name='个人网站')
    company = models.CharField(max_length=100, blank=True, verbose_name='公司')
    position = models.CharField(max_length=100, blank=True, verbose_name='职位')
    bio_extended = models.TextField(blank=True, verbose_name='扩展简介')
    social_links = models.JSONField(default=dict, blank=True, verbose_name='社交链接')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '用户资料'
        verbose_name_plural = '用户资料'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.user} 的资料"
    
    @property
    def age(self):
        """计算用户年龄"""
        from datetime import date
        if not self.birthday:
            return None
        today = date.today()
        return today.year - self.birthday.year - ((today.month, today.day) < (self.birthday.month, self.birthday.day))
