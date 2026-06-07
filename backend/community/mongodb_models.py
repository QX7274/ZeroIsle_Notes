"""
社区模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, EmbeddedDocument, EmbeddedDocumentField
from django.utils import timezone
import uuid
from users.mongodb_models import User
from notes.mongodb_models import Note

class Category(Document):
    """
    分类文档模型
    存储帖子分类
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分类ID')
    name = StringField(max_length=100, required=True, verbose_name='名称')
    slug = StringField(max_length=100, required=True, verbose_name='别名')
    description = StringField(verbose_name='描述')
    icon = StringField(max_length=50, verbose_name='图标')
    color = StringField(max_length=20, verbose_name='颜色')
    parent = ReferenceField('self', verbose_name='父分类')
    order = IntField(default=0, verbose_name='排序')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'community_categories',
        'indexes': [
            {'fields': ['slug'], 'unique': True},
            {'fields': ['parent']},
            {'fields': ['is_active']},
            {'fields': ['order']}
        ],
        'ordering': ['order', 'name']
    }
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class Tag(Document):
    """
    标签文档模型
    存储帖子标签
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='标签ID')
    name = StringField(max_length=50, required=True, verbose_name='名称')
    slug = StringField(max_length=50, required=True, verbose_name='别名')
    description = StringField(verbose_name='描述')
    color = StringField(max_length=20, verbose_name='颜色')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'community_tags',
        'indexes': [
            {'fields': ['slug'], 'unique': True},
            {'fields': ['is_active']}
        ],
        'ordering': ['name']
    }
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class Post(Document):
    """
    帖子文档模型
    存储社区帖子
    """
    STATUS_CHOICES = (
        ('draft', '草稿'),
        ('published', '已发布'),
        ('hidden', '已隐藏'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='帖子ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    group = ReferenceField('groups.Group', null=True, verbose_name='群组') # 新增字段
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    excerpt = StringField(verbose_name='摘要')
    status = StringField(max_length=20, choices=STATUS_CHOICES, default='published', verbose_name='状态')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    cover_image = StringField(verbose_name='封面图片')
    view_count = IntField(default=0, verbose_name='浏览次数')
    like_count = IntField(default=0, verbose_name='点赞次数')
    comment_count = IntField(default=0, verbose_name='评论次数')
    allow_comments = BooleanField(default=True, verbose_name='允许评论')
    is_pinned = BooleanField(default=False, verbose_name='是否置顶')
    is_featured = BooleanField(default=False, verbose_name='是否推荐')
    is_public = BooleanField(default=True, verbose_name='是否公开')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    published_at = DateTimeField(verbose_name='发布时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    deleted_at = DateTimeField(verbose_name='删除时间')
    
    meta = {
        'collection': 'community_posts',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['status']},
            {'fields': ['category']},
            {'fields': ['is_deleted']},
            {'fields': ['is_public']},
            {'fields': ['is_pinned']},
            {'fields': ['is_featured']},
            {'fields': ['published_at']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-is_pinned', '-published_at', '-created_at']
    }
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """保存前清理内容并更新时间"""
        import bleach

        if self.content:
            allowed_tags = list(bleach.sanitizer.ALLOWED_TAGS) + ['p', 'h1', 'h2', 'h3', 'br', 'span', 'div', 'img']
            allowed_attrs = {
                **bleach.sanitizer.ALLOWED_ATTRIBUTES,
                '*': ['style', 'class'],
                'img': ['src', 'alt', 'title'],
            }
            self.content = bleach.clean(self.content, tags=allowed_tags, attributes=allowed_attrs)

        # 如果没有摘要，自动生成
        if not self.excerpt and self.content:
            self.excerpt = bleach.clean(self.content, tags=[], strip=True)[:200]
        
        # 如果状态是已发布但没有发布时间，设置为当前时间
        if self.status == 'published' and not self.published_at:
            self.published_at = timezone.now()
            
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
    
    def update_comment_count(self, delta=1):
        """更新评论数量 (Atomic Increment/Decrement)"""
        Post.objects(id=self.id).update_one(inc__comment_count=delta, set__updated_at=timezone.now())
    
    def update_like_count(self, delta=1):
        """更新点赞数量 (Atomic Increment/Decrement)"""
        Post.objects(id=self.id).update_one(inc__like_count=delta, set__updated_at=timezone.now())
    
    def increment_view_count(self):
        """增加浏览次数 (Atomic)"""
        Post.objects(id=self.id).update_one(inc__view_count=1)

class Comment(Document):
    """
    评论文档模型
    存储帖子评论
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='评论ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    post = ReferenceField(Post, required=True, verbose_name='帖子')
    parent = ReferenceField('self', verbose_name='父评论')
    content = StringField(required=True, verbose_name='内容')
    like_count = IntField(default=0, verbose_name='点赞次数')
    is_pinned = BooleanField(default=False, verbose_name='是否置顶')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    deleted_at = DateTimeField(verbose_name='删除时间')
    
    meta = {
        'collection': 'community_comments',
        'indexes': [
            {'fields': ['post']},
            {'fields': ['user']},
            {'fields': ['parent']},
            {'fields': ['is_deleted']},
            {'fields': ['is_pinned']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-is_pinned', '-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username}: {self.content[:50]}"
    
    def save(self, *args, **kwargs):
        """保存前清理内容并更新时间"""
        import bleach
        is_new = self.id is None

        if self.content:
            allowed_tags = list(bleach.sanitizer.ALLOWED_TAGS) + ['p', 'br', 'span']
            allowed_attrs = {**bleach.sanitizer.ALLOWED_ATTRIBUTES, '*': ['style', 'class']}
            self.content = bleach.clean(self.content, tags=allowed_tags, attributes=allowed_attrs)
        
        self.updated_at = timezone.now()
        result = super().save(*args, **kwargs)
        
        # 如果是新评论，更新帖子评论数
        if is_new and not self.is_deleted:
            self.post.update_comment_count(1)
            
        return result
    
    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
        
        # 更新帖子评论数
        self.post.update_comment_count(-1)
    
    def hard_delete(self):
        """硬删除"""
        super().delete()
        
        # 更新帖子评论数
        self.post.update_comment_count(-1)
    
    def update_like_count(self, delta=1):
        """更新点赞次数 (Atomic Increment/Decrement)"""
        Comment.objects(id=self.id).update_one(inc__like_count=delta, set__updated_at=timezone.now())

class Like(Document):
    """
    点赞文档模型
    存储用户对内容的点赞
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='点赞ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    content_type = StringField(required=True, verbose_name='内容类型')  # 'Post', 'Comment', etc.
    object_id = StringField(required=True, verbose_name='对象ID')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'community_likes',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['content_type', 'object_id']},
            {'fields': ['is_active']},
            {'fields': ['user', 'content_type', 'object_id'], 'unique': True}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username} likes {self.content_type}:{self.object_id}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        result = super().save(*args, **kwargs)
        
        # 更新被点赞对象的点赞数
        self.update_target_like_count()
        
        return result
    
    def update_target_like_count(self):
        """更新被点赞对象的点赞数 (Atomic)"""
        delta = 1 if self.is_active else -1
        
        if self.content_type == 'Post':
            Post.objects(id=self.object_id).update_one(inc__like_count=delta)
        elif self.content_type == 'Comment':
            Comment.objects(id=self.object_id).update_one(inc__like_count=delta)

class Follow(Document):
    """
    关注文档模型
    存储用户对内容的关注
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='关注ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    content_type = StringField(required=True, verbose_name='内容类型')  # 'User', 'Category', etc.
    object_id = StringField(required=True, verbose_name='对象ID')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'community_follows',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['content_type', 'object_id']},
            {'fields': ['is_active']},
            {'fields': ['user', 'content_type', 'object_id'], 'unique': True}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username} follows {self.content_type}:{self.object_id}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class Notification(Document):
    """
    通知文档模型
    存储用户通知
    """
    TYPE_CHOICES = (
        ('like', '点赞'),
        ('comment', '评论'),
        ('reply', '回复'),
        ('follow', '关注'),
        ('mention', '提及'),
        ('system', '系统'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='通知ID')
    recipient = ReferenceField(User, required=True, verbose_name='接收者')
    sender = ReferenceField(User, verbose_name='发送者')
    notification_type = StringField(max_length=20, choices=TYPE_CHOICES, required=True, verbose_name='通知类型')
    content_type = StringField(verbose_name='内容类型')  # 'Post', 'Comment', etc.
    object_id = StringField(verbose_name='对象ID')
    message = StringField(required=True, verbose_name='消息内容')
    is_read = BooleanField(default=False, verbose_name='是否已读')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'community_notifications',
        'indexes': [
            {'fields': ['recipient']},
            {'fields': ['sender']},
            {'fields': ['notification_type']},
            {'fields': ['is_read']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.notification_type} notification for {self.recipient.username}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    def mark_as_read(self):
        """标记为已读"""
        self.is_read = True
        self.save()

class Collection(Document):
    """
    收藏文档模型
    存储用户收藏
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='收藏ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=100, required=True, verbose_name='名称')
    description = StringField(verbose_name='描述')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    posts = ListField(ReferenceField(Post), verbose_name='帖子')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'community_collections',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['is_public']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username}'s collection: {self.name}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    def add_post(self, post):
        """添加帖子"""
        if post not in self.posts:
            self.posts.append(post)
            self.save()
    
    def remove_post(self, post):
        """移除帖子"""
        if post in self.posts:
            self.posts.remove(post)
            self.save()

class Report(Document):
    """
    举报文档模型
    存储用户举报
    """
    REASON_CHOICES = (
        ('spam', '垃圾信息'),
        ('inappropriate', '不适当内容'),
        ('offensive', '冒犯性内容'),
        ('copyright', '版权问题'),
        ('other', '其他'),
    )
    
    STATUS_CHOICES = (
        ('pending', '待处理'),
        ('reviewing', '审核中'),
        ('resolved', '已解决'),
        ('rejected', '已拒绝'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='举报ID')
    user = ReferenceField(User, required=True, verbose_name='举报者')
    content_type = StringField(required=True, verbose_name='内容类型')  # 'Post', 'Comment', etc.
    object_id = StringField(required=True, verbose_name='对象ID')
    reason = StringField(max_length=20, choices=REASON_CHOICES, required=True, verbose_name='举报原因')
    description = StringField(verbose_name='详细描述')
    status = StringField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    handled_by = ReferenceField(User, verbose_name='处理者')
    handled_at = DateTimeField(verbose_name='处理时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'community_reports',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['content_type', 'object_id']},
            {'fields': ['status']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username} reported {self.content_type}:{self.object_id} for {self.reason}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    def resolve(self, handler):
        """解决举报"""
        self.status = 'resolved'
        self.handled_by = handler
        self.handled_at = timezone.now()
        self.save()
    
    def reject(self, handler):
        """拒绝举报"""
        self.status = 'rejected'
        self.handled_by = handler
        self.handled_at = timezone.now()
        self.save()
