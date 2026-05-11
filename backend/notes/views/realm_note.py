"""
MongoDB Realm笔记视图
使用MongoDB Realm服务替代SQLite服务
"""

from django.http import Http404
from rest_framework import viewsets, permissions, response, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
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

    def _get_mongo_user(self, request):
        """
        从请求中获取对应的 MongoDB 用户对象
        优先使用中间件注入的 request.mongo_user
        """
        # 优先使用中间件注入的 mongo_user
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user

        # 降级方案：手动查找（兼容旧代码）
        try:
            from users.mongodb_models import User as MongoUser
            django_user = request.user
            if not django_user or not django_user.is_authenticated:
                return None
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.warning(f"未找到对应的MongoDB用户: {django_user.username}")
            return mongo_user
        except Exception as e:
            logger.error(f"获取 MongoDB 用户失败: {e}", exc_info=True)
            return None

    def get_queryset(self):
        """获取当前用户可访问的笔记查询集"""
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            # 对于未认证或找不到用户的，只返回公开笔记
            return Note.objects(is_public=True, is_deleted=False)

        # 用户自己的笔记 或 其他用户的公开笔记
        return Note.objects(
            Q(user=mongo_user, is_deleted=False) |
            Q(is_public=True, is_deleted=False)
        )

    def get_object(self):
        """获取单个对象并自动检查权限"""
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供笔记ID")

        try:
            if isinstance(pk, str):
                pk = uuid.UUID(pk)
        except ValueError:
            raise Http404("无效的笔记ID格式")

        # 使用 get_queryset 来确保基础的可见性
        queryset = self.get_queryset()
        try:
            obj = queryset.get(id=pk)
        except Note.DoesNotExist:
            raise Http404("笔记不存在或无权访问")

        # 关键：DRF 会自动调用此方法来检查对象级权限
        self.check_object_permissions(self.request, obj)
        return obj

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
        queryset = queryset.order_by(ordering)

        # 使用 DRF 分页
        paginator = PageNumberPagination()
        # 允许通过查询参数覆盖 page_size（默认 settings.PAGE_SIZE）
        page_size = request.query_params.get('page_size')
        if page_size:
            try:
                paginator.page_size = int(page_size)
            except Exception:
                pass
        page_qs = paginator.paginate_queryset(queryset, request)

        serializer = NoteListSerializer(page_qs, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个笔记详情"""
        try:
            note = self.get_object()
            mongo_user = self._get_mongo_user(request)

            # 更新查看次数和最后查看时间
            if mongo_user and note.user.id != mongo_user.id:
                # 只有其他用户查看公开笔记时才增加浏览次数
                note.view_count += 1
                note.save(update_fields=['view_count'])

            if mongo_user and note.user.id == mongo_user.id:
                # 只有所有者查看时才更新最后查看时间
                note.last_viewed_at = timezone.now()
                note.save(update_fields=['last_viewed_at'])

            serializer = NoteDetailSerializer(note, context={'request': request})
            return response.Response(serializer.data)
        except Http404 as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取笔记详情失败: {str(e)}", exc_info=True)
            return response.Response(
                {"detail": "获取笔记详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建笔记"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return response.Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = NoteSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            logger.warning(f"笔记创建失败, 验证错误: {serializer.errors}")
            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            validated_data = serializer.validated_data
            category = None

            # 兼容两种入参结构：category_id（旧）或 category.id（当前序列化器source）
            category_id = validated_data.get('category_id')
            if not category_id:
                category_obj = validated_data.get('category')
                if isinstance(category_obj, dict):
                    category_id = category_obj.get('id')

            if category_id:
                try:
                    category = Category.objects.get(id=category_id, user=mongo_user)
                except Category.DoesNotExist:
                    return response.Response({"detail": "分类不存在"}, status=status.HTTP_400_BAD_REQUEST)

            tags = []
            # 兼容两种入参结构：tag_ids（旧）或 tags（当前序列化器）
            tag_ids = validated_data.get('tag_ids', []) or validated_data.get('tags', [])
            for tag_id in tag_ids:
                try:
                    tags.append(Tag.objects.get(id=tag_id, user=mongo_user))
                except Tag.DoesNotExist:
                    logger.warning(f"创建笔记时指定的标签不存在: {tag_id}")
                    pass  # 忽略不存在的标签

            note = Note(
                id=uuid.uuid4(),
                user=mongo_user,
                title=validated_data['title'],
                content=validated_data['content'],
                category=category,
                tags=tags,
                is_favorite=validated_data.get('is_favorite', False),
                is_public=validated_data.get('is_public', False),
                is_encrypted=validated_data.get('is_encrypted', False),
                encryption_key=validated_data.get('encryption_key'),
                realm_sync_status='pending'
            )
            note.save()
            logger.debug(f"笔记创建成功, ID: {note.id}")

            # 异步触发知识图谱构建已移至 signals.py 处理
            # try:
            #     build_graph_for_note_task.delay(str(note.id), str(mongo_user.id), True)
            # except Exception as e:
            #     logger.warning(f"提交构建知识图谱任务失败: {e}")


            response_serializer = NoteDetailSerializer(note, context={'request': request})
            return response.Response(response_serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"创建笔记时发生内部错误: {str(e)}", exc_info=True)
            return response.Response({"detail": "创建笔记时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, pk=None):
        """更新笔记"""
        try:
            note = self.get_object()  # get_object 已经处理了权限和存在性检查
            mongo_user = self._get_mongo_user(request)

            serializer = NoteSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                logger.warning(f"笔记更新失败, 验证错误: {serializer.errors}")
                return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            validated_data = serializer.validated_data
            category = note.category

            category_id = validated_data.get('category_id')
            if not category_id:
                category_obj = validated_data.get('category')
                if isinstance(category_obj, dict):
                    category_id = category_obj.get('id')

            if category_id:
                try:
                    category = Category.objects.get(id=category_id, user=mongo_user)
                except Category.DoesNotExist:
                    return response.Response({"detail": "分类不存在"}, status=status.HTTP_400_BAD_REQUEST)

            tags = []
            tag_ids = validated_data.get('tag_ids', []) or validated_data.get('tags', [])
            for tag_id in tag_ids:
                try:
                    tags.append(Tag.objects.get(id=tag_id, user=mongo_user))
                except Tag.DoesNotExist:
                    logger.warning(f"更新笔记时指定的标签不存在: {tag_id}")
                    pass

            # 更新字段
            note.title = validated_data['title']
            note.content = validated_data['content']
            note.category = category
            note.tags = tags
            note.is_favorite = validated_data.get('is_favorite', note.is_favorite)
            note.is_public = validated_data.get('is_public', note.is_public)
            note.is_encrypted = validated_data.get('is_encrypted', note.is_encrypted)
            note.encryption_key = validated_data.get('encryption_key', note.encryption_key)
            note.updated_at = timezone.now()
            note.realm_sync_status = 'pending'
            note.save()
            logger.debug(f"笔记更新成功, ID: {note.id}")

            # 异步触发知识图谱构建已移至 signals.py 处理
            # try:
            #     build_graph_for_note_task.delay(str(note.id), str(mongo_user.id), True)
            # except Exception as e:
            #     logger.warning(f"提交构建知识图谱任务失败: {e}")


            response_serializer = NoteDetailSerializer(note, context={'request': request})
            return response.Response(response_serializer.data)

        except Http404 as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except PermissionDenied as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"更新笔记时发生内部错误: {str(e)}", exc_info=True)
            return response.Response({"detail": "更新笔记时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除笔记（软删除）"""
        try:
            note = self.get_object()  # get_object 已经处理了权限和存在性检查
            note.is_deleted = True
            note.deleted_at = timezone.now()
            note.realm_sync_status = 'pending'
            note.save()
            logger.debug(f"笔记软删除成功, ID: {note.id}")
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Http404 as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except PermissionDenied as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"删除笔记时发生内部错误: {str(e)}", exc_info=True)
            return response.Response({"detail": "删除笔记时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取笔记统计信息"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return response.Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            user_notes = Note.objects(user=mongo_user)
            total_notes = user_notes.filter(is_deleted=False).count()
            favorite_notes = user_notes.filter(is_favorite=True, is_deleted=False).count()
            public_notes = user_notes.filter(is_public=True, is_deleted=False).count()
            deleted_notes = user_notes.filter(is_deleted=True).count()

            # 分类统计
            category_stats = []
            for category in Category.objects(user=mongo_user, is_deleted=False):
                count = user_notes.filter(category=category, is_deleted=False).count()
                if count > 0:
                    category_stats.append({'id': str(category.id), 'name': category.name, 'count': count})

            # 标签统计
            tag_stats = []
            for tag in Tag.objects(user=mongo_user):
                count = user_notes.filter(tags=tag, is_deleted=False).count()
                if count > 0:
                    tag_stats.append({'id': str(tag.id), 'name': tag.name, 'count': count})

            logger.debug(f"获取笔记统计信息成功, 用户: {mongo_user.username}, 总笔记数: {total_notes}")
            return response.Response({
                'total_notes': total_notes,
                'favorite_notes': favorite_notes,
                'public_notes': public_notes,
                'deleted_notes': deleted_notes,
                'categories': category_stats,
                'tags': tag_stats
            })
        except Exception as e:
            logger.error(f"获取笔记统计信息失败: {str(e)}", exc_info=True)
            return response.Response(
                {"detail": "获取笔记统计信息时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
