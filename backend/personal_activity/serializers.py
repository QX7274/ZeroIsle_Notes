"""
Personal Activity Tracking Serializers
个人活动记录序列化器
"""

from rest_framework import serializers
from datetime import datetime
from typing import Dict, Any, List, Optional

class LocationSerializer(serializers.Serializer):
    """位置信息序列化器"""
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    place_name = serializers.CharField(max_length=200, required=False, allow_blank=True)

class CategorySerializer(serializers.Serializer):
    """分类信息序列化器"""
    id = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=100)
    color = serializers.CharField(max_length=7)  # 十六进制颜色
    icon = serializers.CharField(max_length=50)

class AttachmentSerializer(serializers.Serializer):
    """附件序列化器"""
    type = serializers.ChoiceField(choices=['image', 'audio', 'document'])
    url = serializers.URLField()
    filename = serializers.CharField(max_length=255)
    size = serializers.IntegerField(min_value=0)

class SubtaskSerializer(serializers.Serializer):
    """子任务序列化器"""
    id = serializers.CharField(max_length=50)
    title = serializers.CharField(max_length=200)
    completed = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(required=False, allow_null=True)

class RecurrenceSerializer(serializers.Serializer):
    """重复设置序列化器"""
    type = serializers.ChoiceField(
        choices=['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        required=False
    )
    interval = serializers.IntegerField(min_value=1, required=False)
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        required=False
    )
    end_date = serializers.DateTimeField(required=False, allow_null=True)

class ReminderSerializer(serializers.Serializer):
    """提醒设置序列化器"""
    type = serializers.ChoiceField(choices=['notification', 'email', 'sms'])
    time = serializers.DateTimeField()
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)
    sent = serializers.BooleanField(default=False, read_only=True)

class ActivityRecordSerializer(serializers.Serializer):
    """活动记录序列化器"""
    _id = serializers.CharField(read_only=True)
    user_id = serializers.CharField(read_only=True)
    
    # 基本信息
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    category = CategorySerializer(required=False)
    status = serializers.ChoiceField(
        choices=['completed', 'in_progress', 'paused', 'cancelled', 'planned'],
        default='planned'
    )
    priority = serializers.IntegerField(min_value=1, max_value=5, default=3)
    progress = serializers.IntegerField(min_value=0, max_value=100, default=0)
    
    # 时间相关
    start_time = serializers.DateTimeField(required=False, allow_null=True)
    end_time = serializers.DateTimeField(required=False, allow_null=True)
    estimated_duration = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    actual_duration = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    deadline = serializers.DateTimeField(required=False, allow_null=True)
    
    # 位置和环境
    location = LocationSerializer(required=False)
    
    # 情绪和评价
    mood = serializers.ChoiceField(
        choices=['happy', 'neutral', 'sad', 'excited', 'stressed'],
        required=False,
        allow_null=True
    )
    energy_level = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    satisfaction = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    difficulty = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    
    # 关联数据
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        default=list
    )
    attachments = AttachmentSerializer(many=True, required=False, default=list)
    subtasks = SubtaskSerializer(many=True, required=False, default=list)
    dependencies = serializers.ListField(
        child=serializers.CharField(max_length=24),  # ObjectId长度
        required=False,
        default=list
    )
    
    # 重复和提醒设置
    recurrence = RecurrenceSerializer(required=False)
    reminders = ReminderSerializer(many=True, required=False, default=list)
    
    # 元数据
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    sync_status = serializers.CharField(read_only=True)
    version = serializers.IntegerField(read_only=True)
    
    def validate(self, data):
        """验证数据"""
        # 验证时间逻辑
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        deadline = data.get('deadline')
        
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("结束时间必须晚于开始时间")
        
        if deadline and start_time and deadline < start_time:
            raise serializers.ValidationError("截止时间不能早于开始时间")
        
        # 验证进度和状态的一致性
        progress = data.get('progress', 0)
        status = data.get('status', 'planned')
        
        if status == 'completed' and progress < 100:
            data['progress'] = 100
        elif status == 'planned' and progress > 0:
            data['status'] = 'in_progress'
        
        return data

