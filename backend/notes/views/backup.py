"""
笔记备份视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteBackup
from notes.serializers import NoteBackupSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class NoteBackupViewSet(viewsets.ModelViewSet):
    """
    笔记备份视图集
    """
    serializer_class = NoteBackupSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        note_id = self.request.query_params.get('note_id')
        if note_id:
            return NoteBackup.objects.filter(note__user=user, note_id=note_id)
        return NoteBackup.objects.filter(note__user=user)
    
    def perform_create(self, serializer):
        """创建备份时设置创建时间"""
        serializer.save(created_at=timezone.now())
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复备份"""
        backup = self.get_object()
        try:
            # 创建新备份
            new_backup = NoteBackup.objects.create(
                note=backup.note,
                content=backup.note.content,
                created_at=timezone.now()
            )
            
            # 恢复内容
            backup.note.content = backup.content
            backup.note.save()
            
            return Response({
                'message': '备份恢复成功',
                'new_backup_id': new_backup.id
            })
        except Exception as e:
            logger.error(f"恢复备份失败: {str(e)}")
            return Response(
                {'error': '恢复备份失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def export(self, request):
        """导出备份"""
        try:
            note_id = request.data.get('note_id')
            if not note_id:
                return Response(
                    {'error': '缺少note_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 获取笔记的所有备份
            backups = NoteBackup.objects.filter(note_id=note_id)
            
            # 创建导出目录
            export_dir = f'backups/{note_id}'
            os.makedirs(export_dir, exist_ok=True)
            
            # 导出每个备份
            for backup in backups:
                filename = f'{backup.created_at.strftime("%Y%m%d_%H%M%S")}.json'
                filepath = os.path.join(export_dir, filename)
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(backup.content)
            
            return Response({
                'message': '备份导出成功',
                'export_dir': export_dir
            })
        except Exception as e:
            logger.error(f"备份导出失败: {str(e)}")
            return Response(
                {'error': '备份导出失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def import_backup(self, request):
        """导入备份"""
        try:
            note_id = request.data.get('note_id')
            file = request.FILES.get('file')
            
            if not note_id or not file:
                return Response(
                    {'error': '缺少必要参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 读取文件内容
            content = file.read().decode('utf-8')
            
            # 创建备份
            backup = NoteBackup.objects.create(
                note_id=note_id,
                content=content,
                created_at=timezone.now()
            )
            
            return Response({
                'message': '备份导入成功',
                'backup_id': backup.id
            })
        except Exception as e:
            logger.error(f"备份导入失败: {str(e)}")
            return Response(
                {'error': '备份导入失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 