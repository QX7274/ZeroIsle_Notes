"""
笔记版本视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteVersion, Note
from notes.serializers import NoteVersionSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import timedelta
import uuid

logger = logging.getLogger(__name__)

class NoteVersionViewSet(viewsets.ViewSet):
    """
    笔记版本视图集
    """
    serializer_class = NoteVersionSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取版本列表"""
        user = request.user
        note_id = request.query_params.get('note_id')

        if note_id:
            versions = NoteVersion.objects.filter(note__user=user, note=note_id, is_deleted=False)
        else:
            versions = NoteVersion.objects.filter(user=user, is_deleted=False)

        serializer = NoteVersionSerializer(versions, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个版本详情"""
        try:
            version = NoteVersion.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteVersionSerializer(version)
            return Response(serializer.data)
        except NoteVersion.DoesNotExist:
            return Response(
                {"detail": "版本不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建版本"""
        serializer = NoteVersionSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取笔记
            note_id = request.data.get('note')
            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 获取最新版本号
            latest_version = NoteVersion.objects.filter(note=note).order_by('-version_number').first()
            version_number = 1
            if latest_version:
                version_number = latest_version.version_number + 1

            # 创建版本
            version = NoteVersion(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                title=request.data.get('title', note.title),
                content=request.data.get('content', ''),
                version_number=version_number,
                description=request.data.get('description', ''),
                is_current=request.data.get('is_current', False),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            version.save()

            serializer = NoteVersionSerializer(version)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新版本"""
        try:
            version = NoteVersion.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteVersionSerializer(version, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新描述
                version.description = request.data.get('description', version.description)
                version.is_current = request.data.get('is_current', version.is_current)

                # 如果设置为当前版本，则更新笔记内容
                if version.is_current:
                    version.note.title = version.title
                    version.note.content = version.content
                    version.note.save()

                    # 将其他版本设置为非当前版本
                    NoteVersion.objects.filter(note=version.note, is_current=True).update(is_current=False)
                    version.is_current = True

                version.updated_at = timezone.now()
                version.save()

                serializer = NoteVersionSerializer(version)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteVersion.DoesNotExist:
            return Response(
                {"detail": "版本不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除版本"""
        try:
            version = NoteVersion.objects.get(id=pk, user=request.user, is_deleted=False)
            version.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteVersion.DoesNotExist:
            return Response(
                {"detail": "版本不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复版本"""
        try:
            version = NoteVersion.objects.get(id=pk, user=request.user, is_deleted=False)

            # 创建新版本保存当前内容
            new_version = NoteVersion(
                id=uuid.uuid4(),
                note=version.note,
                user=request.user,
                title=version.note.title,
                content=version.note.content,
                version_number=version.version_number + 1,
                description=f"恢复前的自动备份 - {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            new_version.save()

            # 恢复内容
            version.note.title = version.title
            version.note.content = version.content
            version.note.updated_at = timezone.now()
            version.note.save()

            # 将当前版本设置为当前版本
            NoteVersion.objects.filter(note=version.note, is_current=True).update(is_current=False)
            version.is_current = True
            version.save()

            return Response({
                'message': '版本恢复成功',
                'new_version_id': str(new_version.id)
            })
        except NoteVersion.DoesNotExist:
            return Response(
                {"detail": "版本不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"恢复版本失败: {str(e)}")
            return Response(
                {'error': '恢复版本失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def auto_save(self, request):
        """获取自动保存的版本"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response(
                {'error': '缺少note_id参数'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取最近30分钟内的自动保存版本
            thirty_minutes_ago = timezone.now() - timedelta(minutes=30)
            version = NoteVersion.objects.filter(
                note=note_id,
                user=request.user,
                description__contains='自动保存',
                created_at__gte=thirty_minutes_ago,
                is_deleted=False
            ).order_by('-created_at').first()

            if version:
                serializer = NoteVersionSerializer(version)
                return Response(serializer.data)
            return Response({'message': '没有找到自动保存的版本'})
        except Exception as e:
            logger.error(f"获取自动保存版本失败: {str(e)}")
            return Response(
                {'error': '获取自动保存版本失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def create_auto_save(self, request):
        """创建自动保存版本"""
        note_id = request.data.get('note')
        content = request.data.get('content')
        title = request.data.get('title')

        if not note_id or not content:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取笔记
            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 获取最新版本号
            latest_version = NoteVersion.objects.filter(note=note).order_by('-version_number').first()
            version_number = 1
            if latest_version:
                version_number = latest_version.version_number + 1

            # 创建自动保存版本
            version = NoteVersion(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                title=title or note.title,
                content=content,
                version_number=version_number,
                description=f"自动保存 - {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            version.save()

            serializer = NoteVersionSerializer(version)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建自动保存版本失败: {str(e)}")
            return Response(
                {'error': '创建自动保存版本失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )