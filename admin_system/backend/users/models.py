from mongoengine import Document, StringField, EmailField, URLField, DateTimeField, BooleanField, DictField, ListField, ReferenceField, UUIDField, IntField
from django.utils import timezone
import uuid

class UserProfile(Document):
    """用户资料 - 对应主软件的用户模型"""
    USER_STATUS_CHOICES = (
        ('active', '活跃'),
        ('inactive', '未激活'),
        ('banned', '已禁用'),
    )

    id = UUIDField(primary_key=True, default=uuid.uuid4, binary=False)
    username = StringField(max_length=150, unique=True, required=True, verbose_name='用户名')
    email = EmailField(unique=True, sparse=True, verbose_name='邮箱')
    phone = StringField(max_length=20, unique=True, sparse=True, verbose_name='手机号')
    nickname = StringField(max_length=50, verbose_name='昵称')
    avatar = URLField(verbose_name='头像URL')
    bio = StringField(verbose_name='个人简介')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    is_staff = BooleanField(default=False, verbose_name='是否管理员')
    status = StringField(choices=USER_STATUS_CHOICES, default='active', verbose_name='状态')
    preferences = DictField(verbose_name='用户偏好设置')
    wechat_id = StringField(max_length=100, unique=True, sparse=True, verbose_name='微信ID')
    qq_id = StringField(max_length=100, unique=True, sparse=True, verbose_name='QQ ID')
    date_joined = DateTimeField(default=timezone.now, verbose_name='注册时间')
    last_login = DateTimeField(verbose_name='最后登录时间')

    # 统计字段
    note_count = IntField(default=0, verbose_name='笔记数量')
    canvas_count = IntField(default=0, verbose_name='画布数量')
    login_count = IntField(default=0, verbose_name='登录次数')

    # 密码重置相关字段
    password_reset_at = DateTimeField(verbose_name='密码重置时间')
    password_reset_by = StringField(max_length=150, verbose_name='密码重置管理员')

    meta = {
        'collection': 'users',  # 对应主软件的用户集合
        'ordering': ['-date_joined'],
        'indexes': [
            'username',
            'email',
            'phone',
            'is_active',
            'status',
            'date_joined',
            'last_login'
        ],
        'verbose_name': '用户资料',
        'verbose_name_plural': '用户资料'
    }

    def __str__(self):
        return self.username or self.email or str(self.id)

    @property
    def full_name(self):
        return self.nickname or self.username

    @property
    def is_banned(self):
        return self.status == 'banned' or not self.is_active

class UserActivity(Document):
    """用户活动记录"""
    user = ReferenceField(UserProfile, required=True, verbose_name='用户')
    activity_type = StringField(required=True, verbose_name='活动类型')
    description = StringField(verbose_name='活动描述')
    ip_address = StringField(verbose_name='IP地址')
    user_agent = StringField(verbose_name='用户代理')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'user_activities',
        'ordering': ['-created_at'],
        'indexes': [
            'user',
            'activity_type',
            'created_at'
        ],
        'verbose_name': '用户活动',
        'verbose_name_plural': '用户活动'
    }

    def __str__(self):
        return f"{self.user.username} - {self.activity_type} - {self.created_at}"

class VerificationCode(Document):
    """验证码"""
    PURPOSE_CHOICES = (
        ('register', '注册'),
        ('login', '登录'),
        ('reset_password', '重置密码'),
        ('change_phone', '变更手机号'),
        ('change_email', '变更邮箱'),
    )

    user = ReferenceField(UserProfile, required=False, verbose_name='用户')
    email = EmailField(sparse=True, verbose_name='邮箱')
    phone = StringField(max_length=20, sparse=True, verbose_name='手机号')
    code = StringField(max_length=10, required=True, verbose_name='验证码')
    purpose = StringField(choices=PURPOSE_CHOICES, required=True, verbose_name='用途')
    expires_at = DateTimeField(required=True, verbose_name='过期时间')
    is_used = BooleanField(default=False, verbose_name='是否已使用')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    created_by = StringField(max_length=150, verbose_name='创建者')

    meta = {
        'collection': 'verification_codes',
        'ordering': ['-created_at'],
        'indexes': [
            'user',
            'email',
            'phone',
            'code',
            'purpose',
            'expires_at',
            'is_used',
            'created_at'
        ],
        'verbose_name': '验证码',
        'verbose_name_plural': '验证码'
    }

    def __str__(self):
        return f"{self.code} - {self.purpose} - {self.created_at}"
