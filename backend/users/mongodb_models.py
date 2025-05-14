"""
用户模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, EmailField, DateTimeField, BooleanField
from mongoengine import UUIDField, URLField, DictField, ListField, ReferenceField, IntField
from django.utils import timezone
import uuid

class User(Document):
    """
    用户文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='用户ID')
    username = StringField(max_length=150, required=True, unique=True, verbose_name='用户名')
    email = EmailField(sparse=True, required=False, verbose_name='邮箱地址')
    phone = StringField(max_length=20, sparse=True, verbose_name='手机号')
    password = StringField(required=True, verbose_name='密码哈希')
    first_name = StringField(max_length=30, default='', verbose_name='名')
    last_name = StringField(max_length=150, default='', verbose_name='姓')
    nickname = StringField(max_length=50, default='', verbose_name='昵称')
    avatar = URLField(verbose_name='头像URL')
    bio = StringField(max_length=500, verbose_name='个人简介')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    is_staff = BooleanField(default=False, verbose_name='是否员工')
    is_superuser = BooleanField(default=False, verbose_name='是否超级用户')
    is_verified = BooleanField(default=False, verbose_name='是否验证')
    last_login = DateTimeField(verbose_name='最后登录时间')
    last_login_ip = StringField(max_length=100, verbose_name='最后登录IP')
    date_joined = DateTimeField(default=timezone.now, verbose_name='注册时间')

    # 第三方登录相关字段
    wechat_openid = StringField(max_length=100, sparse=True, verbose_name='微信OpenID')
    wechat_unionid = StringField(max_length=100, verbose_name='微信UnionID')
    wechat_avatar = URLField(verbose_name='微信头像URL')
    qq_openid = StringField(max_length=100, sparse=True, verbose_name='QQ OpenID')
    qq_avatar = URLField(verbose_name='QQ头像URL')

    # 用户偏好设置
    preferences = DictField(verbose_name='偏好设置')

    # MongoDB Realm相关字段
    realm_id = StringField(max_length=100, sparse=True, verbose_name='Realm ID')
    realm_api_key = StringField(max_length=100, sparse=True, verbose_name='Realm API Key')
    realm_app_id = StringField(max_length=100, sparse=True, verbose_name='Realm App ID')
    realm_sync_enabled = BooleanField(default=True, verbose_name='是否启用Realm同步')
    realm_last_sync_time = DateTimeField(verbose_name='最后同步时间')

    # 统计字段
    note_count = IntField(default=0, verbose_name='笔记数量')
    canvas_count = IntField(default=0, verbose_name='画布数量')
    login_count = IntField(default=0, verbose_name='登录次数')

    meta = {
        'collection': 'users',
        'indexes': [
            {'fields': ['username'], 'unique': True},
            {'fields': ['email'], 'sparse': True},
            {'fields': ['phone'], 'sparse': True},
            {'fields': ['wechat_openid'], 'sparse': True},
            {'fields': ['qq_openid'], 'sparse': True},
            {'fields': ['realm_id'], 'sparse': True},
            {'fields': ['is_active']},
            {'fields': ['date_joined']},
        ],
        'ordering': ['-date_joined']
    }

    def __str__(self):
        return self.username

    def get_full_name(self):
        """获取用户全名"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username

    def get_short_name(self):
        """获取用户简称"""
        return self.first_name or self.username

    def check_password(self, raw_password):
        """验证密码"""
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password)

class VerificationCode(Document):
    """
    验证码文档模型
    """
    user = ReferenceField(User, required=False, verbose_name='用户')
    email = EmailField(sparse=True, verbose_name='邮箱地址')
    phone = StringField(max_length=20, sparse=True, verbose_name='手机号')
    code = StringField(max_length=10, required=True, verbose_name='验证码')
    purpose = StringField(max_length=20, required=True, verbose_name='用途')
    expires_at = DateTimeField(required=True, verbose_name='过期时间')
    is_used = BooleanField(default=False, verbose_name='是否已使用')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'verification_codes',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['email'], 'sparse': True},
            {'fields': ['phone'], 'sparse': True},
            {'fields': ['purpose']},
            {'fields': ['code']},
            {'fields': ['expires_at']},
            {'fields': ['is_used']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        if self.user:
            return f"{self.user.username} - {self.purpose} - {self.code}"
        elif self.email:
            return f"{self.email} - {self.purpose} - {self.code}"
        elif self.phone:
            return f"{self.phone} - {self.purpose} - {self.code}"
        else:
            return f"{self.purpose} - {self.code}"

    def is_expired(self):
        """检查验证码是否过期"""
        return timezone.now() > self.expires_at

    def is_valid(self):
        """检查验证码是否有效"""
        return not self.is_used and not self.is_expired()

class UserProfile(Document):
    """
    用户资料文档模型
    """
    user = ReferenceField(User, required=True, unique=True, verbose_name='用户')
    django_user_id = StringField(verbose_name='Django用户ID')  # 添加Django用户ID字段
    nickname = StringField(max_length=50, verbose_name='昵称')
    gender = StringField(max_length=10, choices=('male', 'female', 'other', 'unknown'), default='unknown', verbose_name='性别')
    birthday = DateTimeField(verbose_name='生日')
    location = StringField(max_length=100, verbose_name='位置')
    website = URLField(verbose_name='个人网站')
    social_links = DictField(verbose_name='社交链接')
    education = ListField(DictField(), verbose_name='教育经历')
    work = ListField(DictField(), verbose_name='工作经历')
    skills = ListField(StringField(), verbose_name='技能')
    interests = ListField(StringField(), verbose_name='兴趣')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'user_profiles',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['django_user_id']},  # 添加django_user_id索引
            {'fields': ['nickname']},
            {'fields': ['location']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.user.username} - {self.nickname or '无昵称'}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class UserSettings(Document):
    """
    用户设置文档模型
    """
    user = ReferenceField(User, required=True, unique=True, verbose_name='用户')
    theme = StringField(max_length=20, default='system', verbose_name='主题')
    font_size = StringField(max_length=20, default='medium', verbose_name='字体大小')
    language = StringField(max_length=10, default='zh-CN', verbose_name='语言')
    notification_enabled = BooleanField(default=True, verbose_name='是否启用通知')
    email_notification = BooleanField(default=True, verbose_name='是否启用邮件通知')
    auto_save = BooleanField(default=True, verbose_name='是否自动保存')
    auto_save_interval = IntField(default=60, verbose_name='自动保存间隔(秒)')
    offline_mode = BooleanField(default=False, verbose_name='是否启用离线模式')
    handwriting_recognition_mode = StringField(max_length=20, default='realtime', verbose_name='手写识别模式')
    ai_assistant_enabled = BooleanField(default=True, verbose_name='是否启用AI助手')
    ai_assistant_model = StringField(max_length=50, default='gpt-3.5-turbo', verbose_name='AI助手模型')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'user_settings',
        'indexes': [
            {'fields': ['user']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.user.username} - 设置"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    @classmethod
    def get_default_settings(cls):
        """获取默认设置"""
        return {
            'theme': 'system',
            'font_size': 'medium',
            'language': 'zh-CN',
            'notification_enabled': True,
            'email_notification': True,
            'auto_save': True,
            'auto_save_interval': 60,
            'offline_mode': False,
            'handwriting_recognition_mode': 'realtime',
            'ai_assistant_enabled': True,
            'ai_assistant_model': 'gpt-3.5-turbo',
        }
