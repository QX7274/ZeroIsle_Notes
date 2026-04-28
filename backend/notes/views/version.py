"""
笔记版本视图（优化版）
- 使用VersionService封装业务逻辑
- 修复模型与视图不一致的问题
- 实现软删除、分页和版本恢复
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from common.pagination import StandardResultsSetPagination
from notes.mongodb_models import NoteVersion, Note
from notes.serializers import NoteVersionSerializer
from notes.services.version_service import VersionService
import logging
import difflib

logger = logging.getLogger(__name__)

class NoteVersionViewSet(viewsets.ViewSet):
    """
    笔记版本视图集（优化版）
    """
    serializer_class = NoteVersionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    # Manual paginator setup for ViewSet
    @property
    def paginator(self):
        if not hasattr(self, '_paginator'):
            if self.pagination_class is None:
                self._paginator = None
            else:
                self._paginator = self.pagination_class()
        return self._paginator

    def paginate_queryset(self, queryset):
        if self.paginator is None:
            return None
        return self.paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        assert self.paginator is not None
        return self.paginator.get_paginated_response(data)

    def get_serializer(self, *args, **kwargs):
        serializer_class = self.serializer_class
        kwargs.setdefault('context', {'request': self.request, 'view': self})
        return serializer_class(*args, **kwargs)

    def list(self, request):
        """获取版本列表（使用VersionService，支持分页）"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response(
                {"detail": "缺少note_id参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            note = Note.objects.get(id=note_id)
            versions = VersionService.get_versions_for_note(note, request.user)

            # 分页
            page = self.paginate_queryset(versions)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(versions, many=True)
            return Response(serializer.data)
        except Note.DoesNotExist:
            return Response({"detail": "笔记不存在"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    def retrieve(self, request, pk=None):
        """获取单个版本详情（使用VersionService）"""
        try:
            version = NoteVersion.objects.get(id=pk, is_deleted=False)
            if not VersionService.can_manage_versions(request.user, version.note):
                raise PermissionError("您没有权限查看此版本")

            serializer = self.get_serializer(version)
            return Response(serializer.data)
        except NoteVersion.DoesNotExist:
            return Response(
                {"detail": "版本不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    def create(self, request):
        """创建版本（使用VersionService）"""
        note_id = request.data.get('note')
        description = request.data.get('description')

        if not note_id:
            return Response(
                {"detail": "缺少note_id参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            note = Note.objects.get(id=note_id)

            version = VersionService.create_version(
                note=note,
                user=request.user,
                description=description or "手动保存"
            )

            serializer = self.get_serializer(version)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Note.DoesNotExist:
            return Response({"detail": "笔记不存在"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"创建版本失败: {str(e)}")
            return Response(
                {'error': '创建版本失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, pk=None):
        """删除版本（软删除，使用VersionService）"""
        try:
            version = NoteVersion.objects.get(id=pk, is_deleted=False)
            VersionService.delete_version(version, request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteVersion.DoesNotExist:
            return Response(
                {"detail": "版本不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"删除版本失败: {str(e)}")
            return Response({'error': '删除版本失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复版本（使用VersionService）"""
        try:
            version_to_restore = NoteVersion.objects.get(id=pk, is_deleted=False)

            new_version = VersionService.restore_version(version_to_restore, request.user)

            serializer = self.get_serializer(new_version)
            return Response({
                'message': '版本恢复成功',
                'restored_to_version': serializer.data
            })

        except NoteVersion.DoesNotExist:
            return Response({"detail": "版本不存在或已删除"}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, PermissionError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"恢复版本失败: {str(e)}")
            return Response({'error': '恢复版本失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def auto_save(self, request):
        """获取自动保存的版本（使用VersionService）"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response({'error': '缺少note_id参数'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            note = Note.objects.get(id=note_id)
            version = VersionService.get_latest_auto_save(note, request.user)

            if version:
                serializer = self.get_serializer(version)
                return Response(serializer.data)
            return Response({'detail': '没有找到最近的自动保存版本'}, status=status.HTTP_404_NOT_FOUND)
        except Note.DoesNotExist:
            return Response({"detail": "笔记不存在"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取自动保存版本失败: {str(e)}")
            return Response({'error': '获取自动保存版本失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def create_auto_save(self, request):
        """创建自动保存版本（使用VersionService）"""
        note_id = request.data.get('note')
        if not note_id:
            return Response({'error': '缺少note_id参数'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            note = Note.objects.get(id=note_id)

            # 更新笔记的临时内容以用于创建版本，但不保存笔记本身
            note.title = request.data.get('title', note.title)
            note.content = request.data.get('content', note.content)

            version = VersionService.create_version(
                note=note,
                user=request.user,
                description="自动保存",
                is_auto_save=True
            )

            serializer = self.get_serializer(version)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Note.DoesNotExist:
            return Response({"detail": "笔记不存在"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"创建自动保存版本失败: {str(e)}")
            return Response({'error': '创建自动保存版本失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def compare(self, request):
        """
        比较两个版本差异
        Query params:
        - from_id: 源版本ID
        - to_id: 目标版本ID
        返回 unified diff（逐行），便于前端高亮
        """
        from_id = request.query_params.get('from_id') or request.query_params.get('from')
        to_id = request.query_params.get('to_id') or request.query_params.get('to')
        if not from_id or not to_id:
            return Response({'detail': '缺少 from_id/to_id 参数'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            v_from = NoteVersion.objects.get(id=from_id, is_deleted=False)
            v_to = NoteVersion.objects.get(id=to_id, is_deleted=False)

            # 权限校验：同一笔记，用户可管理版本
            if v_from.note != v_to.note:
                return Response({'detail': '不可比较不同笔记的版本'}, status=status.HTTP_400_BAD_REQUEST)
            if not VersionService.can_manage_versions(request.user, v_from.note):
                return Response({'detail': '无权限比较该笔记版本'}, status=status.HTTP_403_FORBIDDEN)

            # 生成标题与内容的统一 diff
            title_diff = list(difflib.unified_diff(
                (v_from.title or '').splitlines(),
                (v_to.title or '').splitlines(),
                fromfile=f"v{v_from.version_number}:title",
                tofile=f"v{v_to.version_number}:title",
                lineterm=''
            ))
            content_diff = list(difflib.unified_diff(
                (v_from.content or '').splitlines(),
                (v_to.content or '').splitlines(),
                fromfile=f"v{v_from.version_number}:content",
                tofile=f"v{v_to.version_number}:content",
                lineterm=''
            ))

            return Response({
                'note_id': str(v_from.note.id),
                'from_version': v_from.version_number,
                'to_version': v_to.version_number,
                'title_diff': title_diff,
                'content_diff': content_diff
            })
        except NoteVersion.DoesNotExist:
            return Response({'detail': '版本不存在或已删除'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"比较版本失败: {str(e)}")
            return Response({'error': '比较版本失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({'error': '创建自动保存版本失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)