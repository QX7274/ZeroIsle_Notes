from django.db import models
from .note import Note

class NoteAttachment(models.Model):
    """笔记附件模型
    
    Attributes:
        file (FileField): 上传文件路径
        note (ForeignKey): 关联的笔记
    """
    file = models.FileField(upload_to='attachments/%Y/%m/%d/', verbose_name='附件文件')
    note = models.ForeignKey(
        Note,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='所属笔记'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'note_attachments'
        verbose_name = '笔记附件'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.note.title}的附件'