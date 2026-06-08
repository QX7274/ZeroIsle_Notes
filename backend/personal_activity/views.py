"""
Personal Activity Tracking Views
个人活动记录视图
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from bson import ObjectId

from .mongodb_models import (
    build_personal_activity_user_id_query,
    get_activity_category,
    get_activity_goal,
    get_activity_record,
    get_personal_activity_models,
)
from users.utils import get_mongo_user_from_django
from .serializers import (
    ActivityRecordSerializer, ActivityCategorySerializer, ActivityGoalSerializer,
    ActivityFilterSerializer, BatchOperationSerializer
)

logger = logging.getLogger(__name__)


def _resolved_personal_activity_user_id(request):
    """
    统一使用 Mongo 用户 ID，避免把 Django UUID 误当成 ObjectId 写入个人活动集合。
    """
    mongo_user = get_mongo_user_from_django(request.user)
    if mongo_user and getattr(mongo_user, 'id', None):
        return str(mongo_user.id)
    return str(request.user.id)


def _activity_record_service():
    return get_activity_record()


def _activity_category_service():
    return get_activity_category()


def _activity_goal_service():
    return get_activity_goal()


def _personal_activity_models_service():
    return get_personal_activity_models()

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def activity_list_view(request):
    """活动列表视图 - 获取活动列表或创建新活动"""
    user_id = _resolved_personal_activity_user_id(request)

    if request.method == 'GET':
        # 获取查询参数
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))

        # 构建过滤条件
        filters = {}
        if request.GET.get('status'):
            filters['status'] = request.GET.get('status')
        if request.GET.get('category_id'):
            filters['category_id'] = request.GET.get('category_id')
        if request.GET.get('tags'):
            filters['tags'] = request.GET.get('tags').split(',')
        if request.GET.get('start_date'):
            try:
                filters['start_date'] = datetime.fromisoformat(request.GET.get('start_date'))
            except ValueError:
                pass
        if request.GET.get('end_date'):
            try:
                filters['end_date'] = datetime.fromisoformat(request.GET.get('end_date'))
            except ValueError:
                pass

        # 获取活动列表
        result = _activity_record_service().get_user_activities(user_id, filters, page, page_size)

        return Response({
            'success': True,
            'data': result
        })

    elif request.method == 'POST':
        # 创建新活动
        serializer = ActivityRecordSerializer(data=request.data)
        if serializer.is_valid():
            activity_id = _activity_record_service().create(user_id, serializer.validated_data)
            if activity_id:
                # 获取创建的活动详情
                created_activity = _activity_record_service().get_by_id(user_id, activity_id)
                return Response({
                    'success': True,
                    'data': created_activity,
                    'message': '活动创建成功'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'message': '活动创建失败'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def activity_detail_view(request, activity_id):
    """活动详情视图 - 获取、更新或删除特定活动"""
    user_id = _resolved_personal_activity_user_id(request)

    if request.method == 'GET':
        # 获取活动详情
        activity = _activity_record_service().get_by_id(user_id, activity_id)
        if activity:
            return Response({
                'success': True,
                'data': activity
            })
        else:
            return Response({
                'success': False,
                'message': '活动不存在'
            }, status=status.HTTP_404_NOT_FOUND)

    elif request.method == 'PUT':
        # 更新活动
        serializer = ActivityRecordSerializer(data=request.data, partial=True)
        if serializer.is_valid():
            success = _activity_record_service().update(user_id, activity_id, serializer.validated_data)
            if success:
                # 获取更新后的活动详情
                updated_activity = _activity_record_service().get_by_id(user_id, activity_id)
                return Response({
                    'success': True,
                    'data': updated_activity,
                    'message': '活动更新成功'
                })
            else:
                return Response({
                    'success': False,
                    'message': '活动更新失败'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        # 删除活动
        success = _activity_record_service().delete(user_id, activity_id)
        if success:
            return Response({
                'success': True,
                'message': '活动删除成功'
            })
        else:
            return Response({
                'success': False,
                'message': '活动删除失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def activity_status_view(request, activity_id):
    """更新活动状态"""
    user_id = _resolved_personal_activity_user_id(request)
    new_status = request.data.get('status')

    if not new_status:
        return Response({
            'success': False,
            'message': '状态参数不能为空'
        }, status=status.HTTP_400_BAD_REQUEST)

    valid_statuses = ['completed', 'in_progress', 'paused', 'cancelled', 'planned']
    if new_status not in valid_statuses:
        return Response({
            'success': False,
            'message': f'无效的状态值，有效值为: {", ".join(valid_statuses)}'
        }, status=status.HTTP_400_BAD_REQUEST)

    success = _activity_record_service().update_status(user_id, activity_id, new_status)
    if success:
        # 如果状态为完成，自动设置进度为100%
        if new_status == 'completed':
            _activity_record_service().update_progress(user_id, activity_id, 100)

        return Response({
            'success': True,
            'message': '状态更新成功'
        })
    else:
        return Response({
            'success': False,
            'message': '状态更新失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def activity_progress_view(request, activity_id):
    """更新活动进度"""
    user_id = _resolved_personal_activity_user_id(request)
    progress = request.data.get('progress')

    if progress is None:
        return Response({
            'success': False,
            'message': '进度参数不能为空'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        progress = int(progress)
        if progress < 0 or progress > 100:
            raise ValueError()
    except (ValueError, TypeError):
        return Response({
            'success': False,
            'message': '进度值必须是0-100之间的整数'
        }, status=status.HTTP_400_BAD_REQUEST)

    success = _activity_record_service().update_progress(user_id, activity_id, progress)
    if success:
        # 如果进度为100%，自动设置状态为完成
        if progress == 100:
            _activity_record_service().update_status(user_id, activity_id, 'completed')
        # 如果进度大于0且当前状态为计划中，设置为进行中
        elif progress > 0:
            current_activity = _activity_record_service().get_by_id(user_id, activity_id)
            if current_activity and current_activity.get('status') == 'planned':
                _activity_record_service().update_status(user_id, activity_id, 'in_progress')

        return Response({
            'success': True,
            'message': '进度更新成功'
        })
    else:
        return Response({
            'success': False,
            'message': '进度更新失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_view(request):
    """获取仪表板数据"""
    user_id = _resolved_personal_activity_user_id(request)

    try:
        # 获取今日活动统计
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)

        today_filters = {
            'start_date': today,
            'end_date': tomorrow
        }

        today_activities = _activity_record_service().get_user_activities(user_id, today_filters, 1, 100)

        # 计算统计数据
        total_today = today_activities['total']
        completed_today = len([a for a in today_activities['activities'] if a.get('status') == 'completed'])
        in_progress_today = len([a for a in today_activities['activities'] if a.get('status') == 'in_progress'])

        # 获取本周活动统计
        week_start = today - timedelta(days=today.weekday())
        week_filters = {
            'start_date': week_start,
            'end_date': today + timedelta(days=1)
        }

        week_activities = _activity_record_service().get_user_activities(user_id, week_filters, 1, 1000)
        total_week = week_activities['total']
        completed_week = len([a for a in week_activities['activities'] if a.get('status') == 'completed'])

        # 计算完成率
        completion_rate_today = (completed_today / total_today * 100) if total_today > 0 else 0
        completion_rate_week = (completed_week / total_week * 100) if total_week > 0 else 0

        # 获取最近活动
        recent_activities = _activity_record_service().get_user_activities(user_id, {}, 1, 5)

        dashboard_data = {
            'today_stats': {
                'total': total_today,
                'completed': completed_today,
                'in_progress': in_progress_today,
                'completion_rate': round(completion_rate_today, 1)
            },
            'week_stats': {
                'total': total_week,
                'completed': completed_week,
                'completion_rate': round(completion_rate_week, 1)
            },
            'recent_activities': recent_activities['activities']
        }

        return Response({
            'success': True,
            'data': dashboard_data
        })

    except Exception as e:
        logger.error(f"获取仪表板数据失败: {e}")
        return Response({
            'success': False,
            'message': '获取仪表板数据失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_activities_view(request):
    """搜索活动"""
    user_id = _resolved_personal_activity_user_id(request)
    query = request.GET.get('q', '').strip()

    if not query:
        return Response({
            'success': False,
            'message': '搜索关键词不能为空'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        # 使用MongoDB文本搜索
        if _personal_activity_models_service().db:
            collection = _personal_activity_models_service().db.personal_activities

            # 构建搜索查询
            search_query = {
                'user_id': build_personal_activity_user_id_query(user_id),
                'deleted_at': None,
                '$or': [
                    {'title': {'$regex': query, '$options': 'i'}},
                    {'description': {'$regex': query, '$options': 'i'}},
                    {'tags': {'$regex': query, '$options': 'i'}}
                ]
            }

            cursor = collection.find(search_query).sort('created_at', -1).limit(50)

            activities = []
            for activity in cursor:
                activity['_id'] = str(activity['_id'])
                activity['user_id'] = str(activity['user_id'])
                activity['dependencies'] = [str(dep) for dep in activity.get('dependencies', [])]
                activities.append(activity)

            return Response({
                'success': True,
                'data': {
                    'activities': activities,
                    'total': len(activities),
                    'query': query
                }
            })
        else:
            return Response({
                'success': False,
                'message': '搜索服务不可用'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    except Exception as e:
        logger.error(f"搜索活动失败: {e}")
        return Response({
            'success': False,
            'message': '搜索失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_operation_view(request):
    """批量操作活动"""
    user_id = _resolved_personal_activity_user_id(request)

    serializer = BatchOperationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    activity_ids = serializer.validated_data['activity_ids']
    operation = serializer.validated_data['operation']
    operation_data = serializer.validated_data.get('data', {})

    success_count = 0
    failed_count = 0

    for activity_id in activity_ids:
        try:
            if operation == 'delete':
                success = _activity_record_service().delete(user_id, activity_id)
            elif operation == 'update_status':
                success = _activity_record_service().update_status(user_id, activity_id, operation_data['status'])
            elif operation == 'update_category':
                success = _activity_record_service().update(user_id, activity_id, {'category': operation_data['category']})
            elif operation == 'add_tags':
                # 获取当前活动的标签，添加新标签
                current_activity = _activity_record_service().get_by_id(user_id, activity_id)
                if current_activity:
                    current_tags = set(current_activity.get('tags', []))
                    new_tags = set(operation_data['tags'])
                    updated_tags = list(current_tags.union(new_tags))
                    success = _activity_record_service().update(user_id, activity_id, {'tags': updated_tags})
                else:
                    success = False
            elif operation == 'remove_tags':
                # 获取当前活动的标签，移除指定标签
                current_activity = _activity_record_service().get_by_id(user_id, activity_id)
                if current_activity:
                    current_tags = set(current_activity.get('tags', []))
                    remove_tags = set(operation_data['tags'])
                    updated_tags = list(current_tags.difference(remove_tags))
                    success = _activity_record_service().update(user_id, activity_id, {'tags': updated_tags})
                else:
                    success = False
            else:
                success = False

            if success:
                success_count += 1
            else:
                failed_count += 1

        except Exception as e:
            logger.error(f"批量操作失败 - 活动ID: {activity_id}, 错误: {e}")
            failed_count += 1

    return Response({
        'success': True,
        'data': {
            'total': len(activity_ids),
            'success_count': success_count,
            'failed_count': failed_count
        },
        'message': f'批量操作完成，成功: {success_count}，失败: {failed_count}'
    })

# Category management views
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def category_list_view(request):
    """分类列表视图 - 获取分类列表或创建新分类"""
    user_id = _resolved_personal_activity_user_id(request)

    if request.method == 'GET':
        # 获取用户的所有分类
        categories = _activity_category_service().get_user_categories(user_id)

        # 如果没有分类，创建默认分类
        if not categories:
            _activity_category_service().create_default_categories(user_id)
            categories = _activity_category_service().get_user_categories(user_id)

        return Response({
            'success': True,
            'data': categories
        })

    elif request.method == 'POST':
        # 创建新分类
        serializer = ActivityCategorySerializer(data=request.data)
        if serializer.is_valid():
            category_id = _activity_category_service().create(user_id, serializer.validated_data)
            if category_id:
                created_category = _activity_category_service().get_by_id(user_id, category_id)
                return Response({
                    'success': True,
                    'data': created_category,
                    'message': '分类创建成功'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'message': '分类创建失败'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def category_detail_view(request, category_id):
    """分类详情视图 - 获取、更新或删除特定分类"""
    user_id = _resolved_personal_activity_user_id(request)

    if request.method == 'GET':
        # 获取分类详情
        category = _activity_category_service().get_by_id(user_id, category_id)
        if category:
            return Response({
                'success': True,
                'data': category
            })
        else:
            return Response({
                'success': False,
                'message': '分类不存在'
            }, status=status.HTTP_404_NOT_FOUND)

    elif request.method == 'PUT':
        # 更新分类
        serializer = ActivityCategorySerializer(data=request.data, partial=True)
        if serializer.is_valid():
            success = _activity_category_service().update(user_id, category_id, serializer.validated_data)
            if success:
                updated_category = _activity_category_service().get_by_id(user_id, category_id)
                return Response({
                    'success': True,
                    'data': updated_category,
                    'message': '分类更新成功'
                })
            else:
                return Response({
                    'success': False,
                    'message': '分类更新失败'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        # 删除分类
        success = _activity_category_service().delete(user_id, category_id)
        if success:
            return Response({
                'success': True,
                'message': '分类删除成功'
            })
        else:
            return Response({
                'success': False,
                'message': '分类删除失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_tree_view(request):
    """分类树视图 - 获取层级结构的分类树"""
    user_id = _resolved_personal_activity_user_id(request)

    try:
        categories = _activity_category_service().get_user_categories(user_id)

        # 构建分类树结构
        category_map = {cat['_id']: cat for cat in categories}
        tree = []

        for category in categories:
            if not category.get('parent_id'):
                # 根分类
                category['children'] = []
                tree.append(category)
            else:
                # 子分类
                parent = category_map.get(category['parent_id'])
                if parent:
                    if 'children' not in parent:
                        parent['children'] = []
                    parent['children'].append(category)

        return Response({
            'success': True,
            'data': tree
        })

    except Exception as e:
        logger.error(f"获取分类树失败: {e}")
        return Response({
            'success': False,
            'message': '获取分类树失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Goal management views
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def goal_list_view(request):
    """目标列表视图 - 获取目标列表或创建新目标"""
    user_id = _resolved_personal_activity_user_id(request)

    if request.method == 'GET':
        # 获取查询参数
        status_filter = request.GET.get('status')

        # 获取用户的目标列表
        goals = _activity_goal_service().get_user_goals(user_id, status_filter)

        return Response({
            'success': True,
            'data': goals
        })

    elif request.method == 'POST':
        # 创建新目标
        serializer = ActivityGoalSerializer(data=request.data)
        if serializer.is_valid():
            goal_id = _activity_goal_service().create(user_id, serializer.validated_data)
            if goal_id:
                created_goal = _activity_goal_service().get_by_id(user_id, goal_id)
                return Response({
                    'success': True,
                    'data': created_goal,
                    'message': '目标创建成功'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'message': '目标创建失败'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def goal_detail_view(request, goal_id):
    """目标详情视图 - 获取、更新或删除特定目标"""
    user_id = _resolved_personal_activity_user_id(request)

    if request.method == 'GET':
        # 获取目标详情
        goal = _activity_goal_service().get_by_id(user_id, goal_id)
        if goal:
            return Response({
                'success': True,
                'data': goal
            })
        else:
            return Response({
                'success': False,
                'message': '目标不存在'
            }, status=status.HTTP_404_NOT_FOUND)

    elif request.method == 'PUT':
        # 更新目标
        serializer = ActivityGoalSerializer(data=request.data, partial=True)
        if serializer.is_valid():
            success = _activity_goal_service().update(user_id, goal_id, serializer.validated_data)
            if success:
                updated_goal = _activity_goal_service().get_by_id(user_id, goal_id)
                return Response({
                    'success': True,
                    'data': updated_goal,
                    'message': '目标更新成功'
                })
            else:
                return Response({
                    'success': False,
                    'message': '目标更新失败'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        # 删除目标
        success = _activity_goal_service().delete(user_id, goal_id)
        if success:
            return Response({
                'success': True,
                'message': '目标删除成功'
            })
        else:
            return Response({
                'success': False,
                'message': '目标删除失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Analytics views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analytics_reports_view(request):
    """分析报告视图 - 生成和获取分析报告"""
    user_id = _resolved_personal_activity_user_id(request)

    try:
        # 获取查询参数
        report_type = request.GET.get('type', 'weekly')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        # 设置默认时间范围
        if not start_date or not end_date:
            end_date = datetime.now()
            if report_type == 'daily':
                start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            elif report_type == 'weekly':
                start_date = end_date - timedelta(days=7)
            elif report_type == 'monthly':
                start_date = end_date - timedelta(days=30)
            else:
                start_date = end_date - timedelta(days=7)
        else:
            start_date = datetime.fromisoformat(start_date)
            end_date = datetime.fromisoformat(end_date)

        # 获取时间范围内的活动
        filters = {'start_date': start_date, 'end_date': end_date}
        activities_data = _activity_record_service().get_user_activities(user_id, filters, 1, 1000)
        activities = activities_data['activities']

        # 计算统计数据
        total_activities = len(activities)
        completed_activities = len([a for a in activities if a.get('status') == 'completed'])
        completion_rate = (completed_activities / total_activities * 100) if total_activities > 0 else 0

        # 按分类统计
        category_stats = {}
        for activity in activities:
            category = activity.get('category', {})
            category_name = category.get('name', '未分类')
            if category_name not in category_stats:
                category_stats[category_name] = {
                    'count': 0,
                    'completed': 0,
                    'total_time': 0
                }
            category_stats[category_name]['count'] += 1
            if activity.get('status') == 'completed':
                category_stats[category_name]['completed'] += 1
            if activity.get('actual_duration'):
                category_stats[category_name]['total_time'] += activity['actual_duration']

        # 计算平均满意度
        satisfaction_scores = [a.get('satisfaction', 0) for a in activities if a.get('satisfaction')]
        avg_satisfaction = sum(satisfaction_scores) / len(satisfaction_scores) if satisfaction_scores else 0

        # 生成报告数据
        report_data = {
            'period': {
                'type': report_type,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'summary': {
                'total_activities': total_activities,
                'completed_activities': completed_activities,
                'completion_rate': round(completion_rate, 1),
                'average_satisfaction': round(avg_satisfaction, 1)
            },
            'category_breakdown': [
                {
                    'category': name,
                    'count': stats['count'],
                    'completed': stats['completed'],
                    'completion_rate': round((stats['completed'] / stats['count'] * 100) if stats['count'] > 0 else 0, 1),
                    'total_time': stats['total_time']
                }
                for name, stats in category_stats.items()
            ]
        }

        return Response({
            'success': True,
            'data': report_data
        })

    except Exception as e:
        logger.error(f"生成分析报告失败: {e}")
        return Response({
            'success': False,
            'message': '生成分析报告失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analytics_insights_view(request):
    """智能洞察视图 - 基于数据生成智能建议"""
    user_id = _resolved_personal_activity_user_id(request)

    try:
        # 获取最近30天的活动数据
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        filters = {'start_date': start_date, 'end_date': end_date}
        activities_data = _activity_record_service().get_user_activities(user_id, filters, 1, 1000)
        activities = activities_data['activities']

        insights = []

        if not activities:
            insights.append({
                'type': 'recommendation',
                'title': '开始记录活动',
                'description': '您还没有记录任何活动，建议开始记录日常活动来获得更好的洞察。',
                'confidence': 1.0,
                'action_items': ['创建第一个活动记录', '设置活动分类', '定期更新活动状态']
            })
        else:
            # 完成率分析
            completed_count = len([a for a in activities if a.get('status') == 'completed'])
            completion_rate = completed_count / len(activities) * 100

            if completion_rate < 50:
                insights.append({
                    'type': 'warning',
                    'title': '完成率偏低',
                    'description': f'您的活动完成率为{completion_rate:.1f}%，建议优化时间管理和任务规划。',
                    'confidence': 0.8,
                    'action_items': ['分解大任务为小任务', '设置合理的截止时间', '定期回顾和调整计划']
                })
            elif completion_rate > 80:
                insights.append({
                    'type': 'pattern',
                    'title': '高效执行者',
                    'description': f'您的活动完成率达到{completion_rate:.1f}%，表现优秀！',
                    'confidence': 0.9,
                    'action_items': ['保持当前的工作节奏', '考虑设置更具挑战性的目标', '分享您的时间管理经验']
                })

            # 活动频率分析
            daily_avg = len(activities) / 30
            if daily_avg < 1:
                insights.append({
                    'type': 'recommendation',
                    'title': '增加记录频率',
                    'description': f'您平均每天记录{daily_avg:.1f}个活动，建议增加记录频率以获得更准确的分析。',
                    'confidence': 0.7,
                    'action_items': ['设置记录提醒', '记录更多日常活动', '使用快速添加功能']
                })

            # 分类分布分析
            category_counts = {}
            for activity in activities:
                category_name = activity.get('category', {}).get('name', '未分类')
                category_counts[category_name] = category_counts.get(category_name, 0) + 1

            if len(category_counts) == 1:
                insights.append({
                    'type': 'recommendation',
                    'title': '丰富活动类型',
                    'description': '您的活动主要集中在一个分类，建议尝试更多样化的活动类型。',
                    'confidence': 0.6,
                    'action_items': ['探索新的活动分类', '平衡工作和生活', '设置多元化目标']
                })

        return Response({
            'success': True,
            'data': {
                'insights': insights,
                'generated_at': datetime.now().isoformat(),
                'period_days': 30
            }
        })

    except Exception as e:
        logger.error(f"生成智能洞察失败: {e}")
        return Response({
            'success': False,
            'message': '生成智能洞察失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analytics_trends_view(request):
    """趋势分析视图 - 分析活动数据的时间趋势"""
    user_id = _resolved_personal_activity_user_id(request)

    try:
        # 获取查询参数
        period = request.GET.get('period', 'week')  # week, month, quarter
        metric = request.GET.get('metric', 'completion_rate')  # completion_rate, activity_count, satisfaction

        # 设置时间范围
        end_date = datetime.now()
        if period == 'week':
            start_date = end_date - timedelta(weeks=12)  # 12周数据
            interval_days = 7
        elif period == 'month':
            start_date = end_date - timedelta(days=365)  # 12个月数据
            interval_days = 30
        else:  # quarter
            start_date = end_date - timedelta(days=365*2)  # 2年数据
            interval_days = 90

        # 生成时间点
        trend_data = []
        current_date = start_date

        while current_date < end_date:
            period_end = min(current_date + timedelta(days=interval_days), end_date)

            # 获取该时间段的活动
            filters = {'start_date': current_date, 'end_date': period_end}
            activities_data = _activity_record_service().get_user_activities(user_id, filters, 1, 1000)
            activities = activities_data['activities']

            # 计算指标
            if metric == 'completion_rate':
                completed = len([a for a in activities if a.get('status') == 'completed'])
                value = (completed / len(activities) * 100) if activities else 0
            elif metric == 'activity_count':
                value = len(activities)
            elif metric == 'satisfaction':
                satisfaction_scores = [a.get('satisfaction', 0) for a in activities if a.get('satisfaction')]
                value = sum(satisfaction_scores) / len(satisfaction_scores) if satisfaction_scores else 0
            else:
                value = 0

            trend_data.append({
                'date': current_date.isoformat(),
                'value': round(value, 2)
            })

            current_date = period_end

        return Response({
            'success': True,
            'data': {
                'period': period,
                'metric': metric,
                'trend_data': trend_data,
                'generated_at': datetime.now().isoformat()
            }
        })

    except Exception as e:
        logger.error(f"生成趋势分析失败: {e}")
        return Response({
            'success': False,
            'message': '生成趋势分析失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import csv
import os
import uuid
from PIL import Image
from django.http import HttpResponse
from django.core.files.storage import default_storage
from django.conf import settings

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_data_view(request):
    """数据导出视图 - 导出活动数据为JSON或CSV格式"""
    user_id = _resolved_personal_activity_user_id(request)
    export_format = request.GET.get('format', 'json').lower()

    try:
        activities_data = _activity_record_service().get_user_activities(user_id, page_size=10000) # 导出所有活动
        activities = activities_data['activities']

        if export_format == 'json':
            response = HttpResponse(json.dumps(activities, indent=2, ensure_ascii=False), content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename="personal_activities_{datetime.now().strftime("%Y%m%d")}.json"'
            return response

        elif export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="personal_activities_{datetime.now().strftime("%Y%m%d")}.csv"'
            response.write(u'\ufeff'.encode('utf8')) # BOM for Excel

            writer = csv.writer(response)
            # 写入表头
            writer.writerow(['ID', 'Title', 'Status', 'Priority', 'Progress', 'Start Time', 'End Time', 'Category', 'Tags'])

            for activity in activities:
                writer.writerow([
                    activity['_id'],
                    activity.get('title'),
                    activity.get('status'),
                    activity.get('priority'),
                    activity.get('progress'),
                    activity.get('start_time'),
                    activity.get('end_time'),
                    activity.get('category', {}).get('name'),
                    ','.join(activity.get('tags', []))
                ])
            return response

        else:
            return Response({'success': False, 'message': '不支持的导出格式'}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"导出数据失败: {e}")
        return Response({'success': False, 'message': '导出数据失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_data_view(request):
    """数据导入视图 - 从JSON文件导入活动数据"""
    user_id = _resolved_personal_activity_user_id(request)

    if 'file' not in request.FILES:
        return Response({'success': False, 'message': '没有提供文件'}, status=status.HTTP_400_BAD_REQUEST)

    file = request.FILES['file']

    if not file.name.endswith('.json'):
        return Response({'success': False, 'message': '只支持JSON文件导入'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        imported_data = json.load(file)

        if not isinstance(imported_data, list):
            return Response({'success': False, 'message': 'JSON文件格式无效，需要是活动对象数组'}, status=status.HTTP_400_BAD_REQUEST)

        success_count = 0
        failed_count = 0
        errors = []

        for item in imported_data:
            serializer = ActivityRecordSerializer(data=item)
            if serializer.is_valid():
                activity_id = _activity_record_service().create(user_id, serializer.validated_data)
                if activity_id:
                    success_count += 1
                else:
                    failed_count += 1
                    errors.append(f"创建失败: {item.get('title')}")
            else:
                failed_count += 1
                errors.append(f"验证失败: {item.get('title')} - {serializer.errors}")

        return Response({
            'success': True,
            'data': {
                'total': len(imported_data),
                'success_count': success_count,
                'failed_count': failed_count,
                'errors': errors
            },
            'message': f'导入完成，成功: {success_count}，失败: {failed_count}'
        })

    except json.JSONDecodeError:
        return Response({'success': False, 'message': 'JSON文件解析失败'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"导入数据失败: {e}")
        return Response({'success': False, 'message': '导入数据失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Image upload and management views
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_image_view(request):
    """图片上传视图 - 支持活动日记图片上传"""
    if 'image' not in request.FILES:
        return Response({'success': False, 'message': '没有提供图片文件'}, status=status.HTTP_400_BAD_REQUEST)

    image_file = request.FILES['image']

    # 验证文件类型
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if image_file.content_type not in allowed_types:
        return Response({'success': False, 'message': '不支持的图片格式'}, status=status.HTTP_400_BAD_REQUEST)

    # 验证文件大小 (最大10MB)
    if image_file.size > 10 * 1024 * 1024:
        return Response({'success': False, 'message': '图片文件过大，请选择小于10MB的图片'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # 生成唯一文件名
        file_extension = os.path.splitext(image_file.name)[1].lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"

        # 创建用户专属目录
        user_id = _resolved_personal_activity_user_id(request)
        upload_path = f"personal_activity/{user_id}/images/{unique_filename}"

        # 保存原始图片
        saved_path = default_storage.save(upload_path, image_file)

        # 生成缩略图
        try:
            with Image.open(image_file) as img:
                # 创建缩略图 (最大宽度800px)
                img.thumbnail((800, 800), Image.Resampling.LANCZOS)

                # 保存缩略图
                thumbnail_filename = f"thumb_{unique_filename}"
                thumbnail_path = f"personal_activity/{user_id}/images/{thumbnail_filename}"

                # 转换为RGB模式以支持JPEG保存
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")

                from io import BytesIO
                thumbnail_buffer = BytesIO()
                img.save(thumbnail_buffer, format='JPEG', quality=85)
                thumbnail_buffer.seek(0)

                from django.core.files.base import ContentFile
                thumbnail_file = ContentFile(thumbnail_buffer.getvalue(), name=thumbnail_filename)
                thumbnail_saved_path = default_storage.save(thumbnail_path, thumbnail_file)

        except Exception as e:
            logger.warning(f"生成缩略图失败: {e}")
            thumbnail_saved_path = saved_path

        # 构建返回的URL
        image_url = default_storage.url(saved_path)
        thumbnail_url = default_storage.url(thumbnail_saved_path)

        return Response({
            'success': True,
            'data': {
                'image_url': image_url,
                'thumbnail_url': thumbnail_url,
                'filename': unique_filename,
                'size': image_file.size
            },
            'message': '图片上传成功'
        })

    except Exception as e:
        logger.error(f"图片上传失败: {e}")
        return Response({'success': False, 'message': '图片上传失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_image_view(request, filename):
    """删除图片视图"""
    try:
        user_id = _resolved_personal_activity_user_id(request)

        # 构建文件路径
        image_path = f"personal_activity/{user_id}/images/{filename}"
        thumbnail_path = f"personal_activity/{user_id}/images/thumb_{filename}"

        # 删除原图和缩略图
        if default_storage.exists(image_path):
            default_storage.delete(image_path)

        if default_storage.exists(thumbnail_path):
            default_storage.delete(thumbnail_path)

        return Response({
            'success': True,
            'message': '图片删除成功'
        })

    except Exception as e:
        logger.error(f"删除图片失败: {e}")
        return Response({'success': False, 'message': '删除图片失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

