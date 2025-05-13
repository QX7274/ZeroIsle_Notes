"""
MongoDB Realm笔记视图
使用MongoDB Realm服务替代SQLite服务
"""

from rest_framework import viewsets, permissions, response, status
from rest_framework.decorators import action
from django.utils import timezone
# 导入模型
from notes.mongodb_models import Note, Category, Tag
import uuid
from django.utils import timezone
from notes.serializers import NoteSerializer, NoteListSerializer, NoteDetailSerializer
from common.permissions import IsOwnerOrReadOnly
# 如果需要mongodb_service，请确保正确导入
# from mongodb_service import mongodb_service
import uuid
import logging
from mongoengine.queryset.visitor import Q

logger = logging.getLogger(__name__)

class RealmNoteViewSet(viewsets.ViewSet):
    """
    MongoDB Realm笔记视图集
    提供笔记的CRUD操作
    """
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        # 基础查询：用户自己的未删除笔记 或 公开的未删除笔记
        queryset = Note.objects(
            Q(user=user, is_deleted=False) |
            Q(is_public=True, is_deleted=False)
        )
        return queryset

    def list(self, request):
        """获取笔记列表"""
        # 获取查询参数
        category_id = request.query_params.get('category')
        is_favorite = request.query_params.get('is_favorite')
        is_public = request.query_params.get('is_public')
        search = request.query_params.get('search')
        tag_id = request.query_params.get('tag')

        # 构建查询
        queryset = self.get_queryset()

        if category_id:
            queryset = queryset.filter(category=category_id)

        if is_favorite:
            is_favorite = is_favorite.lower() == 'true'
            queryset = queryset.filter(is_favorite=is_favorite)

        if is_public:
            is_public = is_public.lower() == 'true'
            queryset = queryset.filter(is_public=is_public)

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search)
            )

        if tag_id:
            queryset = queryset.filter(tags=tag_id)

        # 排序
        ordering = request.query_params.get('ordering', '-updated_at')
        if ordering.startswith('-'):
            queryset = queryset.order_by(ordering[1:]).reverse()
        else:
            queryset = queryset.order_by(ordering)

        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size

        # 序列化
        serializer = NoteListSerializer(queryset[start:end], many=True, context={'request': request})

        return response.Response({
            'count': queryset.count(),
            'results': serializer.data
        })

    def retrieve(self, request, pk=None):
        """获取单个笔记详情"""
        try:
            note = Note.objects.get(id=pk)

            # 检查权限
            if note.user != request.user and not note.is_public:
                return response.Response(
                    {"detail": "您没有权限查看此笔记"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 更新查看次数和最后查看时间
            if note.user != request.user:
                note.view_count += 1
                note.save()

            if note.user == request.user:
                note.last_viewed_at = timezone.now()
                note.save()

            serializer = NoteDetailSerializer(note, context={'request': request})
            return response.Response(serializer.data)
        except Note.DoesNotExist:
            return response.Response(
                {"detail": "笔记不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建笔记"""
        serializer = NoteSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 处理分类
            category = None
            category_id = serializer.validated_data.get('category')
            if category_id:
                try:
                    category = Category.objects.get(id=category_id, user=request.user)
                except Category.DoesNotExist:
                    return response.Response(
                        {"detail": "分类不存在"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 处理标签
            tags = []
            tag_ids = serializer.validated_data.get('tags', [])
            for tag_id in tag_ids:
                try:
                    tag = Tag.objects.get(id=tag_id, user=request.user)
                    tags.append(tag)
                except Tag.DoesNotExist:
                    pass

            # 创建笔记
            note_data = {
                'id': uuid.uuid4(),
                'user': request.user,
                'title': serializer.validated_data['title'],
                'content': serializer.validated_data['content'],
                'category': category,
                'tags': tags,
                'is_favorite': serializer.validated_data.get('is_favorite', False),
                'is_public': serializer.validated_data.get('is_public', False),
                'is_encrypted': serializer.validated_data.get('is_encrypted', False),
                'encryption_key': serializer.validated_data.get('encryption_key'),
                'created_at': timezone.now(),
                'updated_at': timezone.now(),
                'realm_sync_status': 'pending'
            }

            note = Note(**note_data)
            note.save()

            # 返回序列化后的笔记
            serializer = NoteDetailSerializer(note, context={'request': request})
            return response.Response(serializer.data, status=status.HTTP_201_CREATED)

        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新笔记"""
        try:
            note = Note.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteSerializer(data=request.data, context={'request': request})

            if serializer.is_valid():
                # 处理分类
                category = note.category
                category_id = serializer.validated_data.get('category')
                if category_id:
                    try:
                        category = Category.objects.get(id=category_id, user=request.user)
                    except Category.DoesNotExist:
                        return response.Response(
                            {"detail": "分类不存在"},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                # 处理标签
                tags = []
                tag_ids = serializer.validated_data.get('tags', [])
                for tag_id in tag_ids:
                    try:
                        tag = Tag.objects.get(id=tag_id, user=request.user)
                        tags.append(tag)
                    except Tag.DoesNotExist:
                        pass

                # 更新笔记
                note.title = serializer.validated_data['title']
                note.content = serializer.validated_data['content']
                note.category = category
                note.tags = tags
                note.is_favorite = serializer.validated_data.get('is_favorite', note.is_favorite)
                note.is_public = serializer.validated_data.get('is_public', note.is_public)
                note.is_encrypted = serializer.validated_data.get('is_encrypted', note.is_encrypted)
                note.encryption_key = serializer.validated_data.get('encryption_key', note.encryption_key)
                note.updated_at = timezone.now()
                note.realm_sync_status = 'pending'
                note.save()

                # 返回序列化后的笔记
                serializer = NoteDetailSerializer(note, context={'request': request})
                return response.Response(serializer.data)

            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Note.DoesNotExist:
            return response.Response(
                {"detail": "笔记不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除笔记"""
        try:
            note = Note.objects.get(id=pk, user=request.user, is_deleted=False)
            note.is_deleted = True
            note.deleted_at = timezone.now()
            note.realm_sync_status = 'pending'
            note.save()
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Note.DoesNotExist:
            return response.Response(
                {"detail": "笔记不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取笔记统计信息"""
        user = request.user

        # 获取笔记总数
        total_notes = Note.objects.filter(user=user, is_deleted=False).count()

        # 获取收藏笔记数
        favorite_notes = Note.objects.filter(user=user, is_favorite=True, is_deleted=False).count()

        # 获取公开笔记数
        public_notes = Note.objects.filter(user=user, is_public=True, is_deleted=False).count()

        # 获取已删除笔记数
        deleted_notes = Note.objects.filter(user=user, is_deleted=True).count()

        # 获取分类统计
        categories = Category.objects.filter(user=user, is_deleted=False)
        category_stats = []
        for category in categories:
            count = Note.objects.filter(user=user, category=category, is_deleted=False).count()
            if count > 0:
                category_stats.append({
                    'id': str(category.id),
                    'name': category.name,
                    'count': count
                })

        # 获取标签统计
        tags = Tag.objects.filter(user=user)
        tag_stats = []
        for tag in tags:
            count = Note.objects.filter(user=user, tags=tag, is_deleted=False).count()
            if count > 0:
                tag_stats.append({
                    'id': str(tag.id),
                    'name': tag.name,
                    'count': count
                })

        return response.Response({
            'total_notes': total_notes,
            'favorite_notes': favorite_notes,
            'public_notes': public_notes,
            'deleted_notes': deleted_notes,
            'categories': category_stats,
            'tags': tag_stats
        })
