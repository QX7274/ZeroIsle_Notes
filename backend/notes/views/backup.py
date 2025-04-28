"""
笔记备份视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteBackup, Note
from notes.serializers import NoteBackupSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
import json
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

class NoteBackupViewSet(viewsets.ViewSet):
    """
    笔记备份视图集
    """
    serializer_class = NoteBackupSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取备份列表"""
        user = request.user
        note_id = request.query_params.get('note_id')

        if note_id:
            # 获取指定笔记的备份
            try:
                note = Note.objects.get(id=note_id)
                if note.user != user:
                    return Response(
                        {"detail": "您没有权限查看此笔记的备份"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                backups = NoteBackup.objects.filter(note=note, is_deleted=False)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # 获取用户所有笔记的备份
            backups = NoteBackup.objects.filter(user=user, is_deleted=False)

        serializer = NoteBackupSerializer(backups, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个备份详情"""
        try:
            backup = NoteBackup.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if backup.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此备份"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = NoteBackupSerializer(backup)
            return Response(serializer.data)
        except NoteBackup.DoesNotExist:
            return Response(
                {"detail": "备份不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建备份"""
        serializer = NoteBackupSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取笔记
            note_id = request.data.get('note')
            try:
                note = Note.objects.get(id=note_id)
                if note.user != request.user:
                    return Response(
                        {"detail": "您没有权限备份此笔记"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 创建备份
            backup = NoteBackup(
                id=uuid.uuid4(),
                user=request.user,
                note=note,
                title=note.title,
                content=note.content,
                backup_type=request.data.get('backup_type', 'manual'),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 处理备份文件
            backup_file = request.FILES.get('backup_file')
            if backup_file:
                backup.backup_file.put(backup_file, content_type=backup_file.content_type)

            backup.save()

            serializer = NoteBackupSerializer(backup)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """删除备份"""
        try:
            backup = NoteBackup.objects.get(id=pk, user=request.user, is_deleted=False)
            backup.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteBackup.DoesNotExist:
            return Response(
                {"detail": "备份不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复备份"""
        try:
            backup = NoteBackup.objects.get(id=pk, user=request.user, is_deleted=False)

            # 创建新备份保存当前内容
            new_backup = NoteBackup(
                id=uuid.uuid4(),
                user=request.user,
                note=backup.note,
                title=backup.note.title,
                content=backup.note.content,
                backup_type='auto',
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            new_backup.save()

            # 恢复内容
            backup.note.title = backup.title
            backup.note.content = backup.content
            backup.note.updated_at = timezone.now()
            backup.note.save()

            return Response({
                'message': '备份恢复成功',
                'new_backup_id': str(new_backup.id)
            })
        except NoteBackup.DoesNotExist:
            return Response(
                {"detail": "备份不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"恢复备份失败: {str(e)}")
            return Response(
                {'error': f'恢复备份失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def export(self, request):
        """导出备份"""
        try:
            note_id = request.data.get('note')
            if not note_id:
                return Response(
                    {'error': '缺少note参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取笔记
            try:
                note = Note.objects.get(id=note_id)
                if note.user != request.user:
                    return Response(
                        {"detail": "您没有权限导出此笔记的备份"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 获取笔记的所有备份
            backups = NoteBackup.objects.filter(note=note, is_deleted=False)

            # 创建导出目录
            export_dir = f'media/backups/{note_id}'
            os.makedirs(export_dir, exist_ok=True)

            # 导出每个备份
            exported_files = []
            for backup in backups:
                filename = f'{backup.created_at.strftime("%Y%m%d_%H%M%S")}.json'
                filepath = os.path.join(export_dir, filename)

                # 准备导出数据
                export_data = {
                    'id': str(backup.id),
                    'title': backup.title,
                    'content': backup.content,
                    'backup_type': backup.backup_type,
                    'created_at': backup.created_at.isoformat()
                }

                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(export_data, f, ensure_ascii=False, indent=2)

                exported_files.append(filepath)

            return Response({
                'message': '备份导出成功',
                'export_dir': export_dir,
                'exported_files': exported_files
            })
        except Exception as e:
            logger.error(f"备份导出失败: {str(e)}")
            return Response(
                {'error': f'备份导出失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def import_backup(self, request):
        """导入备份"""
        try:
            note_id = request.data.get('note')
            file = request.FILES.get('file')

            if not note_id or not file:
                return Response(
                    {'error': '缺少必要参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取笔记
            try:
                note = Note.objects.get(id=note_id)
                if note.user != request.user:
                    return Response(
                        {"detail": "您没有权限导入备份到此笔记"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 读取文件内容
            try:
                content = file.read().decode('utf-8')
                backup_data = json.loads(content)

                # 创建备份
                backup = NoteBackup(
                    id=uuid.uuid4(),
                    user=request.user,
                    note=note,
                    title=backup_data.get('title', note.title),
                    content=backup_data.get('content', ''),
                    backup_type='manual',
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )

                # 保存备份文件
                backup.backup_file.put(file, content_type=file.content_type)
                backup.save()

                return Response({
                    'message': '备份导入成功',
                    'backup_id': str(backup.id)
                })
            except json.JSONDecodeError:
                return Response(
                    {'error': '无效的备份文件格式'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"备份导入失败: {str(e)}")
            return Response(
                {'error': f'备份导入失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def auto_backup(self, request):
        """自动备份"""
        try:
            note_id = request.data.get('note')
            if not note_id:
                return Response(
                    {'error': '缺少note参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取笔记
            try:
                note = Note.objects.get(id=note_id)
                if note.user != request.user:
                    return Response(
                        {"detail": "您没有权限备份此笔记"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 创建自动备份
            backup = NoteBackup(
                id=uuid.uuid4(),
                user=request.user,
                note=note,
                title=note.title,
                content=note.content,
                backup_type='auto',
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            backup.save()

            return Response({
                'message': '自动备份成功',
                'backup_id': str(backup.id)
            })
        except Exception as e:
            logger.error(f"自动备份失败: {str(e)}")
            return Response(
                {'error': f'自动备份失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )