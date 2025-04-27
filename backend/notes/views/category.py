"""分类视图集"""

from rest_framework import viewsets, permissions
from notes.models import Category
from notes.serializers import CategorySerializer
from common.permissions import IsOwnerOrReadOnly

class CategoryViewSet(viewsets.ModelViewSet):
    """分类视图集
    
    提供笔记分类的CRUD操作
    """
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取当前用户的分类列表"""
        return Category.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """创建分类时自动关联当前用户"""
        serializer.save(user=self.request.user)