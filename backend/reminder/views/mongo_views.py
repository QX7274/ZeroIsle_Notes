"""
提醒MongoDB视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
import logging

from reminder.mongodb_models import Reminder, ReminderNotification
from reminder.serializers.mongo_serializers import MongoReminderSerializer, MongoReminderNotificationSerializer

logger = logging.getLogger(__name__)

class MongoReminderViewSet(viewsets.ViewSet):
    """
    提醒MongoDB视图集
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """获取查询集"""
        return Reminder.objects(user=self.request.user)
    
    def list(self, request):
        """列出所有提醒"""
        # 获取过滤参数
        is_completed = request.query_params.get('is_completed')
        is_enabled = request.query_params.get('is_enabled')
        priority = request.query_params.get('priority')
        search = request.query_params.get('search')
        
        # 构建查询
        queryset = self.get_queryset()
        if is_completed is not None:
            queryset = queryset.filter(is_completed=is_completed == 'true')
        if is_enabled is not None:
            queryset = queryset.filter(is_enabled=is_enabled == 'true')
        if priority:
            queryset = queryset.filter(priority=priority)
        if search:
            queryset = queryset.filter(title__icontains=search)
        
        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size
        
        # 序列化
        serializer = MongoReminderSerializer(queryset[start:end], many=True)
        
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })
    
    def retrieve(self, request, pk=None):
        """获取单个提醒"""
        try:
            reminder = Reminder.objects.get(id=pk, user=request.user)
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Reminder.DoesNotExist:
            return Response({'error': '提醒不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取提醒失败: {str(e)}")
            return Response({'error': f'获取提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def create(self, request):
        """创建提醒"""
        serializer = MongoReminderSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            try:
                reminder = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建提醒失败: {str(e)}")
                return Response({'error': f'创建提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, pk=None):
        """更新提醒"""
        try:
            reminder = Reminder.objects.get(id=pk, user=request.user)
            serializer = MongoReminderSerializer(reminder, data=request.data, context={'request': request})
            if serializer.is_valid():
                try:
                    reminder = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新提醒失败: {str(e)}")
                    return Response({'error': f'更新提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Reminder.DoesNotExist:
            return Response({'error': '提醒不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取提醒失败: {str(e)}")
            return Response({'error': f'获取提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def partial_update(self, request, pk=None):
        """部分更新提醒"""
        try:
            reminder = Reminder.objects.get(id=pk, user=request.user)
            serializer = MongoReminderSerializer(reminder, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                try:
                    reminder = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新提醒失败: {str(e)}")
                    return Response({'error': f'更新提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Reminder.DoesNotExist:
            return Response({'error': '提醒不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取提醒失败: {str(e)}")
            return Response({'error': f'获取提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def destroy(self, request, pk=None):
        """删除提醒"""
        try:
            reminder = Reminder.objects.get(id=pk, user=request.user)
            
            # 删除相关通知
            ReminderNotification.objects(reminder=reminder).delete()
            
            reminder.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Reminder.DoesNotExist:
            return Response({'error': '提醒不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除提醒失败: {str(e)}")
            return Response({'error': f'删除提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """完成提醒"""
        try:
            reminder = Reminder.objects.get(id=pk, user=request.user)
            reminder.complete()
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Reminder.DoesNotExist:
            return Response({'error': '提醒不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"完成提醒失败: {str(e)}")
            return Response({'error': f'完成提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def enable(self, request, pk=None):
        """启用提醒"""
        try:
            reminder = Reminder.objects.get(id=pk, user=request.user)
            reminder.is_enabled = True
            reminder.save()
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Reminder.DoesNotExist:
            return Response({'error': '提醒不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"启用提醒失败: {str(e)}")
            return Response({'error': f'启用提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        """禁用提醒"""
        try:
            reminder = Reminder.objects.get(id=pk, user=request.user)
            reminder.is_enabled = False
            reminder.save()
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Reminder.DoesNotExist:
            return Response({'error': '提醒不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"禁用提醒失败: {str(e)}")
            return Response({'error': f'禁用提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """获取今日提醒"""
        try:
            # 获取今天的开始和结束时间
            today = timezone.now().date()
            start_of_day = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
            end_of_day = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.max.time()))
            
            # 查询今日提醒
            reminders = Reminder.objects(
                user=request.user,
                due_date__gte=start_of_day,
                due_date__lte=end_of_day,
                is_completed=False,
                is_enabled=True
            )
            
            serializer = MongoReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取今日提醒失败: {str(e)}")
            return Response({'error': f'获取今日提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """获取即将到来的提醒"""
        try:
            # 获取当前时间
            now = timezone.now()
            
            # 查询即将到来的提醒
            reminders = Reminder.objects(
                user=request.user,
                due_date__gte=now,
                is_completed=False,
                is_enabled=True
            ).order_by('due_date')[:10]
            
            serializer = MongoReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取即将到来的提醒失败: {str(e)}")
            return Response({'error': f'获取即将到来的提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """获取过期提醒"""
        try:
            # 获取当前时间
            now = timezone.now()
            
            # 查询过期提醒
            reminders = Reminder.objects(
                user=request.user,
                due_date__lt=now,
                is_completed=False,
                is_enabled=True
            ).order_by('-due_date')
            
            serializer = MongoReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取过期提醒失败: {str(e)}")
            return Response({'error': f'获取过期提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MongoReminderNotificationViewSet(viewsets.ViewSet):
    """
    提醒通知MongoDB视图集
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """获取查询集"""
        # 获取用户的所有提醒
        user_reminders = Reminder.objects(user=self.request.user)
        
        # 获取这些提醒的所有通知
        return ReminderNotification.objects(reminder__in=user_reminders)
    
    def list(self, request):
        """列出所有通知"""
        # 获取过滤参数
        status_filter = request.query_params.get('status')
        
        # 构建查询
        queryset = self.get_queryset()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size
        
        # 序列化
        serializer = MongoReminderNotificationSerializer(queryset[start:end], many=True)
        
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })
    
    def retrieve(self, request, pk=None):
        """获取单个通知"""
        try:
            notification = ReminderNotification.objects.get(id=pk)
            
            # 验证用户是否有权限访问该通知
            if notification.reminder.user != request.user:
                return Response({'error': '无权访问该通知'}, status=status.HTTP_403_FORBIDDEN)
            
            serializer = MongoReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except ReminderNotification.DoesNotExist:
            return Response({'error': '通知不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取通知失败: {str(e)}")
            return Response({'error': f'获取通知失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def mark_as_sent(self, request, pk=None):
        """标记为已发送"""
        try:
            notification = ReminderNotification.objects.get(id=pk)
            
            # 验证用户是否有权限访问该通知
            if notification.reminder.user != request.user:
                return Response({'error': '无权访问该通知'}, status=status.HTTP_403_FORBIDDEN)
            
            notification.status = 'sent'
            notification.sent_time = timezone.now()
            notification.save()
            
            serializer = MongoReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except ReminderNotification.DoesNotExist:
            return Response({'error': '通知不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"标记通知为已发送失败: {str(e)}")
            return Response({'error': f'标记通知为已发送失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def mark_as_failed(self, request, pk=None):
        """标记为发送失败"""
        try:
            notification = ReminderNotification.objects.get(id=pk)
            
            # 验证用户是否有权限访问该通知
            if notification.reminder.user != request.user:
                return Response({'error': '无权访问该通知'}, status=status.HTTP_403_FORBIDDEN)
            
            notification.status = 'failed'
            notification.error_message = request.data.get('error_message', '')
            notification.save()
            
            serializer = MongoReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except ReminderNotification.DoesNotExist:
            return Response({'error': '通知不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"标记通知为发送失败失败: {str(e)}")
            return Response({'error': f'标记通知为发送失败失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """获取待发送通知"""
        try:
            # 获取当前时间
            now = timezone.now()
            
            # 获取用户的所有提醒
            user_reminders = Reminder.objects(user=request.user)
            
            # 查询待发送通知
            notifications = ReminderNotification.objects(
                reminder__in=user_reminders,
                status='pending',
                scheduled_time__lte=now
            ).order_by('scheduled_time')
            
            serializer = MongoReminderNotificationSerializer(notifications, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取待发送通知失败: {str(e)}")
            return Response({'error': f'获取待发送通知失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
