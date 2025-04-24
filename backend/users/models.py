from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError

class User(AbstractUser):
    email = models.EmailField(_('email address'), unique=True)
    phone = models.CharField(_('phone number'), max_length=20, blank=True, null=True, unique=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def clean(self):
        # 确保至少提供了手机号或邮箱
        if not self.email and not self.phone:
            raise ValidationError(_('Must provide either email or phone number'))

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')

    def __str__(self):
        return self.email

class VerificationCode(models.Model):
    PURPOSE_CHOICES = (
        ('login', '登录'),
        ('reset_password', '重置密码'),
        ('change_phone', '变更手机号'),
    )

    phone = models.CharField(max_length=11, verbose_name='手机号')
    code = models.CharField(max_length=6, verbose_name='验证码')
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default='login', verbose_name='用途')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    expires_at = models.DateTimeField(verbose_name='过期时间')
    is_used = models.BooleanField(default=False, verbose_name='是否已使用')

    class Meta:
        verbose_name = '验证码'
        verbose_name_plural = verbose_name

class ThirdPartyAccount(models.Model):
    PROVIDER_CHOICES = (
        ('wechat', '微信'),
        ('qq', 'QQ'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='third_party_accounts')
    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES, verbose_name='第三方平台')
    openid = models.CharField(max_length=100, verbose_name='第三方平台用户ID')
    nickname = models.CharField(max_length=50, blank=True, null=True, verbose_name='昵称')
    avatar = models.URLField(blank=True, null=True, verbose_name='头像')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '第三方账号'
        verbose_name_plural = verbose_name
        unique_together = ('provider', 'openid')