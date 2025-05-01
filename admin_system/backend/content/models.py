from mongoengine import Document, StringField, DateTimeField, ReferenceField, ListField, BooleanField, IntField, DictField
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

class Note(Document):
    """笔记模型"""
    NOTE_TYPE_CHOICES = (
        ('text', '文本笔记'),
        ('canvas', '画布笔记'),
        ('pdf', 'PDF笔记'),
        ('word', 'Word笔记'),
        ('image', '图片笔记'),
        ('audio', '音频笔记'),
        ('video', '视频笔记'),
    )

    NOTE_STATUS_CHOICES = (
        ('draft', '草稿'),
        ('published', '已发布'),
        ('archived', '已归档'),
        ('deleted', '已删除'),
    )

    title = StringField(max_length=200, required=True, verbose_name='标题')
    content = StringField(required=False, verbose_name='内容')
    note_type = StringField(max_length=20, choices=NOTE_TYPE_CHOICES, default='text', verbose_name='笔记类型')
    status = StringField(max_length=20, choices=NOTE_STATUS_CHOICES, default='draft', verbose_name='状态')

    user_id = StringField(max_length=50, required=True, verbose_name='用户ID')
    username = StringField(max_length=150, required=False, verbose_name='用户名')

    category = ReferenceField(NoteCategory, required=False, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), required=False, verbose_name='标签')

    is_public = BooleanField(default=False, verbose_name='是否公开')
    is_pinned = BooleanField(default=False, verbose_name='是否置顶')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')

    view_count = IntField(default=0, verbose_name='查看次数')
    like_count = IntField(default=0, verbose_name='点赞次数')
    comment_count = IntField(default=0, verbose_name='评论次数')

    metadata = DictField(verbose_name='元数据')

    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'notes',
        'ordering': ['-updated_at'],
        'indexes': [
            'user_id',
            'note_type',
            'status',
            'is_public',
            'created_at',
            'updated_at'
        ],
        'verbose_name': '笔记',
        'verbose_name_plural': '笔记'
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(Note, self).save(*args, **kwargs)

class Comment(Document):
    """评论模型"""
    content = StringField(required=True, verbose_name='评论内容')
    note = ReferenceField(Note, required=True, verbose_name='笔记')
    user_id = StringField(max_length=50, required=True, verbose_name='用户ID')
    username = StringField(max_length=150, required=False, verbose_name='用户名')
    parent_comment = ReferenceField('self', required=False, verbose_name='父评论')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    like_count = IntField(default=0, verbose_name='点赞次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'comments',
        'ordering': ['-created_at'],
        'indexes': [
            'note',
            'user_id',
            'parent_comment',
            'created_at'
        ],
        'verbose_name': '评论',
        'verbose_name_plural': '评论'
    }

    def __str__(self):
        return f"{self.username}: {self.content[:20]}..."

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(Comment, self).save(*args, **kwargs)

class Attachment(Document):
    """附件模型"""
    ATTACHMENT_TYPE_CHOICES = (
        ('image', '图片'),
        ('document', '文档'),
        ('audio', '音频'),
        ('video', '视频'),
        ('other', '其他'),
    )

    filename = StringField(max_length=255, required=True, verbose_name='文件名')
    file_path = StringField(required=True, verbose_name='文件路径')
    file_type = StringField(max_length=20, choices=ATTACHMENT_TYPE_CHOICES, default='other', verbose_name='文件类型')
    file_size = IntField(required=False, verbose_name='文件大小(字节)')
    mime_type = StringField(max_length=100, required=False, verbose_name='MIME类型')

    note = ReferenceField(Note, required=False, verbose_name='关联笔记')
    user_id = StringField(max_length=50, required=True, verbose_name='用户ID')

    created_at = DateTimeField(default=timezone.now, verbose_name='上传时间')

    meta = {
        'collection': 'attachments',
        'ordering': ['-created_at'],
        'indexes': [
            'note',
            'user_id',
            'file_type',
            'created_at'
        ],
        'verbose_name': '附件',
        'verbose_name_plural': '附件'
    }

    def __str__(self):
        return self.filename
