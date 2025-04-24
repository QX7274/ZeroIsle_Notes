"""笔记分享序列化器"""

from rest_framework import serializers
from django.utils import timezone
from .models import NoteShare, Note
from users.models import User


class NoteShareCreateSerializer(serializers.ModelSerializer):
    """笔记分享创建序列化器"""
    allowed_users_emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        write_only=True
    )
    
    class Meta:
        model = NoteShare
        fields = ['access_type', 'password', 'allowed_users_emails', 'is_editable', 'expires_at']
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
        }
    
    def validate(self, attrs):
        # 验证访问类型和密码
        access_type = attrs.get('access_type')
        password = attrs.get('password')
        allowed_users_emails = attrs.pop('allowed_users_emails', [])
        
        if access_type == 'password' and not password:
            raise serializers.ValidationError({'password': '密码访问类型必须提供密码'})
        
        # 保存允许访问的用户列表
        self.context['allowed_users_emails'] = allowed_users_emails
        
        return attrs
    
    def create(self, validated_data):
        note = self.context['note']
        allowed_users_emails = self.context.get('allowed_users_emails', [])
        
        # 创建分享记录
        share = NoteShare.objects.create(
            note=note,
            **validated_data
        )
        
        # 如果是指定用户访问类型，添加允许的用户
        if allowed_users_emails and share.access_type == 'specific_users':
            users = User.objects.filter(email__in=allowed_users_emails)
            share.allowed_users.set(users)
        
        return share


class NoteShareDetailSerializer(serializers.ModelSerializer):
    """笔记分享详情序列化器"""
    note_title = serializers.CharField(source='note.title', read_only=True)
    share_url = serializers.CharField(read_only=True)
    is_expired = serializers.SerializerMethodField()
    allowed_users = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteShare
        fields = ['id', 'note_title', 'share_id', 'access_type', 'is_editable', 
                  'expires_at', 'created_at', 'updated_at', 'view_count', 
                  'share_url', 'is_expired', 'allowed_users']
        read_only_fields = ['id', 'share_id', 'created_at', 'updated_at', 'view_count']
    
    def get_is_expired(self, obj):
        if obj.expires_at and obj.expires_at < timezone.now():
            return True
        return False
    
    def get_allowed_users(self, obj):
        if obj.access_type == 'specific_users':
            return [{
                'id': user.id,
                'username': user.username,
                'email': user.email
            } for user in obj.allowed_users.all()]
        return []


class SharedNoteSerializer(serializers.ModelSerializer):
    """共享笔记序列化器"""
    owner_username = serializers.CharField(source='user.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    
    class Meta:
        model = Note
        fields = ['id', 'title', 'content', 'owner_username', 'category_name', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'title', 'owner_username', 'category_name', 
                           'created_at', 'updated_at']