class ActivityCategorySerializer(serializers.Serializer):
    """活动分类序列化器"""
    _id = serializers.CharField(read_only=True)
    user_id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    color = serializers.RegexField(
        regex=r'^#[0-9A-Fa-f]{6}$',
        error_message="颜色必须是有效的十六进制格式 (如: #FF0000)"
    )
    icon = serializers.CharField(max_length=50)
    parent_id = serializers.CharField(max_length=24, required=False, allow_null=True)
    order = serializers.IntegerField(min_value=0, default=0)
    is_system = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(default=True)
    activity_count = serializers.IntegerField(read_only=True)
    total_time = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

class ActivityGoalSerializer(serializers.Serializer):
    """活动目标序列化器"""
    _id = serializers.CharField(read_only=True)
    user_id = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    type = serializers.ChoiceField(
        choices=['habit', 'milestone', 'quantitative', 'qualitative']
    )
    
    # 目标设置
    target_value = serializers.FloatField(min_value=0, required=False, allow_null=True)
    current_value = serializers.FloatField(min_value=0, default=0)
    unit = serializers.CharField(max_length=50, required=False, allow_blank=True)
    
    # 时间范围
    start_date = serializers.DateTimeField()
    end_date = serializers.DateTimeField()
    
    # 关联数据
    related_categories = serializers.ListField(
        child=serializers.CharField(max_length=24),
        required=False,
        default=list
    )
    related_activities = serializers.ListField(
        child=serializers.CharField(max_length=24),
        required=False,
        default=list
    )
    
    # 状态
    status = serializers.ChoiceField(
        choices=['active', 'completed', 'paused', 'cancelled'],
        default='active'
    )
    completion_rate = serializers.FloatField(min_value=0, max_value=100, read_only=True)
    
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    def validate(self, data):
        """验证目标数据"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError("结束日期必须晚于开始日期")
        
        goal_type = data.get('type')
        target_value = data.get('target_value')
        
        if goal_type in ['quantitative', 'habit'] and target_value is None:
            raise serializers.ValidationError("数量型目标和习惯型目标必须设置目标值")
        
        return data

class ActivityFilterSerializer(serializers.Serializer):
    """活动过滤器序列化器"""
    status = serializers.ChoiceField(
        choices=['completed', 'in_progress', 'paused', 'cancelled', 'planned'],
        required=False
    )
    category_id = serializers.CharField(max_length=24, required=False)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False
    )
    start_date = serializers.DateTimeField(required=False)
    end_date = serializers.DateTimeField(required=False)
    priority_min = serializers.IntegerField(min_value=1, max_value=5, required=False)
    priority_max = serializers.IntegerField(min_value=1, max_value=5, required=False)
    progress_min = serializers.IntegerField(min_value=0, max_value=100, required=False)
    progress_max = serializers.IntegerField(min_value=0, max_value=100, required=False)
    
    def validate(self, data):
        """验证过滤条件"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError("结束日期必须晚于开始日期")
        
        priority_min = data.get('priority_min')
        priority_max = data.get('priority_max')
        
        if priority_min and priority_max and priority_min > priority_max:
            raise serializers.ValidationError("最小优先级不能大于最大优先级")
        
        progress_min = data.get('progress_min')
        progress_max = data.get('progress_max')
        
        if progress_min and progress_max and progress_min > progress_max:
            raise serializers.ValidationError("最小进度不能大于最大进度")
        
        return data

class BatchOperationSerializer(serializers.Serializer):
    """批量操作序列化器"""
    activity_ids = serializers.ListField(
        child=serializers.CharField(max_length=24),
        min_length=1,
        max_length=100
    )
    operation = serializers.ChoiceField(
        choices=['delete', 'update_status', 'update_category', 'add_tags', 'remove_tags']
    )
    data = serializers.DictField(required=False)
    
    def validate(self, data):
        """验证批量操作数据"""
        operation = data.get('operation')
        operation_data = data.get('data', {})
        
        if operation == 'update_status' and 'status' not in operation_data:
            raise serializers.ValidationError("更新状态操作需要提供status字段")
        
        if operation == 'update_category' and 'category' not in operation_data:
            raise serializers.ValidationError("更新分类操作需要提供category字段")
        
        if operation in ['add_tags', 'remove_tags'] and 'tags' not in operation_data:
            raise serializers.ValidationError("标签操作需要提供tags字段")
        
        return data
