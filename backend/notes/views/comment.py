"""
笔记评论视图（优化版）
- 使用CommentService封装业务逻辑
- 实现软删除
- 添加分页
- 修复查询和权限问题
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from common.pagination import StandardResultsSetPagination
from notes.mongodb_models import NoteComment, Note
from notes.serializers import NoteCommentSerializer
from notes.services.comment_service import CommentService
import logging

logger = logging.getLogger(__name__)

class NoteCommentViewSet(viewsets.ViewSet):
    """
    笔记评论视图集（优化版）
    """
    serializer_class = NoteCommentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @property
    def paginator(self):
        """ The paginator instance associated with the view, or `None`. """
        if not hasattr(self, '_paginator'):
            if self.pagination_class is None:
                self._paginator = None
            else:
                self._paginator = self.pagination_class()
        return self._paginator

    def paginate_queryset(self, queryset):
        """ Return a single page of results, or `None` if pagination is disabled. """
        if self.paginator is None:
            return None
        return self.paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        """ Return a paginated style `Response` object for the given output data. """
        assert self.paginator is not None
        return self.paginator.get_paginated_response(data)

    def list(self, request):
        """获取评论列表（使用CommentService，支持分页）"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response(
                {"detail": "缺少note_id参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            note = Note.objects.get(id=note_id)
            comments = CommentService.get_comments_for_note(note, request.user)

            # 分页
            page = self.paginate_queryset(comments)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(comments, many=True)
            return Response(serializer.data)
        except Note.DoesNotExist:
            return Response(
                {"detail": "笔记不存在"},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    def get_serializer(self, *args, **kwargs):
        """ Return the serializer instance that should be used for validating and
        deserializing input, and for serializing output. """
        serializer_class = self.serializer_class
        kwargs.setdefault('context', self.get_serializer_context())
        return serializer_class(*args, **kwargs)

    def get_serializer_context(self):
        """ Extra context provided to the serializer class. """
        return {
            'request': self.request,
            'format': self.format_kwarg,
            'view': self
        }

    def retrieve(self, request, pk=None):
        """获取单个评论详情（使用CommentService）"""
        try:
            comment = NoteComment.objects.get(id=pk, is_deleted=False)
            if not CommentService.can_view_comments(request.user, comment.note):
                raise PermissionError("您没有权限查看此评论")

            serializer = self.get_serializer(comment)
            return Response(serializer.data)
        except NoteComment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    def create(self, request):
        """创建评论（使用CommentService）"""
        note_id = request.data.get('note')
        content = request.data.get('content')
        parent_id = request.data.get('parent')

        if not note_id or not content:
            return Response(
                {"detail": "缺少note_id或content参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            note = Note.objects.get(id=note_id)
            parent = None
            if parent_id:
                parent = NoteComment.objects.get(id=parent_id, is_deleted=False)

            comment = CommentService.create_comment(
                note=note,
                user=request.user,
                content=content,
                parent=parent,
                request_meta=request.META
            )

            serializer = self.get_serializer(comment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Note.DoesNotExist:
            return Response({"detail": "笔记不存在"}, status=status.HTTP_404_NOT_FOUND)
        except NoteComment.DoesNotExist:
            return Response({"detail": "父评论不存在"}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, PermissionError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"创建评论失败: {str(e)}")
            return Response(
                {'error': '创建评论失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, pk=None):
        """更新评论（使用CommentService）"""
        content = request.data.get('content')
        if not content:
            return Response(
                {"detail": "评论内容不能为空"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            comment = NoteComment.objects.get(id=pk, is_deleted=False)
            updated_comment = CommentService.update_comment(
                comment=comment,
                user=request.user,
                content=content
            )
            serializer = self.get_serializer(updated_comment)
            return Response(serializer.data)
        except NoteComment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except (ValueError, PermissionError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"更新评论失败: {str(e)}")
            return Response(
                {'error': '更新评论失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, pk=None):
        """删除评论（软删除，使用CommentService）"""
        try:
            comment = NoteComment.objects.get(id=pk, is_deleted=False)
            CommentService.delete_comment(comment, request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteComment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"删除评论失败: {str(e)}")
            return Response(
                {'error': '删除评论失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """回复评论（使用CommentService）"""
        content = request.data.get('content')
        if not content:
            return Response(
                {"detail": "评论内容不能为空"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parent_comment = NoteComment.objects.get(id=pk, is_deleted=False)

            reply = CommentService.create_comment(
                note=parent_comment.note,
                user=request.user,
                content=content,
                parent=parent_comment,
                request_meta=request.META
            )

            serializer = self.get_serializer(reply)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except NoteComment.DoesNotExist:
            return Response({"detail": "父评论不存在"}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, PermissionError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"回复评论失败: {str(e)}")
            return Response(
                {'error': '回复评论失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def my_comments(self, request):
        """获取我的评论（使用CommentService，支持分页）"""
        try:
            comments = CommentService.get_user_comments(request.user)

            # 分页
            page = self.paginate_queryset(comments)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(comments, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取我的评论失败: {str(e)}")
            return Response(
                {'error': '获取我的评论失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞评论"""
        try:
            comment = NoteComment.objects.get(id=pk, is_deleted=False)

            # 检查是否有权查看
            if not CommentService.can_view_comments(request.user, comment.note):
                raise PermissionError("您没有权限与此评论互动")

            CommentService.like_comment(comment)
            return Response({'status': 'success', 'likes_count': comment.likes_count})
        except NoteComment.DoesNotExist:
            return Response({"detail": "评论不存在"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['post'])
    def unlike(self, request, pk=None):
        """取消点赞评论"""
        try:
            comment = NoteComment.objects.get(id=pk, is_deleted=False)

            # 检查是否有权查看
            if not CommentService.can_view_comments(request.user, comment.note):
                raise PermissionError("您没有权限与此评论互动")

            CommentService.unlike_comment(comment)
            return Response({'status': 'success', 'likes_count': comment.likes_count})
        except NoteComment.DoesNotExist:
            return Response({"detail": "评论不存在"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)