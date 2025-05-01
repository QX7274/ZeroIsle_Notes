from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q
from .models import NoteCategory, Tag, ContentReport, Note, Comment, Attachment
from .serializers import (
    NoteCategorySerializer,
    TagSerializer,
    ContentReportSerializer,
    ContentReportListSerializer,
    ContentReportUpdateSerializer,
    NoteSerializer,
    NoteListSerializer,
    NoteCreateSerializer,
    NoteUpdateSerializer,
    CommentSerializer,
    CommentListSerializer,
    AttachmentSerializer,
    AttachmentListSerializer
)
from .services import content_service
import logging

logger = logging.getLogger(__name__)

class NoteCategoryViewSet(viewsets.ModelViewSet):
    """笔记分类视图集"""
    queryset = NoteCategory.objects.all()
    serializer_class = NoteCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['name']

    def perform_update(self, serializer):
        """更新分类时的操作"""
        category = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了分类: {category.name}")

        # 同步到主应用
        try:
            category_data = {
                "name": category.name,
                "description": category.description,
                "updated_at": timezone.now()
            }
            content_service.update_category_in_main_app(category.id, category_data)
        except Exception as e:
            logger.error(f"同步分类数据到主应用时出错: {str(e)}")

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步分类数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_categories')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = content_service.sync_categories(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_categories')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_categories',
                    value=timezone.now().isoformat(),
                    description='分类数据的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '分类数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步分类数据时出错: {str(e)}")
            return Response(
                {"error": f"同步分类数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TagViewSet(viewsets.ModelViewSet):
    """标签视图集"""
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步标签数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_tags')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = content_service.sync_tags(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_tags')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_tags',
                    value=timezone.now().isoformat(),
                    description='标签数据的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '标签数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步标签数据时出错: {str(e)}")
            return Response(
                {"error": f"同步标签数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ContentReportViewSet(viewsets.ModelViewSet):
    """内容举报视图集"""
    queryset = ContentReport.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'reason', 'content_type']
    search_fields = ['content_id', 'reporter_id', 'description']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return ContentReportListSerializer
        elif self.action in ['update', 'partial_update']:
            return ContentReportUpdateSerializer
        return ContentReportSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = ContentReport.objects.all()

        # 按创建时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        return queryset

    def perform_update(self, serializer):
        """更新举报时的操作"""
        report = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了举报: {report.id}")

        # 同步到主应用
        try:
            report_data = {
                "status": report.status,
                "admin_comment": report.admin_comment,
                "updated_at": timezone.now()
            }
            content_service.update_report_in_main_app(report.id, report_data)
        except Exception as e:
            logger.error(f"同步举报数据到主应用时出错: {str(e)}")

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """标记为处理中"""
        report = self.get_object()
        report.status = 'processing'
        report.save()

        # 同步到主应用
        try:
            report_data = {
                "status": "processing",
                "updated_at": timezone.now()
            }
            content_service.update_report_in_main_app(report.id, report_data)
        except Exception as e:
            logger.error(f"同步举报状态到主应用时出错: {str(e)}")

        return Response({
            'status': 'success',
            'message': '举报已标记为处理中'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """标记为已解决"""
        report = self.get_object()
        report.status = 'resolved'
        report.admin_comment = request.data.get('admin_comment', report.admin_comment)
        report.save()

        # 同步到主应用
        try:
            report_data = {
                "status": "resolved",
                "admin_comment": report.admin_comment,
                "updated_at": timezone.now()
            }
            content_service.update_report_in_main_app(report.id, report_data)
        except Exception as e:
            logger.error(f"同步举报状态到主应用时出错: {str(e)}")

        return Response({
            'status': 'success',
            'message': '举报已标记为已解决'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """标记为已驳回"""
        report = self.get_object()
        report.status = 'rejected'
        report.admin_comment = request.data.get('admin_comment', report.admin_comment)
        report.save()

        # 同步到主应用
        try:
            report_data = {
                "status": "rejected",
                "admin_comment": report.admin_comment,
                "updated_at": timezone.now()
            }
            content_service.update_report_in_main_app(report.id, report_data)
        except Exception as e:
            logger.error(f"同步举报状态到主应用时出错: {str(e)}")

        return Response({
            'status': 'success',
            'message': '举报已标记为已驳回'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """举报统计信息"""
        total_reports = ContentReport.objects.count()
        pending_reports = ContentReport.objects.filter(status='pending').count()
        processing_reports = ContentReport.objects.filter(status='processing').count()
        resolved_reports = ContentReport.objects.filter(status='resolved').count()
        rejected_reports = ContentReport.objects.filter(status='rejected').count()

        return Response({
            'status': 'success',
            'data': {
                'total_reports': total_reports,
                'pending_reports': pending_reports,
                'processing_reports': processing_reports,
                'resolved_reports': resolved_reports,
                'rejected_reports': rejected_reports
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步举报数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_reports')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = content_service.sync_reports(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_reports')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_reports',
                    value=timezone.now().isoformat(),
                    description='举报数据的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '举报数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步举报数据时出错: {str(e)}")
            return Response(
                {"error": f"同步举报数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NoteViewSet(viewsets.ModelViewSet):
    """笔记视图集"""
    queryset = Note.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'updated_at', 'view_count', 'like_count', 'comment_count']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return NoteListSerializer
        elif self.action == 'create':
            return NoteCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return NoteUpdateSerializer
        return NoteSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = Note.objects.all()

        # 按状态筛选
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 按用户筛选
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # 按分类筛选
        category_id = self.request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category=category_id)

        # 按标签筛选
        tag_id = self.request.query_params.get('tag_id')
        if tag_id:
            queryset = queryset.filter(tags=tag_id)

        # 按创建时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        # 按笔记类型筛选
        note_type = self.request.query_params.get('note_type')
        if note_type:
            queryset = queryset.filter(note_type=note_type)

        # 按公开状态筛选
        is_public = self.request.query_params.get('is_public')
        if is_public is not None:
            is_public_bool = is_public.lower() == 'true'
            queryset = queryset.filter(is_public=is_public_bool)

        return queryset

    def perform_create(self, serializer):
        """创建笔记时的操作"""
        note = serializer.save()
        logger.info(f"管理员 {self.request.user} 创建了笔记: {note.title}")

    def perform_update(self, serializer):
        """更新笔记时的操作"""
        note = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了笔记: {note.title}")

        # 同步到主应用
        try:
            note_data = serializer.data
            note_data['updated_at'] = timezone.now()
            content_service.update_note_in_main_app(note.id, note_data)
        except Exception as e:
            logger.error(f"同步笔记数据到主应用时出错: {str(e)}")

    def perform_destroy(self, instance):
        """删除笔记时的操作"""
        title = instance.title
        logger.info(f"管理员 {self.request.user} 删除了笔记: {title}")

        # 同步到主应用
        try:
            content_service.delete_note_in_main_app(instance.id)
        except Exception as e:
            logger.error(f"在主应用中删除笔记时出错: {str(e)}")

        instance.delete()

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """获取笔记统计信息"""
        try:
            # 统计笔记总数
            total_notes = Note.objects.count()

            # 按笔记类型统计
            note_types = {}
            for note_type, _ in Note.NOTE_TYPE_CHOICES:
                note_types[note_type] = Note.objects.filter(note_type=note_type).count()

            # 按状态统计
            note_status = {}
            for status, _ in Note.NOTE_STATUS_CHOICES:
                note_status[status] = Note.objects.filter(status=status).count()

            # 按公开状态统计
            public_notes = Note.objects.filter(is_public=True).count()
            private_notes = Note.objects.filter(is_public=False).count()

            # 统计最近一周的笔记数量
            one_week_ago = timezone.now() - timezone.timedelta(days=7)
            recent_notes = Note.objects.filter(created_at__gte=one_week_ago).count()

            # 统计最活跃的分类
            from django.db.models import Count
            top_categories = NoteCategory.objects.annotate(
                note_count=Count('note')
            ).order_by('-note_count')[:5]

            top_categories_data = []
            for category in top_categories:
                top_categories_data.append({
                    'id': str(category.id),
                    'name': category.name,
                    'note_count': category.note_count
                })

            return Response({
                'status': 'success',
                'data': {
                    'total_notes': total_notes,
                    'note_types': note_types,
                    'note_status': note_status,
                    'public_notes': public_notes,
                    'private_notes': private_notes,
                    'recent_notes': recent_notes,
                    'top_categories': top_categories_data
                }
            })
        except Exception as e:
            logger.error(f"获取笔记统计信息时出错: {str(e)}")
            return Response(
                {"error": f"获取笔记统计信息失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步笔记数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_notes')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = content_service.sync_notes(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_notes')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_notes',
                    value=timezone.now().isoformat(),
                    description='笔记数据的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '笔记数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步笔记数据时出错: {str(e)}")
            return Response(
                {"error": f"同步笔记数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批量删除笔记"""
        try:
            note_ids = request.data.get('note_ids', [])
            if not note_ids:
                return Response(
                    {"error": "未提供笔记ID列表"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 批量删除笔记
            deleted_count = 0
            for note_id in note_ids:
                try:
                    note = Note.objects.get(id=note_id)
                    title = note.title

                    # 同步到主应用
                    try:
                        content_service.delete_note_in_main_app(note_id)
                    except Exception as e:
                        logger.error(f"在主应用中删除笔记时出错: {str(e)}")

                    # 删除本地笔记
                    note.delete()

                    logger.info(f"管理员 {request.user} 批量删除了笔记: {title}")
                    deleted_count += 1
                except Note.DoesNotExist:
                    logger.warning(f"笔记不存在: {note_id}")
                except Exception as e:
                    logger.error(f"删除笔记时出错: {str(e)}")

            return Response({
                "status": "success",
                "message": f"成功删除 {deleted_count} 个笔记",
                "deleted_count": deleted_count
            })
        except Exception as e:
            logger.error(f"批量删除笔记时出错: {str(e)}")
            return Response(
                {"error": f"批量删除笔记失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def export(self, request):
        """导出笔记数据"""
        try:
            # 获取筛选参数
            filters = request.data.get('filters', {})
            note_ids = request.data.get('note_ids', [])

            # 构建查询集
            queryset = self.get_queryset()

            # 如果提供了笔记ID列表，则只导出这些笔记
            if note_ids:
                queryset = queryset.filter(id__in=note_ids)

            # 应用筛选条件
            if 'keyword' in filters and filters['keyword']:
                keyword = filters['keyword']
                queryset = queryset.filter(
                    Q(title__icontains=keyword) |
                    Q(content__icontains=keyword)
                )

            if 'status' in filters and filters['status'] != 'all':
                queryset = queryset.filter(status=filters['status'])

            if 'note_type' in filters and filters['note_type'] != 'all':
                queryset = queryset.filter(note_type=filters['note_type'])

            if 'start_date' in filters and filters['start_date']:
                queryset = queryset.filter(created_at__gte=filters['start_date'])

            if 'end_date' in filters and filters['end_date']:
                queryset = queryset.filter(created_at__lte=filters['end_date'])

            # 获取笔记数据
            notes_data = []
            for note in queryset:
                notes_data.append({
                    'id': str(note.id),
                    'title': note.title,
                    'note_type': note.note_type,
                    'note_type_display': note.get_note_type_display(),
                    'status': note.status,
                    'status_display': note.get_status_display(),
                    'user_id': note.user_id,
                    'username': note.username,
                    'category': str(note.category.id) if note.category else '',
                    'category_name': note.category.name if note.category else '',
                    'tags_count': len(note.tags) if note.tags else 0,
                    'is_public': note.is_public,
                    'view_count': note.view_count,
                    'like_count': note.like_count,
                    'comment_count': note.comment_count,
                    'created_at': note.created_at.strftime('%Y-%m-%d %H:%M:%S') if note.created_at else '',
                    'updated_at': note.updated_at.strftime('%Y-%m-%d %H:%M:%S') if note.updated_at else ''
                })

            return Response({
                "status": "success",
                "message": f"成功导出 {len(notes_data)} 个笔记数据",
                "data": notes_data
            })
        except Exception as e:
            logger.error(f"导出笔记数据时出错: {str(e)}")
            return Response(
                {"error": f"导出笔记数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CommentViewSet(viewsets.ModelViewSet):
    """评论视图集"""
    queryset = Comment.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['content', 'username']
    ordering_fields = ['created_at', 'like_count']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return CommentListSerializer
        return CommentSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = Comment.objects.all()

        # 按笔记筛选
        note_id = self.request.query_params.get('note_id')
        if note_id:
            queryset = queryset.filter(note=note_id)

        # 按用户筛选
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # 按删除状态筛选
        is_deleted = self.request.query_params.get('is_deleted')
        if is_deleted is not None:
            is_deleted_bool = is_deleted.lower() == 'true'
            queryset = queryset.filter(is_deleted=is_deleted_bool)

        # 按创建时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        """创建评论时的操作"""
        comment = serializer.save()
        logger.info(f"管理员 {self.request.user} 创建了评论: {comment.id}")

    def perform_update(self, serializer):
        """更新评论时的操作"""
        comment = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了评论: {comment.id}")

        # 同步到主应用
        try:
            comment_data = serializer.data
            comment_data['updated_at'] = timezone.now()
            content_service.update_comment_in_main_app(comment.id, comment_data)
        except Exception as e:
            logger.error(f"同步评论数据到主应用时出错: {str(e)}")

    def perform_destroy(self, instance):
        """删除评论时的操作"""
        comment_id = instance.id
        logger.info(f"管理员 {self.request.user} 删除了评论: {comment_id}")

        # 同步到主应用
        try:
            content_service.delete_comment_in_main_app(comment_id)
        except Exception as e:
            logger.error(f"在主应用中删除评论时出错: {str(e)}")

        instance.delete()

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批量删除评论"""
        try:
            comment_ids = request.data.get('comment_ids', [])
            if not comment_ids:
                return Response(
                    {"error": "未提供评论ID列表"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 批量删除评论
            deleted_count = 0
            for comment_id in comment_ids:
                try:
                    comment = Comment.objects.get(id=comment_id)

                    # 同步到主应用
                    try:
                        content_service.delete_comment_in_main_app(comment_id)
                    except Exception as e:
                        logger.error(f"在主应用中删除评论时出错: {str(e)}")

                    # 删除本地评论
                    comment.delete()

                    logger.info(f"管理员 {request.user} 批量删除了评论: {comment_id}")
                    deleted_count += 1
                except Comment.DoesNotExist:
                    logger.warning(f"评论不存在: {comment_id}")
                except Exception as e:
                    logger.error(f"删除评论时出错: {str(e)}")

            return Response({
                "status": "success",
                "message": f"成功删除 {deleted_count} 个评论",
                "deleted_count": deleted_count
            })
        except Exception as e:
            logger.error(f"批量删除评论时出错: {str(e)}")
            return Response(
                {"error": f"批量删除评论失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步评论数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_comments')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = content_service.sync_comments(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_comments')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_comments',
                    value=timezone.now().isoformat(),
                    description='评论数据的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '评论数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步评论数据时出错: {str(e)}")
            return Response(
                {"error": f"同步评论数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class AttachmentViewSet(viewsets.ModelViewSet):
    """附件视图集"""
    queryset = Attachment.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['filename', 'mime_type']
    ordering_fields = ['created_at', 'file_size']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return AttachmentListSerializer
        return AttachmentSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = Attachment.objects.all()

        # 按笔记筛选
        note_id = self.request.query_params.get('note_id')
        if note_id:
            queryset = queryset.filter(note=note_id)

        # 按用户筛选
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # 按文件类型筛选
        file_type = self.request.query_params.get('file_type')
        if file_type:
            queryset = queryset.filter(file_type=file_type)

        # 按创建时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        # 按文件大小范围筛选
        min_size = self.request.query_params.get('min_size')
        max_size = self.request.query_params.get('max_size')
        if min_size:
            queryset = queryset.filter(file_size__gte=int(min_size))
        if max_size:
            queryset = queryset.filter(file_size__lte=int(max_size))

        return queryset

    def perform_create(self, serializer):
        """创建附件时的操作"""
        attachment = serializer.save()
        logger.info(f"管理员 {self.request.user} 创建了附件: {attachment.filename}")

    def perform_update(self, serializer):
        """更新附件时的操作"""
        attachment = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了附件: {attachment.filename}")

        # 同步到主应用
        try:
            attachment_data = serializer.data
            content_service.update_attachment_in_main_app(attachment.id, attachment_data)
        except Exception as e:
            logger.error(f"同步附件数据到主应用时出错: {str(e)}")

    def perform_destroy(self, instance):
        """删除附件时的操作"""
        filename = instance.filename
        logger.info(f"管理员 {self.request.user} 删除了附件: {filename}")

        # 同步到主应用
        try:
            content_service.delete_attachment_in_main_app(instance.id)
        except Exception as e:
            logger.error(f"在主应用中删除附件时出错: {str(e)}")

        instance.delete()

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批量删除附件"""
        try:
            attachment_ids = request.data.get('attachment_ids', [])
            if not attachment_ids:
                return Response(
                    {"error": "未提供附件ID列表"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 批量删除附件
            deleted_count = 0
            for attachment_id in attachment_ids:
                try:
                    attachment = Attachment.objects.get(id=attachment_id)
                    filename = attachment.filename

                    # 同步到主应用
                    try:
                        content_service.delete_attachment_in_main_app(attachment_id)
                    except Exception as e:
                        logger.error(f"在主应用中删除附件时出错: {str(e)}")

                    # 删除本地附件
                    attachment.delete()

                    logger.info(f"管理员 {request.user} 批量删除了附件: {filename}")
                    deleted_count += 1
                except Attachment.DoesNotExist:
                    logger.warning(f"附件不存在: {attachment_id}")
                except Exception as e:
                    logger.error(f"删除附件时出错: {str(e)}")

            return Response({
                "status": "success",
                "message": f"成功删除 {deleted_count} 个附件",
                "deleted_count": deleted_count
            })
        except Exception as e:
            logger.error(f"批量删除附件时出错: {str(e)}")
            return Response(
                {"error": f"批量删除附件失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步附件数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_attachments')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = content_service.sync_attachments(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_attachments')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_attachments',
                    value=timezone.now().isoformat(),
                    description='附件数据的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '附件数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步附件数据时出错: {str(e)}")
            return Response(
                {"error": f"同步附件数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
