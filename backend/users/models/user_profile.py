"""
用户资料模型
"""

from mongoengine import Document, StringField, DateTimeField, DateField, URLField, DictField, ReferenceField
from django.utils import timezone
from ..mongodb_models import User

class UserProfile(Document):
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

    user = ReferenceField(User, required=True, unique=True, verbose_name='用户')
    nickname = StringField(max_length=50, required=False, verbose_name='昵称')
    gender = StringField(max_length=10, choices=GENDER_CHOICES, default='unknown', verbose_name='性别')
    birthday = DateField(required=False, verbose_name='生日')
    location = StringField(max_length=100, required=False, verbose_name='位置')
    website = URLField(required=False, verbose_name='个人网站')
    company = StringField(max_length=100, required=False, verbose_name='公司')
    position = StringField(max_length=100, required=False, verbose_name='职位')
    bio_extended = StringField(required=False, verbose_name='扩展简介')
    social_links = DictField(default={}, verbose_name='社交链接')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'user_profiles',
        'ordering': ['-updated_at'],
        'indexes': [
            'user',
            'created_at',
            'updated_at'
        ],
        'verbose_name': '用户资料',
        'verbose_name_plural': '用户资料'
    }

    def __str__(self):
        return f"{self.user.username} 的资料"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(UserProfile, self).save(*args, **kwargs)

    @property
    def age(self):
        """计算用户年龄"""
        from datetime import date
        if not self.birthday:
            return None
        today = date.today()
        return today.year - self.birthday.year - ((today.month, today.day) < (self.birthday.month, self.birthday.day))
