"""
笔记模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, FileField
from django.utils import timezone
import uuid
from users.mongodb_models import User

class Category(Document):
    """
    分类文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分类ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=100, required=True, verbose_name='分类名称')
    description = StringField(max_length=500, verbose_name='分类描述')
    color = StringField(max_length=20, default='#2196F3', verbose_name='分类颜色')
    icon = StringField(max_length=50, verbose_name='分类图标')
    parent = ReferenceField('self', verbose_name='父分类')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'categories',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['parent']},
            {'fields': ['is_deleted']},
            {'fields': ['user', 'name'], 'unique': True}
        ],
        'ordering': ['name']
    }

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class Tag(Document):
    """
    标签文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='标签ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=50, required=True, verbose_name='标签名称')
    color = StringField(max_length=20, default='#2196F3', verbose_name='标签颜色')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'tags',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['user', 'name'], 'unique': True}
        ],
        'ordering': ['name']
    }

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class Note(Document):
    """
    笔记文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='笔记ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    is_encrypted = BooleanField(default=False, verbose_name='是否加密')
    encryption_key = StringField(max_length=255, verbose_name='加密密钥')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    view_count = IntField(default=0, verbose_name='查看次数')
    last_viewed_at = DateTimeField(verbose_name='最后查看时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'notes',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['category']},
            {'fields': ['is_deleted']},
            {'fields': ['is_favorite']},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']}
        ],
        'ordering': ['-updated_at']
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.last_viewed_at = timezone.now()
        self.save()

class NoteVersion(Document):
    """
    笔记版本文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='版本ID')
    note = ReferenceField(Note, required=True, verbose_name='笔记')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    version_number = IntField(required=True, verbose_name='版本号')
    created_by = ReferenceField(User, required=True, verbose_name='创建者')
    comment = StringField(max_length=255, verbose_name='版本说明')
    is_auto_save = BooleanField(default=False, verbose_name='是否自动保存')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'note_versions',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['created_by']},
            {'fields': ['version_number']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.note.title} - 版本 {self.version_number}"

class NoteAttachment(Document):
    """
    笔记附件文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='附件ID')
    note = ReferenceField(Note, required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_path = StringField(required=True, verbose_name='文件路径')
    file_type = StringField(max_length=100, verbose_name='文件类型')
    file_size = IntField(verbose_name='文件大小(字节)')
    thumbnail_path = StringField(verbose_name='缩略图路径')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_attachments',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['file_type']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return self.file_name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class NoteShare(Document):
    """
    笔记分享文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分享ID')
    note = ReferenceField(Note, required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='分享用户')
    share_type = StringField(max_length=20, choices=('link', 'email', 'user'), required=True, verbose_name='分享类型')
    share_to = StringField(max_length=255, verbose_name='分享对象')
    share_code = StringField(max_length=20, verbose_name='分享码')
    expires_at = DateTimeField(verbose_name='过期时间')
    is_password_protected = BooleanField(default=False, verbose_name='是否密码保护')
    password = StringField(max_length=100, verbose_name='密码')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_shares',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['share_code']},
            {'fields': ['is_active']},
            {'fields': ['expires_at']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.note.title} - {self.share_type}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def is_expired(self):
        """检查是否过期"""
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def is_valid(self):
        """检查是否有效"""
        return self.is_active and not self.is_expired()

    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.save()

class NoteReminder(Document):
    """
    笔记提醒文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='提醒ID')
    note = ReferenceField(Note, required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    description = StringField(verbose_name='描述')
    reminder_time = DateTimeField(required=True, verbose_name='提醒时间')
    repeat_type = StringField(max_length=20, choices=('none', 'daily', 'weekly', 'monthly', 'yearly'), default='none', verbose_name='重复类型')
    is_completed = BooleanField(default=False, verbose_name='是否完成')
    completed_at = DateTimeField(verbose_name='完成时间')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_reminders',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['reminder_time']},
            {'fields': ['is_completed']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['reminder_time']
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

    def complete(self):
        """完成提醒"""
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()

    def is_due(self):
        """检查是否到期"""
        return timezone.now() >= self.reminder_time

class NoteBackup(Document):
    """
    笔记备份文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='备份ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    backup_file = FileField(verbose_name='备份文件')
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_size = IntField(verbose_name='文件大小(字节)')
    notes_count = IntField(default=0, verbose_name='笔记数量')
    backup_type = StringField(max_length=20, choices=('manual', 'auto'), default='manual', verbose_name='备份类型')
    description = StringField(max_length=500, verbose_name='备份描述')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_backups',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['backup_type']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return self.file_name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class Handwriting(Document):
    """
    手写笔记文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='手写笔记ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    image = FileField(verbose_name='手写图片')
    thumbnail = FileField(verbose_name='缩略图')
    text_content = StringField(verbose_name='识别文本')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'handwritings',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['category']},
            {'fields': ['is_deleted']},
            {'fields': ['is_favorite']},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']}
        ],
        'ordering': ['-updated_at']
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.save()

