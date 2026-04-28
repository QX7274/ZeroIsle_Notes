"""笔记分享序列化器"""

from rest_framework import serializers
from django.utils import timezone
from .mongodb_models import NoteShare, Note
from users.mongodb_models import User
import logging

logger = logging.getLogger(__name__)

class NoteShareCreateSerializer(serializers.Serializer):
    """笔记分享创建序列化器 (MongoEngine适配)"""
    share_type = serializers.ChoiceField(choices=[('link', '链接'), ('email', '邮件'), ('user', '用户')])
    share_to = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    max_view_count = serializers.IntegerField(required=False, allow_null=True)
    
    def validate(self, attrs):
        share_type = attrs.get('share_type')
        share_to = attrs.get('share_to')
        password = attrs.get('password')
        
        if share_type in ['email', 'user'] and not share_to:
            raise serializers.ValidationError({'share_to': '此分享类型必须指定分享对象'})
            
        return attrs
    
    def create(self, validated_data):
        note = self.context['note']
        user = self.context['request'].user
        
        # 转换Django User到Mongo User (如果需要)
        # 假设request.user是Django User, 我们需要找到对应的Mongo User
        # 或者假设已在中间件处理。暂时假设user有一个mongo_id或者同样的username
        mongo_user = User.objects(username=user.username).first()
        if not mongo_user:
             # Fallback or error? For now try to find by email
             mongo_user = User.objects(email=user.email).first()
             if not mongo_user:
                 logger.error(f"Cannot find Mongo user for {user.username}")
                 raise serializers.ValidationError("用户数据不一致")

        # 创建分享记录
        share = NoteShare(
            note=note,
            user=mongo_user,
            share_type=validated_data.get('share_type'),
            share_to=validated_data.get('share_to'),
            expires_at=validated_data.get('expires_at'),
            max_view_count=validated_data.get('max_view_count'),
            share_code=NoteShare.generate_share_code()
        )
        
        password = validated_data.get('password')
        if password:
            share.set_password(password)
            
        share.save()
        return share


class NoteShareDetailSerializer(serializers.Serializer):
    """笔记分享详情序列化器"""
    id = serializers.CharField(read_only=True)
    note_id = serializers.CharField(source='note.id', read_only=True)
    note_title = serializers.CharField(source='note.title', read_only=True)
    share_type = serializers.CharField(read_only=True)
    share_to = serializers.CharField(read_only=True)
    share_code = serializers.CharField(read_only=True)
    share_url = serializers.SerializerMethodField()
    is_password_protected = serializers.BooleanField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True)
    is_expired = serializers.SerializerMethodField()
    view_count = serializers.IntegerField(read_only=True)
    max_view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    
    def get_share_url(self, obj):
        # 假设前端路由格式
        return f"/share/{obj.share_code}"
    
    def get_is_expired(self, obj):
        return obj.is_expired()


class SharedNoteSerializer(serializers.Serializer):
    """共享笔记内容序列化器"""
    id = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    content = serializers.CharField(read_only=True)
    owner_username = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    def get_owner_username(self, obj):
        return obj.user.username if obj.user else "Unknown"
        
    def get_category_name(self, obj):
        return obj.category.name if obj.category else None