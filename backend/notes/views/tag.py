"""标签视图集"""

from rest_framework import viewsets, permissions
from notes.models import Tag
from notes.serializers import TagSerializer
from common.permissions import IsOwnerOrReadOnly

class TagViewSet(viewsets.ModelViewSet):
    """标签视图集
    
    提供笔记标签的CRUD操作
    """
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取当前用户的标签列表"""
        return Tag.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """创建标签时自动关联当前用户"""
        serializer.save(user=self.request.user)