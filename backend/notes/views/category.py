"""分类视图集"""

from rest_framework import viewsets, permissions, response, status
from notes.mongodb_models import Category
from notes.serializers import CategorySerializer
from common.permissions import IsOwnerOrReadOnly

class CategoryViewSet(viewsets.ViewSet):
    """分类视图集

    提供笔记分类的CRUD操作
    """
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def list(self, request):
        """获取当前用户的分类列表"""
        categories = Category.objects.filter(user=request.user, is_deleted=False)
        serializer = CategorySerializer(categories, many=True)
        return response.Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个分类详情"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = CategorySerializer(category)
            return response.Response(serializer.data)
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建分类"""
        serializer = CategorySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return response.Response(serializer.data, status=status.HTTP_201_CREATED)
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新分类"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = CategorySerializer(category, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return response.Response(serializer.data)
            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def partial_update(self, request, pk=None):
        """部分更新分类"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = CategorySerializer(category, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return response.Response(serializer.data)
            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除分类"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)
            category.delete()  # 软删除
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )