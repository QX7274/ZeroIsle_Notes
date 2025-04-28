"""
笔记同步视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteSync, Note
from notes.serializers import NoteSyncSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import timedelta
import uuid

logger = logging.getLogger(__name__)

class NoteSyncViewSet(viewsets.ViewSet):
    """
    笔记同步视图集
    """
    serializer_class = NoteSyncSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取同步记录列表"""
        user = request.user
        device_id = request.query_params.get('device_id')

        if device_id:
            syncs = NoteSync.objects.filter(user=user, device_id=device_id)
        else:
            syncs = NoteSync.objects.filter(user=user)

        serializer = NoteSyncSerializer(syncs, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个同步记录详情"""
        try:
            sync = NoteSync.objects.get(id=pk, user=request.user)
            serializer = NoteSyncSerializer(sync)
            return Response(serializer.data)
        except NoteSync.DoesNotExist:
            return Response(
                {"detail": "同步记录不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建同步记录"""
        serializer = NoteSyncSerializer(data=request.data, context={'request': request})
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

            # 创建同步记录
            sync = NoteSync(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                device_id=request.data.get('device_id'),
                sync_type=request.data.get('sync_type'),
                status='success',
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            sync.save()

            serializer = NoteSyncSerializer(sync)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def sync_all(self, request):
        """同步所有笔记"""
        try:
            device_id = request.data.get('device_id')
            if not device_id:
                return Response(
                    {'error': '缺少device_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取上次同步时间
            last_sync = NoteSync.objects.filter(
                user=request.user,
                device_id=device_id,
                status='success'
            ).order_by('-created_at').first()

            last_sync_time = last_sync.created_at if last_sync else None

            # 获取需要同步的笔记
            if last_sync_time:
                notes = Note.objects.filter(user=request.user, updated_at__gt=last_sync_time, is_deleted=False)
            else:
                notes = Note.objects.filter(user=request.user, is_deleted=False)

            # 创建同步记录
            sync_records = []
            for note in notes:
                sync = NoteSync(
                    id=uuid.uuid4(),
                    note=note,
                    user=request.user,
                    device_id=device_id,
                    sync_type='download',
                    status='success',
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                sync.save()
                sync_records.append(sync)

            return Response({
                'message': '同步成功',
                'notes_count': len(sync_records),
                'sync_time': timezone.now()
            })
        except Exception as e:
            logger.error(f"同步失败: {str(e)}")
            return Response(
                {'error': f'同步失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def sync_status(self, request):
        """获取同步状态"""
        try:
            device_id = request.query_params.get('device_id')
            if not device_id:
                return Response(
                    {'error': '缺少device_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取最近的同步记录
            sync = NoteSync.objects.filter(
                user=request.user,
                device_id=device_id,
                status='success'
            ).order_by('-created_at').first()

            if not sync:
                return Response({'message': '未找到同步记录'})

            # 获取未同步的笔记数量
            unsync_notes_count = Note.objects.filter(
                user=request.user,
                updated_at__gt=sync.created_at,
                is_deleted=False
            ).count()

            return Response({
                'last_sync_at': sync.created_at,
                'sync_status': sync.status,
                'unsync_notes_count': unsync_notes_count
            })
        except Exception as e:
            logger.error(f"获取同步状态失败: {str(e)}")
            return Response(
                {'error': f'获取同步状态失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """上传笔记"""
        try:
            device_id = request.data.get('device_id')
            note_id = request.data.get('note')

            if not device_id or not note_id:
                return Response(
                    {'error': '缺少必要参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取笔记
            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 创建同步记录
            sync = NoteSync(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                device_id=device_id,
                sync_type='upload',
                status='success',
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            sync.save()

            return Response({
                'message': '上传成功',
                'sync_id': str(sync.id),
                'sync_time': sync.created_at
            })
        except Exception as e:
            logger.error(f"上传失败: {str(e)}")
            return Response(
                {'error': f'上传失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def download(self, request):
        """下载笔记"""
        try:
            device_id = request.data.get('device_id')
            note_id = request.data.get('note')

            if not device_id or not note_id:
                return Response(
                    {'error': '缺少必要参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取笔记
            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 创建同步记录
            sync = NoteSync(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                device_id=device_id,
                sync_type='download',
                status='success',
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            sync.save()

            return Response({
                'message': '下载成功',
                'sync_id': str(sync.id),
                'sync_time': sync.created_at
            })
        except Exception as e:
            logger.error(f"下载失败: {str(e)}")
            return Response(
                {'error': f'下载失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )