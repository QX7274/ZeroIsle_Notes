"""
群组模块序列化器
"""

from rest_framework import serializers

from users.serializers import UserSerializer
from users.utils import get_mongo_user_from_django

from .mongodb_models import Group, GroupInvitation, GroupMember, SharedScreen


class GroupSerializer(serializers.ModelSerializer):
    """群组序列化器"""

    creator = UserSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'creator', 'created_at', 'updated_at', 'member_count']
        read_only_fields = ['id', 'creator', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return GroupMember.objects.filter(group=obj, is_active=True).count()


class GroupDetailSerializer(GroupSerializer):
    """群组详情序列化器"""

    join_code = serializers.SerializerMethodField()
    join_code_expires_at = serializers.SerializerMethodField()
    can_invite = serializers.SerializerMethodField()
    can_generate_join_code = serializers.SerializerMethodField()

    class Meta(GroupSerializer.Meta):
        fields = GroupSerializer.Meta.fields + [
            'join_code',
            'join_code_expires_at',
            'can_invite',
            'can_generate_join_code',
        ]

    def _get_request_mongo_user(self):
        request = self.context.get('request')
        if not request:
            return None
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user
        return get_mongo_user_from_django(getattr(request, 'user', None))

    def _can_manage_group(self, obj):
        request = self.context.get('request')
        if not request or not getattr(request.user, 'is_authenticated', False):
            return False

        mongo_user = self._get_request_mongo_user()
        if not mongo_user:
            return False

        return bool(
            str(getattr(obj.creator, 'id', '')) == str(getattr(mongo_user, 'id', ''))
            or GroupMember.objects.filter(
                group=obj,
                user=mongo_user,
                role='admin',
                is_active=True,
            ).first()
        )

    def get_join_code(self, obj):
        if self._can_manage_group(obj):
            return obj.join_code if obj.is_join_code_valid() else None
        return None

    def get_join_code_expires_at(self, obj):
        if self._can_manage_group(obj):
            return obj.join_code_expires_at if obj.is_join_code_valid() else None
        return None

    def get_can_invite(self, obj):
        return self._can_manage_group(obj)

    def get_can_generate_join_code(self, obj):
        return self._can_manage_group(obj)


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


class GroupInviteCandidateSerializer(serializers.Serializer):
    """群组邀请候选用户序列化器"""

    id = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    nickname = serializers.CharField(read_only=True)
    avatar = serializers.CharField(read_only=True)
    can_invite = serializers.SerializerMethodField()
    invite_block_reason = serializers.SerializerMethodField()

    def get_can_invite(self, obj):
        return self.get_invite_block_reason(obj) is None

    def get_invite_block_reason(self, obj):
        user_id = str(getattr(obj, 'id', ''))
        if user_id == self.context.get('request_mongo_user_id'):
            return '不能邀请自己'
        if user_id in self.context.get('member_user_ids', set()):
            return '该用户已经是群成员'
        if user_id in self.context.get('pending_invitee_ids', set()):
            return '该用户已经有待处理邀请'
        return None

    def to_representation(self, instance):
        return {
            'id': str(getattr(instance, 'id', '')),
            'username': getattr(instance, 'username', '') or '',
            'nickname': getattr(instance, 'nickname', '') or '',
            'avatar': getattr(instance, 'avatar', '') or '',
            'can_invite': self.get_can_invite(instance),
            'invite_block_reason': self.get_invite_block_reason(instance),
        }


class SharedScreenSerializer(serializers.ModelSerializer):
    """共享屏幕序列化器"""

    user = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)

    class Meta:
        model = SharedScreen
        fields = ['id', 'group', 'user', 'title', 'status', 'started_at', 'ended_at', 'webrtc_room_id']
        read_only_fields = ['id', 'group', 'user', 'started_at', 'ended_at', 'webrtc_room_id']