class HandwritingShare(Document):
    """
    手写笔记分享文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分享ID')
    handwriting = ReferenceField(Handwriting, required=True, verbose_name='手写笔记')
    user = ReferenceField(User, required=True, verbose_name='分享用户')
    share_type = StringField(max_length=20, choices=('link', 'email', 'user'), required=True, verbose_name='分享类型')
    share_to = StringField(max_length=255, verbose_name='分享对象')
    share_code = StringField(max_length=20, verbose_name='分享码')
    expires_at = DateTimeField(verbose_name='过期时间')
    is_password_protected = BooleanField(default=False, verbose_name='是否密码保护')
    password = StringField(max_length=100, verbose_name='密码')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'handwriting_shares',
        'indexes': [
            {'fields': ['handwriting']},
            {'fields': ['user']},
            {'fields': ['share_code']},
            {'fields': ['is_active']},
            {'fields': ['expires_at']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.handwriting.title} - {self.share_type}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def is_expired(self):
        """检查是否过期"""
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def is_valid(self):
        """检查是否有效"""
        return self.is_active and not self.is_expired()

    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.save()

class OCRModel(Document):
    """
    OCR模型文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='模型ID')
    name = StringField(max_length=100, required=True, verbose_name='模型名称')
    description = StringField(max_length=500, verbose_name='模型描述')
    model_file = FileField(verbose_name='模型文件')
    model_type = StringField(max_length=50, choices=('tesseract', 'custom'), default='tesseract', verbose_name='模型类型')
    language = StringField(max_length=50, verbose_name='语言')
    version = StringField(max_length=20, verbose_name='版本')
    accuracy = StringField(max_length=20, verbose_name='准确率')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'ocr_models',
        'indexes': [
            {'fields': ['name']},
            {'fields': ['model_type']},
            {'fields': ['language']},
            {'fields': ['is_active']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class OCRTrainingData(Document):
    """
    OCR训练数据文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='训练数据ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    image = FileField(verbose_name='图片')
    text = StringField(required=True, verbose_name='文本')
    language = StringField(max_length=50, verbose_name='语言')
    is_verified = BooleanField(default=False, verbose_name='是否验证')
    verified_by = ReferenceField(User, verbose_name='验证者')
    verified_at = DateTimeField(verbose_name='验证时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'ocr_training_data',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['language']},
            {'fields': ['is_verified']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"训练数据 {self.id}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def verify(self, user):
        """验证训练数据"""
        self.is_verified = True
        self.verified_by = user
        self.verified_at = timezone.now()
        self.save()

class WhisperModel(Document):
    """
    Whisper模型文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='模型ID')
    name = StringField(max_length=100, required=True, verbose_name='模型名称')
    description = StringField(max_length=500, verbose_name='模型描述')
    model_file = FileField(verbose_name='模型文件')
    model_size = StringField(max_length=50, choices=('tiny', 'base', 'small', 'medium', 'large'), default='base', verbose_name='模型大小')
    language = StringField(max_length=50, verbose_name='语言')
    version = StringField(max_length=20, verbose_name='版本')
    accuracy = StringField(max_length=20, verbose_name='准确率')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'whisper_models',
        'indexes': [
            {'fields': ['name']},
            {'fields': ['model_size']},
            {'fields': ['language']},
            {'fields': ['is_active']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class WhisperTrainingData(Document):
    """
    Whisper训练数据文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='训练数据ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    audio = FileField(verbose_name='音频')
    text = StringField(required=True, verbose_name='文本')
    language = StringField(max_length=50, verbose_name='语言')
    is_verified = BooleanField(default=False, verbose_name='是否验证')
    verified_by = ReferenceField(User, verbose_name='验证者')
    verified_at = DateTimeField(verbose_name='验证时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'whisper_training_data',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['language']},
            {'fields': ['is_verified']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"训练数据 {self.id}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def verify(self, user):
        """验证训练数据"""
        self.is_verified = True
        self.verified_by = user
        self.verified_at = timezone.now()
        self.save()

class NoteAttachment(Document):
    """
    笔记附件文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='附件ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    file = FileField(verbose_name='文件')
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_type = StringField(max_length=100, verbose_name='文件类型')
    file_size = IntField(verbose_name='文件大小(字节)')
    description = StringField(max_length=500, verbose_name='描述')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_attachments',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['file_type']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return self.file_name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class NoteVersion(Document):
    """
    笔记版本文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='版本ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    version_number = IntField(default=1, verbose_name='版本号')
    description = StringField(max_length=500, verbose_name='版本描述')
    is_current = BooleanField(default=False, verbose_name='是否当前版本')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_versions',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['version_number']},
            {'fields': ['is_current']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-version_number']
    }

    def __str__(self):
        return f"{self.note.title} - v{self.version_number}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class NoteShare(Document):
    """
    笔记分享文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分享ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='分享用户')
    share_type = StringField(max_length=20, choices=('link', 'email', 'user'), required=True, verbose_name='分享类型')
    share_to = StringField(max_length=255, verbose_name='分享对象')
    share_code = StringField(max_length=20, verbose_name='分享码')
    expires_at = DateTimeField(verbose_name='过期时间')
    is_password_protected = BooleanField(default=False, verbose_name='是否密码保护')
    password = StringField(max_length=100, verbose_name='密码')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_shares',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['share_code']},
            {'fields': ['is_active']},
            {'fields': ['expires_at']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.note.title} - {self.share_type}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def is_expired(self):
        """检查是否过期"""
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def is_valid(self):
        """检查是否有效"""
        return self.is_active and not self.is_expired()

    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.save()

class NoteSync(Document):
    """
    笔记同步文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='同步ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    device_id = StringField(max_length=100, required=True, verbose_name='设备ID')
    sync_type = StringField(max_length=20, choices=('upload', 'download'), required=True, verbose_name='同步类型')
    status = StringField(max_length=20, choices=('pending', 'success', 'failed'), default='pending', verbose_name='状态')
    error_message = StringField(max_length=500, verbose_name='错误信息')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_syncs',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['device_id']},
            {'fields': ['sync_type']},
            {'fields': ['status']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.note.title} - {self.sync_type} - {self.status}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class NoteComment(Document):
    """
    笔记评论文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='评论ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    content = StringField(required=True, verbose_name='内容')
    parent = ReferenceField('self', verbose_name='父评论')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_comments',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['parent']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.user.username} - {self.content[:20]}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class NoteCollaboration(Document):
    """
    笔记协作文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='协作ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    owner = ReferenceField(User, required=True, verbose_name='所有者')
    collaborator = ReferenceField(User, required=True, verbose_name='协作者')
    permission = StringField(max_length=20, choices=('view', 'edit', 'admin'), default='view', verbose_name='权限')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_collaborations',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['owner']},
            {'fields': ['collaborator']},
            {'fields': ['permission']},
            {'fields': ['is_active']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.note.title} - {self.collaborator.username} - {self.permission}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class NoteTemplate(Document):
    """
    笔记模板文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='模板ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_templates',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['category']},
            {'fields': ['is_deleted']},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']}
        ],
        'ordering': ['-updated_at']
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.save()

class NoteBackup(Document):
    """
    笔记备份文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='备份ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    note = ReferenceField('Note', verbose_name='笔记')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    backup_type = StringField(max_length=20, choices=('auto', 'manual'), default='auto', verbose_name='备份类型')
    backup_file = FileField(verbose_name='备份文件')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_backups',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['note']},
            {'fields': ['backup_type']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.title} - {self.backup_type}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class NoteReminder(Document):
    """
    笔记提醒文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='提醒ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(verbose_name='内容')
    remind_at = DateTimeField(required=True, verbose_name='提醒时间')
    repeat_type = StringField(max_length=20, choices=('none', 'daily', 'weekly', 'monthly'), default='none', verbose_name='重复类型')
    is_completed = BooleanField(default=False, verbose_name='是否完成')
    completed_at = DateTimeField(verbose_name='完成时间')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_reminders',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['remind_at']},
            {'fields': ['is_completed']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['remind_at']
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

    def complete(self):
        """完成提醒"""
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()

    def uncomplete(self):
        """取消完成提醒"""
        self.is_completed = False
        self.completed_at = None
        self.save()

    def is_due(self):
        """检查是否到期"""
        return timezone.now() >= self.remind_at

class Notification(Document):
    """
    通知文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='通知ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    notification_type = StringField(max_length=50, choices=('system', 'reminder', 'share', 'comment'), required=True, verbose_name='通知类型')
    related_object_id = StringField(max_length=100, verbose_name='相关对象ID')
    related_object_type = StringField(max_length=50, verbose_name='相关对象类型')
    is_read = BooleanField(default=False, verbose_name='是否已读')
    read_at = DateTimeField(verbose_name='阅读时间')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'notifications',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['notification_type']},
            {'fields': ['is_read']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

    def mark_as_read(self):
        """标记为已读"""
        self.is_read = True
        self.read_at = timezone.now()
        self.save()

    def mark_as_unread(self):
        """标记为未读"""
        self.is_read = False
        self.read_at = None
        self.save()