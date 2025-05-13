"""
MongoDB Realm标签视图
使用MongoDB Realm服务替代SQLite服务
"""

from rest_framework import permissions, response, status
from rest_framework import viewsets
from rest_framework.decorators import action
from django.utils import timezone
from notes.mongodb_models import Tag, Note, Category
from notes.serializers import TagSerializer
from common.permissions import IsOwnerOrReadOnly
import uuid
import logging

logger = logging.getLogger(__name__)

class RealmTagViewSet(viewsets.ViewSet):
    """
    MongoDB Realm标签视图集
    提供标签的CRUD操作
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
        serializer = TagSerializer(data=request.data)
        if serializer.is_valid():
            # 处理分类
            category = None
            category_id = serializer.validated_data.get('category')
            if category_id:
                try:
                    category = Category.objects.get(id=category_id, user=request.user, is_deleted=False)
                except Category.DoesNotExist:
                    return response.Response(
                        {"detail": "分类不存在或已删除"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 检查标签名是否已存在
            if Tag.objects.filter(user=request.user, name=serializer.validated_data['name'], is_deleted=False).count() > 0:
                return response.Response(
                    {"detail": "标签名已存在"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 创建标签
            tag_data = {
                'id': uuid.uuid4(),
                'user': request.user,
                'name': serializer.validated_data['name'],
                'color': serializer.validated_data.get('color'),
                'category': category,
                'created_at': timezone.now(),
                'updated_at': timezone.now(),
                'realm_sync_status': 'pending'
            }

            tag = Tag(**tag_data)
            tag.save()

            # 返回序列化后的标签
            serializer = TagSerializer(tag)
            return response.Response(serializer.data, status=status.HTTP_201_CREATED)

        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新标签"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = TagSerializer(data=request.data)

            if serializer.is_valid():
                # 处理分类
                category = tag.category
                category_id = serializer.validated_data.get('category')
                if category_id:
                    try:
                        category = Category.objects.get(id=category_id, user=request.user, is_deleted=False)
                    except Category.DoesNotExist:
                        return response.Response(
                            {"detail": "分类不存在或已删除"},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                # 检查标签名是否已存在
                if serializer.validated_data['name'] != tag.name and Tag.objects.filter(user=request.user, name=serializer.validated_data['name'], is_deleted=False).count() > 0:
                    return response.Response(
                        {"detail": "标签名已存在"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # 更新标签
                tag.name = serializer.validated_data['name']
                tag.color = serializer.validated_data.get('color', tag.color)
                tag.category = category
                tag.updated_at = timezone.now()
                tag.realm_sync_status = 'pending'
                tag.save()

                # 返回序列化后的标签
                serializer = TagSerializer(tag)
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

            # 检查是否有笔记使用此标签
            if Note.objects.filter(tags=tag, is_deleted=False).count() > 0:
                return response.Response(
                    {"detail": "该标签下有笔记，无法删除"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 软删除标签
            tag.is_deleted = True
            tag.deleted_at = timezone.now()
            tag.realm_sync_status = 'pending'
            tag.save()

            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def notes(self, request, pk=None):
        """获取标签下的笔记"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            notes = Note.objects.filter(tags=tag, user=request.user, is_deleted=False)

            # 分页
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 10))
            start = (page - 1) * page_size
            end = start + page_size

            # 排序
            ordering = request.query_params.get('ordering', '-updated_at')
            if ordering.startswith('-'):
                notes = notes.order_by(ordering[1:]).reverse()
            else:
                notes = notes.order_by(ordering)

            # 序列化
            from notes.serializers import NoteListSerializer
            serializer = NoteListSerializer(notes[start:end], many=True, context={'request': request})

            return response.Response({
                'count': notes.count(),
                'results': serializer.data
            })
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取标签统计信息"""
        tags = Tag.objects.filter(user=request.user, is_deleted=False)

        # 统计每个标签下的笔记数量
        tag_stats = []
        for tag in tags:
            count = Note.objects.filter(tags=tag, user=request.user, is_deleted=False).count()
            if count > 0:
                tag_stats.append({
                    'id': str(tag.id),
                    'name': tag.name,
                    'color': tag.color,
                    'count': count
                })

        # 按笔记数量排序
        tag_stats.sort(key=lambda x: x['count'], reverse=True)

        return response.Response(tag_stats)

    @action(detail=True, methods=['post'])
    def add_to_note(self, request, pk=None):
        """将标签添加到笔记"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            note_id = request.data.get('note_id')

            if not note_id:
                return response.Response(
                    {"detail": "缺少笔记ID"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                note = Note.objects.get(id=note_id, user=request.user, is_deleted=False)

                # 检查标签是否已添加
                if tag in note.tags:
                    return response.Response(
                        {"detail": "标签已添加到笔记"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # 添加标签
                note.tags.append(tag)
                note.updated_at = timezone.now()
                note.realm_sync_status = 'pending'
                note.save()

                return response.Response({"detail": "标签已添加到笔记"})
            except Note.DoesNotExist:
                return response.Response(
                    {"detail": "笔记不存在或已删除"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def remove_from_note(self, request, pk=None):
        """从笔记中移除标签"""
        try:
            tag = Tag.objects.get(id=pk, user=request.user, is_deleted=False)
            note_id = request.data.get('note_id')

            if not note_id:
                return response.Response(
                    {"detail": "缺少笔记ID"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                note = Note.objects.get(id=note_id, user=request.user, is_deleted=False)

                # 检查标签是否已添加
                if tag not in note.tags:
                    return response.Response(
                        {"detail": "标签未添加到笔记"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # 移除标签
                note.tags.remove(tag)
                note.updated_at = timezone.now()
                note.realm_sync_status = 'pending'
                note.save()

                return response.Response({"detail": "标签已从笔记中移除"})
            except Note.DoesNotExist:
                return response.Response(
                    {"detail": "笔记不存在或已删除"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Tag.DoesNotExist:
            return response.Response(
                {"detail": "标签不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
