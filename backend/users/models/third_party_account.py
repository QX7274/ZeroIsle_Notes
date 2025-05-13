"""
第三方账号模型
"""

from mongoengine import Document, StringField, DateTimeField, DictField, ReferenceField
from django.utils import timezone
from ..mongodb_models import User

class ThirdPartyAccount(Document):
    """
    第三方账号模型
    用于存储用户的第三方账号信息
    """
    PROVIDER_CHOICES = (
        ('wechat', '微信'),
        ('qq', 'QQ'),
        ('weibo', '微博'),
        ('github', 'GitHub'),
        ('google', 'Google'),
        ('apple', 'Apple'),
    )

    user = ReferenceField(User, required=True, verbose_name='用户')
    provider = StringField(max_length=20, choices=PROVIDER_CHOICES, required=True, verbose_name='提供商')
    uid = StringField(max_length=255, required=True, verbose_name='第三方用户ID')
    access_token = StringField(max_length=255, required=False, verbose_name='访问令牌')
    refresh_token = StringField(max_length=255, required=False, verbose_name='刷新令牌')
    expires_at = DateTimeField(required=False, verbose_name='过期时间')
    extra_data = DictField(default={}, verbose_name='额外数据')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'third_party_accounts',
        'ordering': ['-created_at'],
        'indexes': [
            {'fields': ['user', 'provider']},
            {'fields': ['provider', 'uid'], 'unique': True},
        ],
        'verbose_name': '第三方账号',
        'verbose_name_plural': '第三方账号'
    }

    def __str__(self):
        provider_display = dict(self.PROVIDER_CHOICES).get(self.provider, self.provider)
        return f"{self.user.username} - {provider_display}"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(ThirdPartyAccount, self).save(*args, **kwargs)
