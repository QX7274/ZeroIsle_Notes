"""笔记模型"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from users.models import User
import uuid
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Category(models.Model):
    """笔记分类模型"""
    name = models.CharField(max_length=50, verbose_name='分类名称')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='categories', verbose_name='用户')
    color = models.CharField(max_length=7, default='#000000', verbose_name='颜色')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '分类'
        verbose_name_plural = verbose_name
        unique_together = ('name', 'user')
    
    def __str__(self):
        return self.name


class Tag(models.Model):
    """标签模型"""
    name = models.CharField(max_length=50, verbose_name='标签名称', unique=True)
    color = models.CharField(max_length=7, default='#000000', verbose_name='颜色')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tags', verbose_name='用户')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '标签'
        verbose_name_plural = verbose_name
        unique_together = ('name', 'user')
    
    def __str__(self):
        return self.name


class Note(models.Model):
    """笔记模型"""
    title = models.CharField(max_length=200, verbose_name='标题')
    content = models.TextField(verbose_name='内容')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notes', verbose_name='用户')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='notes', verbose_name='分类')
    tags = models.ManyToManyField(Tag, blank=True, related_name='notes', verbose_name='标签')
    is_pinned = models.BooleanField(default=False, verbose_name='是否置顶')
    is_archived = models.BooleanField(default=False, verbose_name='是否归档')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '笔记'
        verbose_name_plural = verbose_name
        ordering = ['-is_pinned', '-updated_at']
    
    def __str__(self):
        return self.title


class NoteVersion(models.Model):
    """笔记版本历史模型"""
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='versions', verbose_name=_('笔记'))
    title = models.CharField(_('标题'), max_length=200)
    content = models.TextField(_('内容'))
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('笔记版本')
        verbose_name_plural = _('笔记版本')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.note.title} - {self.created_at}"


class NoteAttachment(models.Model):
    """笔记附件模型"""
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='attachments', verbose_name=_('笔记'))
    file = models.FileField(upload_to='note_attachments/%Y/%m/%d/', verbose_name=_('文件'))
    file_name = models.CharField(_('文件名'), max_length=255)
    file_size = models.IntegerField(_('文件大小(字节)'))
    file_type = models.CharField(_('文件类型'), max_length=100)
    created_at = models.DateTimeField(_('上传时间'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('笔记附件')
        verbose_name_plural = _('笔记附件')
        ordering = ['-created_at']
    
    def __str__(self):
        return self.file_name


class NoteShare(models.Model):
    """笔记分享模型"""
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='shares', verbose_name='笔记')
    shared_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_notes', verbose_name='分享者')
    shared_with = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_notes', verbose_name='接收者')
    can_edit = models.BooleanField(default=False, verbose_name='是否可以编辑')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    is_accepted = models.BooleanField(default=False, verbose_name='是否接受')

    class Meta:
        verbose_name = '笔记分享'
        verbose_name_plural = verbose_name
        unique_together = ('note', 'shared_with')
    
    def __str__(self):
        return f"{self.note.title} - {self.shared_with}"


class NoteSync(models.Model):
    """笔记同步状态模型"""
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='sync_records', verbose_name=_('笔记'))
    device_id = models.CharField(_('设备ID'), max_length=100)
    last_synced = models.DateTimeField(_('最后同步时间'))
    version = models.IntegerField(_('版本号'), default=1)
    is_conflict = models.BooleanField(_('是否存在冲突'), default=False)
    conflict_resolved = models.BooleanField(_('冲突是否已解决'), default=False)
    
    class Meta:
        verbose_name = _('笔记同步状态')
        verbose_name_plural = _('笔记同步状态')
        unique_together = ['note', 'device_id']
        ordering = ['-last_synced']
    
    def __str__(self):
        return f"{self.note.title} - {self.device_id} - V{self.version}"


class OCRModel(models.Model):
    """OCR模型"""
    name = models.CharField(max_length=100, verbose_name='模型名称')
    version = models.CharField(max_length=50, verbose_name='模型版本')
    model_path = models.CharField(max_length=255, verbose_name='模型路径')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = 'OCR模型'
        verbose_name_plural = 'OCR模型'
        
    def __str__(self):
        return f"{self.name} v{self.version}"


class OCRTrainingData(models.Model):
    """OCR训练数据"""
    image = models.ImageField(upload_to='ocr_training/', verbose_name='训练图片')
    text = models.TextField(verbose_name='标注文本')
    model = models.ForeignKey(OCRModel, on_delete=models.CASCADE, related_name='training_data', verbose_name='所属模型')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = 'OCR训练数据'
        verbose_name_plural = 'OCR训练数据'
        
    def __str__(self):
        return f"训练数据 {self.id}"


class WhisperModel(models.Model):
    """Whisper语音识别模型"""
    name = models.CharField(max_length=100, verbose_name='模型名称')
    version = models.CharField(max_length=50, verbose_name='模型版本')
    model_path = models.CharField(max_length=255, verbose_name='模型路径')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = 'Whisper模型'
        verbose_name_plural = 'Whisper模型'
        
    def __str__(self):
        return f"{self.name} v{self.version}"


class WhisperTrainingData(models.Model):
    """Whisper训练数据"""
    audio = models.FileField(upload_to='whisper_training/', verbose_name='训练音频')
    text = models.TextField(verbose_name='标注文本')
    model = models.ForeignKey(WhisperModel, on_delete=models.CASCADE, related_name='training_data', verbose_name='所属模型')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = 'Whisper训练数据'
        verbose_name_plural = 'Whisper训练数据'
        
    def __str__(self):
        return f"训练数据 {self.id}"