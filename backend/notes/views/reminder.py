"""
笔记提醒视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteReminder, Note
from notes.serializers import NoteReminderSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)

class NoteReminderViewSet(viewsets.ViewSet):
    """
    笔记提醒视图集
    """
    serializer_class = NoteReminderSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取提醒列表"""
        user = request.user
        note_id = request.query_params.get('note_id')

        if note_id:
            # 获取指定笔记的提醒
            try:
                note = Note.objects.get(id=note_id)
                if note.user != user:
                    return Response(
                        {"detail": "您没有权限查看此笔记的提醒"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                reminders = NoteReminder.objects.filter(note=note, is_deleted=False)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # 获取用户所有笔记的提醒
            reminders = NoteReminder.objects.filter(user=user, is_deleted=False)

        serializer = NoteReminderSerializer(reminders, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个提醒详情"""
        try:
            reminder = NoteReminder.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if reminder.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此提醒"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = NoteReminderSerializer(reminder)
            return Response(serializer.data)
        except NoteReminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建提醒"""
        serializer = NoteReminderSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取笔记
            note_id = request.data.get('note')
            try:
                note = Note.objects.get(id=note_id)
                if note.user != request.user:
                    return Response(
                        {"detail": "您没有权限为此笔记创建提醒"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 创建提醒
            reminder = NoteReminder(
                id=uuid.uuid4(),
                user=request.user,
                note=note,
                title=request.data.get('title'),
                content=request.data.get('content', ''),
                remind_at=request.data.get('remind_at'),
                repeat_type=request.data.get('repeat_type', 'none'),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            reminder.save()

            serializer = NoteReminderSerializer(reminder)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新提醒"""
        try:
            reminder = NoteReminder.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteReminderSerializer(reminder, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新基本信息
                reminder.title = request.data.get('title', reminder.title)
                reminder.content = request.data.get('content', reminder.content)
                reminder.remind_at = request.data.get('remind_at', reminder.remind_at)
                reminder.repeat_type = request.data.get('repeat_type', reminder.repeat_type)
                reminder.updated_at = timezone.now()
                reminder.save()

                serializer = NoteReminderSerializer(reminder)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteReminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除提醒"""
        try:
            reminder = NoteReminder.objects.get(id=pk, user=request.user, is_deleted=False)
            reminder.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteReminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def snooze(self, request, pk=None):
        """延迟提醒"""
        try:
            reminder = NoteReminder.objects.get(id=pk, user=request.user, is_deleted=False)
            minutes = request.data.get('minutes', 30)

            # 更新提醒时间
            reminder.remind_at = timezone.now() + timedelta(minutes=int(minutes))
            reminder.updated_at = timezone.now()
            reminder.save()

            return Response({
                'message': '提醒已延迟',
                'new_remind_at': reminder.remind_at
            })
        except NoteReminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"延迟提醒失败: {str(e)}")
            return Response(
                {'error': f'延迟提醒失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """获取即将到来的提醒"""
        try:
            reminders = NoteReminder.objects.filter(
                user=request.user,
                remind_at__gt=timezone.now(),
                is_completed=False,
                is_deleted=False
            ).order_by('remind_at')

            serializer = NoteReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取即将到来的提醒失败: {str(e)}")
            return Response(
                {'error': f'获取即将到来的提醒失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def completed(self, request):
        """获取已完成的提醒"""
        try:
            reminders = NoteReminder.objects.filter(
                user=request.user,
                is_completed=True,
                is_deleted=False
            ).order_by('-completed_at')

            serializer = NoteReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取已完成的提醒失败: {str(e)}")
            return Response(
                {'error': f'获取已完成的提醒失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """标记提醒为已完成"""
        try:
            reminder = NoteReminder.objects.get(id=pk, user=request.user, is_deleted=False)
            reminder.complete()

            serializer = NoteReminderSerializer(reminder)
            return Response({
                'message': '提醒已标记为已完成',
                'reminder': serializer.data
            })
        except NoteReminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"标记提醒为已完成失败: {str(e)}")
            return Response(
                {'error': f'标记提醒为已完成失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def uncomplete(self, request, pk=None):
        """取消标记提醒为已完成"""
        try:
            reminder = NoteReminder.objects.get(id=pk, user=request.user, is_deleted=False)
            reminder.uncomplete()

            serializer = NoteReminderSerializer(reminder)
            return Response({
                'message': '已取消标记提醒为已完成',
                'reminder': serializer.data
            })
        except NoteReminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"取消标记提醒为已完成失败: {str(e)}")
            return Response(
                {'error': f'取消标记提醒为已完成失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )