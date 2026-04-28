"""
用户活动分析服务
提供用户行为分析和使用统计
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, IntField, DictField
from mongoengine import ReferenceField, UUIDField
import uuid

logger = logging.getLogger(__name__)


class UserActivity(Document):
    """用户活动记录文档"""
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user_id = StringField(required=True, verbose_name='用户ID')
    activity_type = StringField(required=True, verbose_name='活动类型')
    entity_type = StringField(verbose_name='实体类型')
    entity_id = StringField(verbose_name='实体ID')
    metadata = DictField(default=dict, verbose_name='元数据')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'user_activities',
        'indexes': [
            {'fields': ['user_id']},
            {'fields': ['activity_type']},
            {'fields': ['created_at']},
            {'fields': ['user_id', 'created_at']},
            {'fields': ['created_at'], 'expireAfterSeconds': 90 * 24 * 3600}  # 90天后过期
        ],
        'ordering': ['-created_at']
    }


class ActivityType:
    """活动类型常量"""
    # 笔记相关
    NOTE_CREATE = 'note_create'
    NOTE_EDIT = 'note_edit'
    NOTE_VIEW = 'note_view'
    NOTE_DELETE = 'note_delete'
    NOTE_SHARE = 'note_share'
    
    # 搜索相关
    SEARCH = 'search'
    SEMANTIC_SEARCH = 'semantic_search'
    
    # AI相关
    AI_CHAT = 'ai_chat'
    AI_SUMMARIZE = 'ai_summarize'
    AI_EXPAND = 'ai_expand'
    
    # 知识图谱
    KG_VIEW = 'kg_view'
    KG_NODE_CREATE = 'kg_node_create'
    
    # 协作
    COLLAB_JOIN = 'collab_join'
    COLLAB_EDIT = 'collab_edit'
    
    # 系统
    LOGIN = 'login'
    LOGOUT = 'logout'
    SETTINGS_CHANGE = 'settings_change'


class UserAnalyticsService:
    """
    用户分析服务
    
    使用方法:
        service = UserAnalyticsService()
        
        # 记录活动
        service.track(user_id, ActivityType.NOTE_CREATE, entity_type='note', entity_id='123')
        
        # 获取统计
        stats = service.get_user_stats(user_id)
        
        # 获取使用趋势
        trends = service.get_usage_trends(user_id, days=30)
    """
    
    def track(
        self, 
        user_id: str, 
        activity_type: str, 
        entity_type: str = None,
        entity_id: str = None,
        metadata: Dict = None
    ):
        """
        记录用户活动
        
        Args:
            user_id: 用户ID
            activity_type: 活动类型
            entity_type: 实体类型
            entity_id: 实体ID
            metadata: 额外元数据
        """
        try:
            activity = UserActivity(
                user_id=str(user_id),
                activity_type=activity_type,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
                metadata=metadata or {}
            )
            activity.save()
            
        except Exception as e:
            logger.error(f"记录用户活动失败: {e}")
    
    def get_user_stats(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """
        获取用户统计信息
        
        Args:
            user_id: 用户ID
            days: 统计天数
            
        Returns:
            dict: 统计信息
        """
        start_date = timezone.now() - timedelta(days=days)
        
        activities = UserActivity.objects(
            user_id=str(user_id),
            created_at__gte=start_date
        )
        
        # 按类型统计
        type_counts = defaultdict(int)
        for activity in activities:
            type_counts[activity.activity_type] += 1
        
        # 计算活跃天数
        active_days = set()
        for activity in activities:
            active_days.add(activity.created_at.date())
        
        return {
            'total_activities': activities.count(),
            'active_days': len(active_days),
            'activity_by_type': dict(type_counts),
            'notes_created': type_counts.get(ActivityType.NOTE_CREATE, 0),
            'notes_edited': type_counts.get(ActivityType.NOTE_EDIT, 0),
            'searches': type_counts.get(ActivityType.SEARCH, 0) + type_counts.get(ActivityType.SEMANTIC_SEARCH, 0),
            'ai_interactions': sum(v for k, v in type_counts.items() if k.startswith('ai_')),
            'period_days': days,
        }
    
    def get_usage_trends(self, user_id: str, days: int = 30) -> List[Dict]:
        """
        获取使用趋势
        
        Args:
            user_id: 用户ID
            days: 天数
            
        Returns:
            list: 每日活动统计
        """
        start_date = timezone.now() - timedelta(days=days)
        
        activities = UserActivity.objects(
            user_id=str(user_id),
            created_at__gte=start_date
        )
        
        # 按日期分组
        daily_counts = defaultdict(int)
        for activity in activities:
            date_str = activity.created_at.strftime('%Y-%m-%d')
            daily_counts[date_str] += 1
        
        # 生成完整日期列表
        trends = []
        current = start_date.date()
        end = timezone.now().date()
        
        while current <= end:
            date_str = current.strftime('%Y-%m-%d')
            trends.append({
                'date': date_str,
                'count': daily_counts.get(date_str, 0)
            })
            current += timedelta(days=1)
        
        return trends
    
    def get_recent_activities(self, user_id: str, limit: int = 20) -> List[Dict]:
        """
        获取最近活动
        
        Args:
            user_id: 用户ID
            limit: 返回数量
            
        Returns:
            list: 活动列表
        """
        activities = UserActivity.objects(
            user_id=str(user_id)
        ).order_by('-created_at').limit(limit)
        
        return [
            {
                'id': str(a.id),
                'type': a.activity_type,
                'entity_type': a.entity_type,
                'entity_id': a.entity_id,
                'metadata': a.metadata,
                'created_at': a.created_at.isoformat(),
            }
            for a in activities
        ]
    
    def get_popular_notes(self, user_id: str, days: int = 30, limit: int = 10) -> List[Dict]:
        """
        获取热门笔记（访问最多）
        
        Args:
            user_id: 用户ID
            days: 天数
            limit: 返回数量
            
        Returns:
            list: 笔记ID和访问次数
        """
        start_date = timezone.now() - timedelta(days=days)
        
        activities = UserActivity.objects(
            user_id=str(user_id),
            activity_type=ActivityType.NOTE_VIEW,
            created_at__gte=start_date
        )
        
        # 统计每个笔记的访问次数
        note_counts = defaultdict(int)
        for activity in activities:
            if activity.entity_id:
                note_counts[activity.entity_id] += 1
        
        # 排序并返回
        sorted_notes = sorted(note_counts.items(), key=lambda x: x[1], reverse=True)
        
        return [
            {'note_id': note_id, 'view_count': count}
            for note_id, count in sorted_notes[:limit]
        ]
    
    def get_productivity_score(self, user_id: str, days: int = 7) -> Dict[str, Any]:
        """
        计算生产力评分
        
        Args:
            user_id: 用户ID
            days: 天数
            
        Returns:
            dict: 生产力评分和详情
        """
        stats = self.get_user_stats(user_id, days)
        
        # 计算各项得分（0-100）
        active_days_score = min(100, stats['active_days'] / days * 100)
        note_score = min(100, stats['notes_created'] * 10 + stats['notes_edited'] * 5)
        ai_score = min(100, stats['ai_interactions'] * 15)
        
        # 综合评分
        total_score = (active_days_score * 0.4 + note_score * 0.4 + ai_score * 0.2)
        
        # 评级
        if total_score >= 80:
            level = 'excellent'
            level_name = '卓越'
        elif total_score >= 60:
            level = 'good'
            level_name = '优秀'
        elif total_score >= 40:
            level = 'average'
            level_name = '良好'
        else:
            level = 'low'
            level_name = '待提升'
        
        return {
            'score': round(total_score, 1),
            'level': level,
            'level_name': level_name,
            'breakdown': {
                'active_days': round(active_days_score, 1),
                'note_creation': round(note_score, 1),
                'ai_usage': round(ai_score, 1),
            },
            'period_days': days,
        }


# 全局服务实例
_analytics_service = None


def get_analytics_service() -> UserAnalyticsService:
    """获取分析服务实例"""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = UserAnalyticsService()
    return _analytics_service


# 装饰器：自动记录活动
def track_activity(activity_type: str, entity_type: str = None):
    """
    活动追踪装饰器
    
    使用方法:
        @track_activity(ActivityType.NOTE_VIEW, 'note')
        def view_note(request, note_id):
            ...
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            # 尝试获取用户和实体ID
            try:
                request = args[0] if args else kwargs.get('request')
                if request and hasattr(request, 'user') and request.user.is_authenticated:
                    user_id = str(request.user.id)
                    entity_id = kwargs.get('pk') or kwargs.get('id') or kwargs.get('note_id')
                    
                    service = get_analytics_service()
                    service.track(user_id, activity_type, entity_type, entity_id)
            except Exception as e:
                logger.error(f"活动追踪失败: {e}")
            
            return result
        
        return wrapper
    return decorator
