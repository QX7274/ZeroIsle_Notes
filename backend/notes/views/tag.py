"""标签视图集"""

from rest_framework import viewsets, permissions, response, status
from notes.mongodb_models import Tag
from notes.serializers import TagSerializer
from common.permissions import IsOwnerOrReadOnly

class TagViewSet(viewsets.ViewSet):
    """标签视图集

    提供笔记标签的CRUD操作
    """
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def list(self, request):
        """获取当前用户的标签列表"""
        tags = Tag.objects.filter(user=request.user, is_deleted=False)
        serializer = TagSerializer(tags, many=True)
        return response.Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个标签详情"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = TagSerializer(tag)
            return response.Response(serializer.data)
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建标签"""
        serializer = TagSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return response.Response(serializer.data, status=status.HTTP_201_CREATED)
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新标签"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = TagSerializer(tag, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return response.Response(serializer.data)
            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def partial_update(self, request, pk=None):
        """部分更新标签"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = TagSerializer(tag, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return response.Response(serializer.data)
            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除标签"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            tag.delete()  # 软删除
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )