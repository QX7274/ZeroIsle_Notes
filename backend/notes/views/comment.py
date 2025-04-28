"""
笔记评论视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteComment, Note
from notes.serializers import NoteCommentSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import uuid

logger = logging.getLogger(__name__)

class NoteCommentViewSet(viewsets.ViewSet):
    """
    笔记评论视图集
    """
    serializer_class = NoteCommentSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取评论列表"""
        user = request.user
        note_id = request.query_params.get('note_id')

        if note_id:
            # 获取指定笔记的评论
            try:
                note = Note.objects.get(id=note_id)
                # 如果是公开笔记或者是笔记的所有者，则可以查看评论
                if note.is_public or note.user == user:
                    comments = NoteComment.objects.filter(note=note, parent=None, is_deleted=False)
                    serializer = NoteCommentSerializer(comments, many=True)
                    return Response(serializer.data)
                else:
                    return Response(
                        {"detail": "您没有权限查看此笔记的评论"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # 获取用户自己的笔记的评论
            comments = NoteComment.objects.filter(note__user=user, is_deleted=False)
            serializer = NoteCommentSerializer(comments, many=True)
            return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个评论详情"""
        try:
            comment = NoteComment.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if comment.note.is_public or comment.note.user == request.user or comment.user == request.user:
                serializer = NoteCommentSerializer(comment)
                return Response(serializer.data)
            else:
                return Response(
                    {"detail": "您没有权限查看此评论"},
                    status=status.HTTP_403_FORBIDDEN
                )
        except NoteComment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建评论"""
        serializer = NoteCommentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取笔记
            note_id = request.data.get('note')
            try:
                note = Note.objects.get(id=note_id)
                # 检查是否可以评论
                if not note.is_public and note.user != request.user:
                    return Response(
                        {"detail": "您没有权限评论此笔记"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 检查父评论
            parent_id = request.data.get('parent')
            parent = None
            if parent_id:
                try:
                    parent = NoteComment.objects.get(id=parent_id, is_deleted=False)
                    # 检查父评论是否属于同一笔记
                    if parent.note.id != note.id:
                        return Response(
                            {"detail": "父评论不属于此笔记"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except NoteComment.DoesNotExist:
                    return Response(
                        {"detail": "父评论不存在或已删除"},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # 创建评论
            comment = NoteComment(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                content=request.data.get('content'),
                parent=parent,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            comment.save()

            serializer = NoteCommentSerializer(comment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新评论"""
        try:
            comment = NoteComment.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteCommentSerializer(comment, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新评论内容
                comment.content = request.data.get('content', comment.content)
                comment.updated_at = timezone.now()
                comment.save()

                serializer = NoteCommentSerializer(comment)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteComment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除评论"""
        try:
            comment = NoteComment.objects.get(id=pk, user=request.user, is_deleted=False)
            comment.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteComment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """回复评论"""
        try:
            parent_comment = NoteComment.objects.get(id=pk, is_deleted=False)

            # 检查是否可以评论
            note = parent_comment.note
            if not note.is_public and note.user != request.user:
                return Response(
                    {"detail": "您没有权限评论此笔记"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 创建回复
            content = request.data.get('content')
            if not content:
                return Response(
                    {"detail": "评论内容不能为空"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            reply = NoteComment(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                content=content,
                parent=parent_comment,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            reply.save()

            serializer = NoteCommentSerializer(reply)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except NoteComment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"回复评论失败: {str(e)}")
            return Response(
                {'error': f'回复评论失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def my_comments(self, request):
        """获取我的评论"""
        try:
            comments = NoteComment.objects.filter(user=request.user, is_deleted=False)
            serializer = NoteCommentSerializer(comments, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取我的评论失败: {str(e)}")
            return Response(
                {'error': f'获取我的评论失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )