from rest_framework import serializers
from .models import SyncRecord, SyncConfig, SyncStatistics

class SyncRecordSerializer(serializers.ModelSerializer):
    """同步记录序列化器"""
    duration_display = serializers.SerializerMethodField()
    sync_type_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = SyncRecord
        fields = '__all__'
        read_only_fields = ['sync_id', 'start_time', 'end_time', 'duration', 'result_summary', 'error_message']
    
    def get_duration_display(self, obj):
        """格式化持续时间"""
        if not obj.duration:
            return "未完成"
        
        minutes, seconds = divmod(obj.duration, 60)
        hours, minutes = divmod(minutes, 60)
        
        if hours > 0:
            return f"{hours}小时 {minutes}分钟 {seconds}秒"
        elif minutes > 0:
            return f"{minutes}分钟 {seconds}秒"
        else:
            return f"{seconds}秒"
    
    def get_sync_type_display(self, obj):
        """获取同步类型显示名称"""
        return dict(SyncRecord.SYNC_TYPE_CHOICES).get(obj.sync_type, obj.sync_type)
    
    def get_status_display(self, obj):
        """获取状态显示名称"""
        return dict(SyncRecord.SYNC_STATUS_CHOICES).get(obj.status, obj.status)

class SyncConfigSerializer(serializers.ModelSerializer):
    """同步配置序列化器"""
    class Meta:
        model = SyncConfig
        fields = '__all__'
        read_only_fields = ['updated_at']

class SyncStatisticsSerializer(serializers.ModelSerializer):
    """同步统计序列化器"""
    date_display = serializers.SerializerMethodField()
    
    class Meta:
        model = SyncStatistics
        fields = '__all__'
    
    def get_date_display(self, obj):
        """格式化日期"""
        return obj.date.strftime('%Y-%m-%d')
