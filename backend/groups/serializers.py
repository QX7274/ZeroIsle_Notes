"""
群组模块序列化器
"""

from rest_framework import serializers
from users.serializers import UserSerializer
from .models import Group, GroupMember, GroupInvitation, SharedScreen


class GroupSerializer(serializers.ModelSerializer):
    """群组序列化器"""
    creator = UserSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'creator', 'created_at', 'updated_at', 'member_count']
        read_only_fields = ['id', 'creator', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return obj.members.filter(is_active=True).count()


class GroupDetailSerializer(GroupSerializer):
    """群组详情序列化器"""
    join_code = serializers.SerializerMethodField()
    join_code_expires_at = serializers.SerializerMethodField()

    class Meta(GroupSerializer.Meta):
        fields = GroupSerializer.Meta.fields + ['join_code', 'join_code_expires_at']

    def get_join_code(self, obj):
        # 只有创建者和管理员可以看到加入码
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        if obj.creator == request.user or obj.members.filter(user=request.user, role='admin', is_active=True).exists():
            return obj.join_code if obj.is_join_code_valid() else None
        return None

    def get_join_code_expires_at(self, obj):
        # 只有创建者和管理员可以看到加入码过期时间
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        if obj.creator == request.user or obj.members.filter(user=request.user, role='admin', is_active=True).exists():
            return obj.join_code_expires_at if obj.is_join_code_valid() else None
        return None


class GroupMemberSerializer(serializers.ModelSerializer):
    """群组成员序列化器"""
    user = UserSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ['id', 'user', 'role', 'joined_at', 'is_active']
        read_only_fields = ['id', 'user', 'joined_at']


class GroupInvitationSerializer(serializers.ModelSerializer):
    """群组邀请序列化器"""
    group = GroupSerializer(read_only=True)
    inviter = UserSerializer(read_only=True)
    invitee = UserSerializer(read_only=True)

    class Meta:
        model = GroupInvitation
        fields = ['id', 'group', 'inviter', 'invitee', 'status', 'created_at', 'expires_at', 'responded_at']
        read_only_fields = ['id', 'group', 'inviter', 'invitee', 'created_at', 'expires_at', 'responded_at']


class SharedScreenSerializer(serializers.ModelSerializer):
    """共享屏幕序列化器"""
    user = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)

    class Meta:
        model = SharedScreen
        fields = ['id', 'group', 'user', 'title', 'status', 'started_at', 'ended_at', 'webrtc_room_id']
        read_only_fields = ['id', 'group', 'user', 'started_at', 'ended_at', 'webrtc_room_id']
