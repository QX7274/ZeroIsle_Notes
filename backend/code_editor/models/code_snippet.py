"""
代码片段模型
"""

import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model

User = get_user_model()

class CodeSnippet(models.Model):
    """代码片段模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='code_snippets', verbose_name=_('用户'))
    title = models.CharField(_('标题'), max_length=200)
    description = models.TextField(_('描述'), blank=True, null=True)
    code = models.TextField(_('代码'))
    language = models.CharField(_('语言'), max_length=50)
    is_public = models.BooleanField(_('是否公开'), default=False)
    tags = models.CharField(_('标签'), max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('代码片段')
        verbose_name_plural = _('代码片段')
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title
    
    def get_tags_list(self):
        """获取标签列表"""
        if not self.tags:
            return []
        return [tag.strip() for tag in self.tags.split(',')]
    
    def set_tags_list(self, tags_list):
        """设置标签列表"""
        if not tags_list:
            self.tags = None
        else:
            self.tags = ','.join(tags_list)
