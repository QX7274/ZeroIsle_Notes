"""
验证码模型
"""

from mongoengine import Document, StringField, EmailField, DateTimeField, BooleanField
from django.utils import timezone
from datetime import timedelta
import random

class VerificationCode(Document):
    """
    验证码模型
    用于手机验证码、邮箱验证码等
    """
    PURPOSE_CHOICES = (
        ('register', '注册'),
        ('login', '登录'),
        ('reset_password', '重置密码'),
        ('change_phone', '变更手机号'),
        ('change_email', '变更邮箱'),
    )

    phone = StringField(max_length=20, required=False, sparse=True, verbose_name='手机号')
    email = EmailField(required=False, sparse=True, verbose_name='邮箱')
    code = StringField(max_length=6, required=True, verbose_name='验证码')
    purpose = StringField(max_length=20, choices=PURPOSE_CHOICES, default='login', verbose_name='用途')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    expires_at = DateTimeField(required=True, verbose_name='过期时间')
    is_used = BooleanField(default=False, verbose_name='是否已使用')

    meta = {
        'collection': 'verification_codes',
        'ordering': ['-created_at'],
        'indexes': [
            {'fields': ['phone', 'is_used']},
            {'fields': ['email', 'is_used']},
            {'fields': ['code', 'purpose']},
            {'fields': ['expires_at']}
        ],
        'verbose_name': '验证码',
        'verbose_name_plural': '验证码'
    }

    def __str__(self):
        return f"{self.phone or self.email} - {self.code}"

    def save(self, *args, **kwargs):
        """保存前设置过期时间和生成验证码"""
        if not self.expires_at:
            # 默认15分钟过期
            self.expires_at = timezone.now() + timedelta(minutes=15)

        if not self.code:
            # 生成6位随机数字验证码
            self.code = ''.join(random.choices('0123456789', k=6))

        return super(VerificationCode, self).save(*args, **kwargs)

    @property
    def is_expired(self):
        """检查验证码是否已过期"""
        return timezone.now() > self.expires_at

    @classmethod
    def generate_code(cls, phone=None, email=None, purpose='login'):
        """
        生成新的验证码

        Args:
            phone: 手机号
            email: 邮箱
            purpose: 用途

        Returns:
            VerificationCode: 验证码对象
        """
        if not phone and not email:
            raise ValueError("必须提供手机号或邮箱")

        # 创建新验证码
        verification_code = cls(
            phone=phone,
            email=email,
            purpose=purpose
        )
        verification_code.save()

        return verification_code

    @classmethod
    def verify(cls, code, phone=None, email=None, purpose='login'):
        """
        验证验证码

        Args:
            code: 验证码
            phone: 手机号
            email: 邮箱
            purpose: 用途

        Returns:
            bool: 验证结果
        """
        if not phone and not email:
            return False

        # 查询验证码
        query = {
            'code': code,
            'purpose': purpose,
            'is_used': False
        }

        if phone:
            query['phone'] = phone
        else:
            query['email'] = email

        try:
            verification_code = cls.objects.get(**query)

            # 检查是否过期
            if verification_code.is_expired:
                return False

            # 标记为已使用
            verification_code.is_used = True
            verification_code.save()

            return True
        except cls.DoesNotExist:
            return False
