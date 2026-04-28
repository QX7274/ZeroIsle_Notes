"""
提醒MongoDB视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from django.http import HttpResponse
import logging
import json
import csv
import io
import uuid
from datetime import datetime
from django.http import Http404

from reminder.mongodb_models import Reminder, ReminderNotification
from reminder.serializers.mongo_serializers import MongoReminderSerializer, MongoReminderNotificationSerializer
from common.permissions import IsOwner

logger = logging.getLogger(__name__)

class MongoUserViewSetBase(viewsets.ViewSet):
    """
    一个基础视图集，提供获取 MongoDB 用户和通用权限检查的功能。
    """
    permission_classes = [IsAuthenticated, IsOwner]

    def _get_mongo_user(self, request):
        """
        从请求中获取对应的 MongoDB 用户对象
        优先使用中间件注入的 request.mongo_user
        """
        # 优先使用中间件注入的 mongo_user
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user

        # 降级方案：手动查找（兼容旧代码）
        try:
            from users.mongodb_models import User as MongoUser
            django_user = request.user
            if not django_user or not django_user.is_authenticated:
                return None
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.warning(f"未找到对应的MongoDB用户: {django_user.username}")
            return mongo_user
        except Exception as e:
            logger.error(f"获取 MongoDB 用户失败: {e}", exc_info=True)
            return None

class MongoReminderViewSet(MongoUserViewSetBase):
    """
    提醒MongoDB视图集
    """
    def get_queryset(self):
        """获取当前用户的提醒查询集"""
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return Reminder.objects.none()
        return Reminder.objects(user=mongo_user)

    def get_object(self):
        """获取单个对象并自动检查权限"""
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供提醒ID")

        try:
            # 提醒模型使用 UUIDField 作为主键
            if isinstance(pk, str):
                pk = uuid.UUID(pk)
        except ValueError:
            raise Http404("无效的提醒ID格式")

        queryset = self.get_queryset()
        try:
            obj = queryset.get(id=pk)
        except Reminder.DoesNotExist:
            raise Http404("提醒不存在或无权访问")

        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        """列出所有提醒"""
        # 获取过滤参数
        is_completed = request.query_params.get('is_completed')
        is_enabled = request.query_params.get('is_enabled')
        priority = request.query_params.get('priority')
        category = request.query_params.get('category')
        frequency = request.query_params.get('frequency')
        tag = request.query_params.get('tag')
        search = request.query_params.get('search')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        sort_by = request.query_params.get('sort_by', 'due_date')
        sort_order = request.query_params.get('sort_order', 'asc')

        # 构建查询
        queryset = self.get_queryset()
        if is_completed is not None:
            queryset = queryset.filter(is_completed=is_completed == 'true')
        if is_enabled is not None:
            queryset = queryset.filter(is_enabled=is_enabled == 'true')
        if priority:
            queryset = queryset.filter(priority=priority)
        if category:
            queryset = queryset.filter(category=category)
        if frequency:
            queryset = queryset.filter(frequency=frequency)
        if tag:
            queryset = queryset.filter(tags__contains=tag)
        if search:
            # 支持在标题和描述中搜索
            from mongoengine.queryset.visitor import Q
            queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))

        # 日期范围过滤
        if start_date:
            try:
                from datetime import datetime
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                start_datetime = timezone.make_aware(start_datetime)
                queryset = queryset.filter(due_date__gte=start_datetime)
            except ValueError:
                pass

        if end_date:
            try:
                from datetime import datetime
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                end_datetime = timezone.make_aware(end_datetime.replace(hour=23, minute=59, second=59))
                queryset = queryset.filter(due_date__lte=end_datetime)
            except ValueError:
                pass

        # 排序
        sort_prefix = '-' if sort_order.lower() == 'desc' else ''
        valid_sort_fields = ['due_date', 'priority', 'created_at', 'title']
        if sort_by in valid_sort_fields:
            queryset = queryset.order_by(f'{sort_prefix}{sort_by}')
        else:
            queryset = queryset.order_by(f'{sort_prefix}due_date')

        # 分页 (DRF)
        paginator = PageNumberPagination()
        page_size = request.query_params.get('page_size')
        if page_size:
            try:
                paginator.page_size = int(page_size)
            except Exception:
                pass
        page_qs = paginator.paginate_queryset(queryset, request)

        serializer = MongoReminderSerializer(page_qs, many=True)
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个提醒"""
        try:
            reminder = self.get_object()
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取提醒详情失败: {str(e)}", exc_info=True)
            return Response(
                {"detail": "获取提醒详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建提醒"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = MongoReminderSerializer(data=request.data, context={'request': request, 'user': mongo_user})
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建提醒时发生内部错误: {str(e)}", exc_info=True)
                return Response({"detail": "创建提醒时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.warning(f"创建提醒失败, 验证错误: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新提醒"""
        try:
            reminder = self.get_object()
            serializer = MongoReminderSerializer(reminder, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新提醒时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "更新提醒时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新提醒"""
        try:
            reminder = self.get_object()
            serializer = MongoReminderSerializer(reminder, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"部分更新提醒时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "部分更新提醒时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除提醒"""
        try:
            reminder = self.get_object()

            # 删除相关通知
            ReminderNotification.objects(reminder=reminder).delete()

            reminder.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除提醒时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "删除提醒时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        完成提醒。
        对于重复提醒，可以传入 occurrence_date 来完成单个实例。
        否则，将完成整个系列（主要用于非重复提醒）。
        """
        try:
            reminder = self.get_object()
            occurrence_date_str = request.data.get('occurrence_date')

            if reminder.frequency != 'once' and occurrence_date_str:
                # 完成单个实例
                from reminder.services.reminder_service import ReminderService
                try:
                    occurrence_date = datetime.fromisoformat(occurrence_date_str.replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    return Response({'detail': '无效的 occurrence_date 格式'}, status=status.HTTP_400_BAD_REQUEST)

                reminder = ReminderService.complete_occurrence(reminder, occurrence_date)
            else:
                # 完成整个系列（旧逻辑）
                reminder.complete()

            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"完成提醒时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "完成提醒时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def enable(self, request, pk=None):
        """启用提醒"""
        try:
            reminder = self.get_object()
            reminder.is_enabled = True
            reminder.save()
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"启用提醒时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "启用提醒时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        """禁用提醒"""
        try:
            reminder = self.get_object()
            reminder.is_enabled = False
            reminder.save()
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"禁用提醒时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "禁用提醒时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='cancel-occurrence')
    def cancel_occurrence(self, request, pk=None):
        """取消重复提醒的单个实例。"""
        try:
            reminder = self.get_object()
            occurrence_date_str = request.data.get('occurrence_date')
            if not occurrence_date_str:
                return Response({'detail': '必须提供 occurrence_date'}, status=status.HTTP_400_BAD_REQUEST)

            from reminder.services.reminder_service import ReminderService
            try:
                occurrence_date = datetime.fromisoformat(occurrence_date_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                return Response({'detail': '无效的 occurrence_date 格式'}, status=status.HTTP_400_BAD_REQUEST)

            reminder = ReminderService.cancel_occurrence(reminder, occurrence_date)
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"取消提醒实例时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "取消提醒实例时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='reschedule-occurrence')
    def reschedule_occurrence(self, request, pk=None):
        """延期重复提醒的单个实例。"""
        try:
            reminder = self.get_object()
            occurrence_date_str = request.data.get('occurrence_date')
            new_due_date_str = request.data.get('new_due_date')

            if not all([occurrence_date_str, new_due_date_str]):
                return Response({'detail': '必须提供 occurrence_date 和 new_due_date'}, status=status.HTTP_400_BAD_REQUEST)

            from reminder.services.reminder_service import ReminderService
            try:
                occurrence_date = datetime.fromisoformat(occurrence_date_str.replace('Z', '+00:00'))
                new_due_date = datetime.fromisoformat(new_due_date_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                return Response({'detail': '无效的日期格式'}, status=status.HTTP_400_BAD_REQUEST)

            reminder = ReminderService.reschedule_occurrence(reminder, occurrence_date, new_due_date)
            serializer = MongoReminderSerializer(reminder)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"延期提醒实例时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "延期提醒实例时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """获取今日提醒"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            today = timezone.now().date()
            start_of_day = timezone.make_aware(datetime.combine(today, datetime.min.time()))
            end_of_day = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            reminders = self.get_queryset().filter(
                due_date__gte=start_of_day,
                due_date__lte=end_of_day,
                is_completed=False,
                is_enabled=True
            )
            serializer = MongoReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取今日提醒失败: {e}", exc_info=True)
            return Response({'detail': '获取今日提醒时发生内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """获取即将到来的提醒"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            now = timezone.now()
            reminders = self.get_queryset().filter(
                due_date__gte=now,
                is_completed=False,
                is_enabled=True
            ).order_by('due_date')[:10]
            serializer = MongoReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取即将到来的提醒失败: {e}", exc_info=True)
            return Response({'detail': '获取即将到来的提醒时发生内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """获取过期提醒"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            now = timezone.now()
            reminders = self.get_queryset().filter(
                due_date__lt=now,
                is_completed=False,
                is_enabled=True
            ).order_by('-due_date')
            serializer = MongoReminderSerializer(reminders, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取过期提醒失败: {e}", exc_info=True)
            return Response({'detail': '获取过期提醒时发生内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """获取所有分类"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            user_reminders = self.get_queryset()
            categories = user_reminders.distinct('category')
            category_list = []
            for category in categories:
                if not category:
                    continue
                count = user_reminders.filter(category=category).count()
                category_display = dict(Reminder.CATEGORY_CHOICES).get(category, category)
                category_list.append({'id': category, 'name': category_display, 'count': count})

            existing_categories = {c['id'] for c in category_list}
            for category_id, category_name in Reminder.CATEGORY_CHOICES:
                if category_id not in existing_categories:
                    category_list.append({'id': category_id, 'name': category_name, 'count': 0})

            return Response(category_list)
        except Exception as e:
            logger.error(f"获取分类失败: {e}", exc_info=True)
            return Response({'detail': '获取分类时发生内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def tags(self, request):
        """获取所有标签"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            user_reminders = self.get_queryset()
            all_tags = []
            for reminder in user_reminders:
                if hasattr(reminder, 'tags') and reminder.tags:
                    tags = [tag.strip() for tag in reminder.tags.split(',') if tag.strip()]
                    all_tags.extend(tags)

            from collections import Counter
            tag_counter = Counter(all_tags)
            tag_list = [{'name': tag, 'count': count} for tag, count in tag_counter.most_common()]
            return Response(tag_list)
        except Exception as e:
            logger.error(f"获取标签失败: {e}", exc_info=True)
            return Response({'detail': '获取标签时发生内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取提醒统计信息"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            user_reminders = self.get_queryset()
            now = timezone.now()

            total_count = user_reminders.count()
            completed_count = user_reminders.filter(is_completed=True).count()
            active_reminders = user_reminders.filter(is_completed=False, is_enabled=True)
            active_count = active_reminders.count()
            overdue_count = active_reminders.filter(due_date__lt=now).count()

            today = now.date()
            start_of_day = timezone.make_aware(datetime.combine(today, datetime.min.time()))
            end_of_day = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            today_count = active_reminders.filter(due_date__gte=start_of_day, due_date__lte=end_of_day).count()

            priority_stats = {pid: {'name': name, 'count': active_reminders.filter(priority=pid).count()} for pid, name in Reminder.PRIORITY_CHOICES}
            category_stats = {cid: {'name': name, 'count': active_reminders.filter(category=cid).count()} for cid, name in Reminder.CATEGORY_CHOICES}
            frequency_stats = {fid: {'name': name, 'count': active_reminders.filter(frequency=fid).count()} for fid, name in Reminder.FREQUENCY_CHOICES}

            statistics = {
                'total': total_count,
                'completed': completed_count,
                'active': active_count,
                'overdue': overdue_count,
                'today': today_count,
                'completion_rate': round(completed_count / total_count * 100, 2) if total_count > 0 else 0,
                'priorities': priority_stats,
                'categories': category_stats,
                'frequencies': frequency_stats
            }
            return Response(statistics)
        except Exception as e:
            logger.error(f"获取统计信息失败: {e}", exc_info=True)
            return Response({'detail': '获取统计信息时发生内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """获取日历视图数据"""
        try:
            # 获取月份参数
            year = int(request.query_params.get('year', timezone.now().year))
            month = int(request.query_params.get('month', timezone.now().month))

            # 获取该月的开始和结束时间
            import calendar
            from datetime import datetime

            # 获取该月的第一天和最后一天
            first_day = datetime(year, month, 1)
            last_day = datetime(year, month, calendar.monthrange(year, month)[1])

            # 转换为时区感知的datetime
            start_of_month = timezone.make_aware(first_day.replace(hour=0, minute=0, second=0))
            end_of_month = timezone.make_aware(last_day.replace(hour=23, minute=59, second=59))

            # 获取用户在该月的所有提醒
            reminders = Reminder.objects(
                user=request.user,
                due_date__gte=start_of_month,
                due_date__lte=end_of_month
            )

            # 按日期分组
            calendar_data = {}
            for reminder in reminders:
                day = reminder.due_date.day
                if day not in calendar_data:
                    calendar_data[day] = []

                calendar_data[day].append({
                    'id': str(reminder.id),
                    'title': reminder.title,
                    'priority': reminder.priority,
                    'category': getattr(reminder, 'category', 'other'),
                    'is_completed': reminder.is_completed,
                    'color': getattr(reminder, 'color', '#3498db')
                })

            return Response(calendar_data)
        except Exception as e:
            logger.error(f"获取日历数据失败: {str(e)}")
            return Response({'error': f'获取日历数据失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def day(self, request):
        """获取某一天的提醒"""
        try:
            # 获取日期参数
            year = int(request.query_params.get('year', timezone.now().year))
            month = int(request.query_params.get('month', timezone.now().month))
            day = int(request.query_params.get('day', timezone.now().day))

            # 获取该天的开始和结束时间
            from datetime import datetime

            # 创建日期对象
            date_obj = datetime(year, month, day)

            # 转换为时区感知的datetime
            start_of_day = timezone.make_aware(date_obj.replace(hour=0, minute=0, second=0))
            end_of_day = timezone.make_aware(date_obj.replace(hour=23, minute=59, second=59))

            # 获取用户在该天的所有提醒
            reminders = Reminder.objects(
                user=request.user,
                due_date__gte=start_of_day,
                due_date__lte=end_of_day
            ).order_by('due_date')

            # 序列化提醒数据
            serializer = MongoReminderSerializer(reminders, many=True)

            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取日期提醒失败: {str(e)}")
            return Response({'error': f'获取日期提醒失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """导出提醒数据"""
        try:
            # 获取过滤参数
            format_type = request.query_params.get('format', 'json')
            include_completed = request.query_params.get('include_completed', 'false') == 'true'

            # 获取用户的提醒
            queryset = self.get_queryset()
            if not include_completed:
                queryset = queryset.filter(is_completed=False)

            # 序列化数据
            reminders_data = []
            for reminder in queryset:
                data = {
                    'title': reminder.title,
                    'description': reminder.description or '',
                    'due_date': reminder.due_date.isoformat(),
                    'priority': reminder.priority,
                    'frequency': reminder.frequency,
                    'category': getattr(reminder, 'category', 'other'),
                    'color': getattr(reminder, 'color', '#3498db'),
                    'tags': getattr(reminder, 'tags', ''),
                    'is_completed': reminder.is_completed,
                    'is_enabled': reminder.is_enabled
                }

                if reminder.completed_at:
                    data['completed_at'] = reminder.completed_at.isoformat()

                if hasattr(reminder, 'repeat_end_date') and reminder.repeat_end_date:
                    data['repeat_end_date'] = reminder.repeat_end_date.isoformat()

                reminders_data.append(data)

            # 根据格式导出
            if format_type == 'csv':
                # 创建CSV响应
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = f'attachment; filename="reminders_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'

                # 创建CSV写入器
                csv_buffer = io.StringIO()
                writer = csv.DictWriter(csv_buffer, fieldnames=reminders_data[0].keys() if reminders_data else [])

                # 写入表头
                writer.writeheader()

                # 写入数据
                for reminder in reminders_data:
                    writer.writerow(reminder)

                # 写入响应
                response.write(csv_buffer.getvalue())
                return response
            else:
                # 创建JSON响应
                response = HttpResponse(json.dumps(reminders_data, ensure_ascii=False), content_type='application/json')
                response['Content-Disposition'] = f'attachment; filename="reminders_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
                return response
        except Exception as e:
            logger.error(f"导出提醒数据失败: {str(e)}")
            return Response({'error': f'导出提醒数据失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def import_data(self, request):
        """导入提醒数据"""
        try:
            # 获取导入数据
            import_data = request.data.get('data')
            if not import_data:
                return Response({'error': '导入数据不能为空'}, status=status.HTTP_400_BAD_REQUEST)

            # 解析数据
            if isinstance(import_data, str):
                try:
                    import_data = json.loads(import_data)
                except json.JSONDecodeError:
                    return Response({'error': '导入数据格式错误'}, status=status.HTTP_400_BAD_REQUEST)

            # 验证数据
            if not isinstance(import_data, list):
                return Response({'error': '导入数据必须是列表'}, status=status.HTTP_400_BAD_REQUEST)

            # 导入数据
            imported_count = 0
            errors = []

            for item in import_data:
                try:
                    # 验证必填字段
                    if not item.get('title'):
                        errors.append(f"标题不能为空: {item}")
                        continue

                    if not item.get('due_date'):
                        errors.append(f"到期时间不能为空: {item}")
                        continue

                    # 解析日期
                    try:
                        due_date = datetime.fromisoformat(item['due_date'])
                        due_date = timezone.make_aware(due_date) if timezone.is_naive(due_date) else due_date
                    except (ValueError, TypeError):
                        errors.append(f"到期时间格式错误: {item}")
                        continue

                    # 解析重复结束时间
                    repeat_end_date = None
                    if item.get('repeat_end_date'):
                        try:
                            repeat_end_date = datetime.fromisoformat(item['repeat_end_date'])
                            repeat_end_date = timezone.make_aware(repeat_end_date) if timezone.is_naive(repeat_end_date) else repeat_end_date
                        except (ValueError, TypeError):
                            errors.append(f"重复结束时间格式错误: {item}")
                            continue

                    # 创建提醒
                    reminder = Reminder(
                        user=request.user,
                        title=item['title'],
                        description=item.get('description', ''),
                        due_date=due_date,
                        priority=item.get('priority', 'medium'),
                        frequency=item.get('frequency', 'once'),
                        category=item.get('category', 'other'),
                        color=item.get('color', '#3498db'),
                        tags=item.get('tags', ''),
                        is_completed=item.get('is_completed', False),
                        is_enabled=item.get('is_enabled', True),
                        repeat_end_date=repeat_end_date,
                        created_at=timezone.now(),
                        updated_at=timezone.now()
                    )

                    # 如果已完成，设置完成时间
                    if reminder.is_completed and item.get('completed_at'):
                        try:
                            completed_at = datetime.fromisoformat(item['completed_at'])
                            completed_at = timezone.make_aware(completed_at) if timezone.is_naive(completed_at) else completed_at
                            reminder.completed_at = completed_at
                        except (ValueError, TypeError):
                            # 使用当前时间
                            reminder.completed_at = timezone.now()

                    # 保存提醒
                    reminder.save()

                    # 如果未完成且已启用，创建通知
                    if not reminder.is_completed and reminder.is_enabled:
                        notification = ReminderNotification(
                            reminder=reminder,
                            scheduled_time=reminder.due_date,
                            status='pending'
                        )
                        notification.save()

                    imported_count += 1
                except Exception as e:
                    errors.append(f"导入提醒失败: {item}, 错误: {str(e)}")

            return Response({
                'success': True,
                'imported_count': imported_count,
                'errors': errors
            })
        except Exception as e:
            logger.error(f"导入提醒数据失败: {str(e)}")
            return Response({'error': f'导入提醒数据失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MongoReminderNotificationViewSet(MongoUserViewSetBase):
    """
    提醒通知MongoDB视图集
    """
    def get_queryset(self):
        """获取当前用户的提醒通知查询集"""
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return ReminderNotification.objects.none()

        # 首先找到用户的所有提醒，然后获取与这些提醒关联的通知
        user_reminders = Reminder.objects(user=mongo_user)
        return ReminderNotification.objects(reminder__in=user_reminders)

    def get_object(self):
        """获取单个对象并自动检查权限"""
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供通知ID")

        try:
            if isinstance(pk, str):
                pk = uuid.UUID(pk)
        except ValueError:
            raise Http404("无效的通知ID格式")

        # 注意：这里的查询不直接使用 get_queryset()，因为它已经很复杂了。
        # 我们直接获取对象，然后依赖 check_object_permissions 来验证所有权。
        try:
            obj = ReminderNotification.objects.get(id=pk)
        except ReminderNotification.DoesNotExist:
            raise Http404("通知不存在")

        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        """列出所有通知"""
        # 获取过滤参数
        status_filter = request.query_params.get('status')

        # 构建查询
        queryset = self.get_queryset()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 分页 (DRF)
        paginator = PageNumberPagination()
        page_size = request.query_params.get('page_size')
        if page_size:
            try:
                paginator.page_size = int(page_size)
            except Exception:
                pass
        page_qs = paginator.paginate_queryset(queryset, request)

        serializer = MongoReminderNotificationSerializer(page_qs, many=True)
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个通知"""
        try:
            notification = self.get_object()
            serializer = MongoReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取通知详情失败: {str(e)}", exc_info=True)
            return Response(
                {"detail": "获取通知详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def mark_as_sent(self, request, pk=None):
        """标记为已发送"""
        try:
            notification = self.get_object()
            notification.status = 'sent'
            notification.sent_time = timezone.now()
            notification.save()
            serializer = MongoReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"标记通知为已发送失败: {e}", exc_info=True)
            return Response({"detail": "标记通知为已发送失败"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def mark_as_failed(self, request, pk=None):
        """标记为发送失败"""
        try:
            notification = self.get_object()
            notification.status = 'failed'
            notification.error_message = request.data.get('error_message', '')
            notification.save()
            serializer = MongoReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"标记通知为发送失败失败: {e}", exc_info=True)
            return Response({"detail": "标记通知为发送失败失败"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
