"""
笔记协作视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteCollaboration, Note
from notes.serializers import NoteCollaborationSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import uuid

logger = logging.getLogger(__name__)

class NoteCollaborationViewSet(viewsets.ViewSet):
    """
    笔记协作视图集
    """
    serializer_class = NoteCollaborationSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取协作列表"""
        user = request.user
        note_id = request.query_params.get('note_id')

        if note_id:
            # 获取指定笔记的协作
            collaborations = NoteCollaboration.objects.filter(owner=user, note=note_id, is_active=True)
        else:
            # 获取用户所有笔记的协作
            collaborations = NoteCollaboration.objects.filter(owner=user, is_active=True)

        serializer = NoteCollaborationSerializer(collaborations, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个协作详情"""
        try:
            collaboration = NoteCollaboration.objects.get(id=pk, is_active=True)
            # 检查权限
            if collaboration.owner == request.user or collaboration.collaborator == request.user:
                serializer = NoteCollaborationSerializer(collaboration)
                return Response(serializer.data)
            else:
                return Response(
                    {"detail": "您没有权限查看此协作"},
                    status=status.HTTP_403_FORBIDDEN
                )
        except NoteCollaboration.DoesNotExist:
            return Response(
                {"detail": "协作不存在或已失效"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建协作"""
        serializer = NoteCollaborationSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取笔记
            note_id = request.data.get('note')
            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在或您没有权限"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 获取协作者
            collaborator_id = request.data.get('collaborator')
            try:
                from users.mongodb_models import User
                collaborator = User.objects.get(id=collaborator_id)
            except User.DoesNotExist:
                return Response(
                    {"detail": "协作者不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 检查是否已存在协作
            existing = NoteCollaboration.objects.filter(
                note=note,
                owner=request.user,
                collaborator=collaborator,
                is_active=True
            ).first()

            if existing:
                return Response(
                    {"detail": "已存在与该用户的协作"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 创建协作
            collaboration = NoteCollaboration(
                id=uuid.uuid4(),
                note=note,
                owner=request.user,
                collaborator=collaborator,
                permission=request.data.get('permission', 'view'),
                is_active=True,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            collaboration.save()

            serializer = NoteCollaborationSerializer(collaboration)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新协作"""
        try:
            collaboration = NoteCollaboration.objects.get(id=pk, owner=request.user, is_active=True)
            serializer = NoteCollaborationSerializer(collaboration, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新权限
                collaboration.permission = request.data.get('permission', collaboration.permission)
                collaboration.updated_at = timezone.now()
                collaboration.save()

                serializer = NoteCollaborationSerializer(collaboration)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteCollaboration.DoesNotExist:
            return Response(
                {"detail": "协作不存在或已失效"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除协作"""
        try:
            collaboration = NoteCollaboration.objects.get(id=pk, owner=request.user, is_active=True)
            collaboration.is_active = False
            collaboration.updated_at = timezone.now()
            collaboration.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteCollaboration.DoesNotExist:
            return Response(
                {"detail": "协作不存在或已失效"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def my_collaborations(self, request):
        """获取我参与的协作"""
        try:
            # 查找我作为协作者的协作
            collaborations = NoteCollaboration.objects.filter(
                collaborator=request.user,
                is_active=True
            )
            serializer = NoteCollaborationSerializer(collaborations, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取协作列表失败: {str(e)}")
            return Response(
                {'error': f'获取协作列表失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )