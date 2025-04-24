from mongoengine import Document, StringField, DateTimeField
from django.utils import timezone

class NoteCategory(Document):
    """笔记分类"""
    name = StringField(max_length=50, unique=True, required=True, verbose_name='分类名称')
    description = StringField(required=False, verbose_name='分类描述')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_categories',
        'ordering': ['name'],
        'verbose_name': '笔记分类',
        'verbose_name_plural': '笔记分类'
    }

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(NoteCategory, self).save(*args, **kwargs)

class Tag(Document):
    """标签"""
    name = StringField(max_length=30, unique=True, required=True, verbose_name='标签名称')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'tags',
        'ordering': ['name'],
        'verbose_name': '标签',
        'verbose_name_plural': '标签'
    }

    def __str__(self):
        return self.name

class ContentReport(Document):
    """内容举报"""
    REPORT_STATUS_CHOICES = (
        ('pending', '待处理'),
        ('processing', '处理中'),
        ('resolved', '已解决'),
        ('rejected', '已驳回'),
    )

    REPORT_TYPE_CHOICES = (
        ('spam', '垃圾信息'),
        ('inappropriate', '不当内容'),
        ('copyright', '版权问题'),
        ('other', '其他'),
    )

    content_id = StringField(max_length=50, required=True, verbose_name='内容ID')
    content_type = StringField(max_length=20, required=True, verbose_name='内容类型')
    reporter_id = StringField(max_length=50, required=True, verbose_name='举报者ID')
    reason = StringField(max_length=20, choices=REPORT_TYPE_CHOICES, required=True, verbose_name='举报原因')
    description = StringField(required=False, verbose_name='详细描述')
    status = StringField(max_length=20, choices=REPORT_STATUS_CHOICES, default='pending', verbose_name='处理状态')
    admin_comment = StringField(required=False, verbose_name='管理员备注')
    created_at = DateTimeField(default=timezone.now, verbose_name='举报时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'content_reports',
        'ordering': ['-created_at'],
        'verbose_name': '内容举报',
        'verbose_name_plural': '内容举报'
    }

    def __str__(self):
        return f"{self.content_type}:{self.content_id} - {self.reason}"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(ContentReport, self).save(*args, **kwargs)
