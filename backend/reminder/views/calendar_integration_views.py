"""
提醒日历集成视图
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reminder.models import Reminder
from reminder.mongodb_models import Reminder as MongoReminder
from reminder.serializers import ReminderSerializer, ReminderCalendarIntegrationSerializer
from reminder.services.reminder_service import ReminderService

import logging

logger = logging.getLogger('backend')

class ReminderCalendarIntegrationView(APIView):
    """
    提醒日历集成视图
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        """
        更新提醒的日历集成信息
        """
        try:
            # 获取提醒
            try:
                reminder = Reminder.objects.get(pk=pk, user=request.user)
            except Reminder.DoesNotExist:
                return Response(
                    {'error': '提醒不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
            # 验证数据
            serializer = ReminderCalendarIntegrationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # 更新提醒的日历集成信息
            reminder.calendar_event_id = serializer.validated_data.get('calendar_event_id')
            reminder.calendar_id = serializer.validated_data.get('calendar_id')
            reminder.save()
            
            # 返回更新后的提醒
            return Response(
                ReminderSerializer(reminder).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"更新提醒日历集成信息失败: {e}")
            return Response(
                {'error': f'更新提醒日历集成信息失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MongoReminderCalendarIntegrationView(APIView):
    """
    MongoDB提醒日历集成视图
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        """
        更新提醒的日历集成信息
        """
        try:
            # 获取提醒
            try:
                reminder = MongoReminder.objects.get(id=pk, user=request.user.id)
            except MongoReminder.DoesNotExist:
                return Response(
                    {'error': '提醒不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
            # 验证数据
            serializer = ReminderCalendarIntegrationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # 更新提醒的日历集成信息
            reminder.calendar_event_id = serializer.validated_data.get('calendar_event_id')
            reminder.calendar_id = serializer.validated_data.get('calendar_id')
            reminder.save()
            
            # 返回更新后的提醒
            return Response(
                {
                    'id': str(reminder.id),
                    'title': reminder.title,
                    'description': reminder.description,
                    'due_date': reminder.due_date.isoformat(),
                    'calendar_event_id': reminder.calendar_event_id,
                    'calendar_id': reminder.calendar_id,
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"更新MongoDB提醒日历集成信息失败: {e}")
            return Response(
                {'error': f'更新提醒日历集成信息失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_reminder_to_calendar(request, pk=None):
    """
    将提醒同步到日历
    """
    try:
        # 获取提醒
        try:
            reminder = Reminder.objects.get(pk=pk, user=request.user)
        except Reminder.DoesNotExist:
            return Response(
                {'error': '提醒不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # 获取日历ID
        calendar_id = request.data.get('calendar_id')
        if not calendar_id:
            return Response(
                {'error': '缺少日历ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 创建提醒服务
        reminder_service = ReminderService()
        
        # 同步提醒到日历
        result = reminder_service.sync_reminder_to_calendar(reminder, calendar_id)
        
        # 返回结果
        return Response(
            result,
            status=status.HTTP_200_OK
        )
    except Exception as e:
        logger.error(f"同步提醒到日历失败: {e}")
        return Response(
            {'error': f'同步提醒到日历失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_reminder_from_calendar(request, pk=None):
    """
    从日历中删除提醒
    """
    try:
        # 获取提醒
        try:
            reminder = Reminder.objects.get(pk=pk, user=request.user)
        except Reminder.DoesNotExist:
            return Response(
                {'error': '提醒不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # 检查提醒是否已同步到日历
        if not reminder.calendar_event_id:
            return Response(
                {'error': '提醒尚未同步到日历'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 创建提醒服务
        reminder_service = ReminderService()
        
        # 从日历中删除提醒
        result = reminder_service.remove_reminder_from_calendar(reminder)
        
        # 返回结果
        return Response(
            result,
            status=status.HTTP_200_OK
        )
    except Exception as e:
        logger.error(f"从日历中删除提醒失败: {e}")
        return Response(
            {'error': f'从日历中删除提醒失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_from_calendar(request):
    """
    从日历导入事件
    """
    try:
        # 获取参数
        calendar_id = request.data.get('calendar_id')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        # 验证参数
        if not calendar_id:
            return Response(
                {'error': '缺少日历ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if not start_date or not end_date:
            return Response(
                {'error': '缺少开始日期或结束日期'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 创建提醒服务
        reminder_service = ReminderService()
        
        # 从日历导入事件
        result = reminder_service.import_from_calendar(
            request.user,
            calendar_id,
            start_date,
            end_date
        )
        
        # 返回结果
        return Response(
            result,
            status=status.HTTP_200_OK
        )
    except Exception as e:
        logger.error(f"从日历导入事件失败: {e}")
        return Response(
            {'error': f'从日历导入事件失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_to_calendar(request):
    """
    导出提醒到日历
    """
    try:
        # 获取参数
        calendar_id = request.data.get('calendar_id')
        reminder_ids = request.data.get('reminder_ids', [])
        
        # 验证参数
        if not calendar_id:
            return Response(
                {'error': '缺少日历ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 创建提醒服务
        reminder_service = ReminderService()
        
        # 导出提醒到日历
        result = reminder_service.export_to_calendar(
            request.user,
            calendar_id,
            reminder_ids
        )
        
        # 返回结果
        return Response(
            result,
            status=status.HTTP_200_OK
        )
    except Exception as e:
        logger.error(f"导出提醒到日历失败: {e}")
        return Response(
            {'error': f'导出提醒到日历失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
