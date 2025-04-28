"""
笔记视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
import uuid

from notes.mongodb_models import Note
from notes.serializers import (
    NoteSerializer,
    NoteListSerializer,
    NoteDetailSerializer,
    NoteCreateUpdateSerializer
)
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class NoteViewSet(viewsets.ModelViewSet):
    """笔记视图集"""
    serializer_class = NoteSerializer
    permission_classes = [IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_favorite', 'is_public']
    search_fields = ['title', 'content', 'tags__name']
    ordering_fields = ['created_at', 'updated_at', 'title', 'view_count']
    ordering = ['-updated_at']

    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        # 基础查询：用户自己的未删除笔记 或 公开的未删除笔记
        queryset = Note.objects.filter(
            user=user, is_deleted=False
        ) | Note.objects.filter(
            is_public=True, is_deleted=False
        )
        return queryset

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return NoteListSerializer
        elif self.action == 'retrieve':
            return NoteDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return NoteCreateUpdateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        """创建笔记时设置用户"""
        serializer.save(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        """查看笔记详情时更新查看次数和最后查看时间"""
        instance = self.get_object()
        # 只有非笔记所有者查看时才增加查看次数
        if instance.user != request.user:
            instance.view_count += 1
            instance.save(update_fields=['view_count'])

        # 如果是笔记所有者，更新最后查看时间
        if instance.user == request.user:
            instance.last_viewed_at = timezone.now()
            instance.save(update_fields=['last_viewed_at'])

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def favorites(self, request):
        """获取收藏的笔记"""
        queryset = self.get_queryset().filter(user=request.user, is_favorite=True)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = NoteListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = NoteListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        """切换笔记收藏状态"""
        note = self.get_object()
        if note.user != request.user:
            return Response(
                {"detail": "您不能收藏其他用户的笔记"},
                status=status.HTTP_403_FORBIDDEN
            )

        note.is_favorite = not note.is_favorite
        note.save(update_fields=['is_favorite'])
        return Response({"is_favorite": note.is_favorite})

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """获取最近查看的笔记"""
        queryset = self.get_queryset().filter(
            user=request.user,
            last_viewed_at__isnull=False
        ).order_by('-last_viewed_at')[:10]
        serializer = NoteListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """获取笔记统计信息"""
        user = request.user
        total_count = Note.objects.filter(user=user, is_deleted=False).count()
        favorite_count = Note.objects.filter(user=user, is_favorite=True, is_deleted=False).count()
        public_count = Note.objects.filter(user=user, is_public=True, is_deleted=False).count()
        deleted_count = Note.objects.filter(user=user, is_deleted=True).count()

        return Response({
            "total_count": total_count,
            "favorite_count": favorite_count,
            "public_count": public_count,
            "deleted_count": deleted_count
        })
