"""
群组模块序列化器
"""

from rest_framework import serializers

from users.serializers import UserSerializer
from users.utils import get_mongo_user_from_django

from .mongodb_models import Group, GroupInvitation, GroupMember, SharedScreen


class GroupSerializer(serializers.Serializer):
    """群组序列化器"""

    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    creator = UserSerializer(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    member_count = serializers.SerializerMethodField()

    def get_member_count(self, obj):
        return GroupMember.objects.filter(group=obj, is_active=True).count()

    def create(self, validated_data):
        return Group.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for field in ['name', 'description']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


class GroupDetailSerializer(GroupSerializer):
    """群组详情序列化器"""

    join_code = serializers.SerializerMethodField()
    join_code_expires_at = serializers.SerializerMethodField()
    can_invite = serializers.SerializerMethodField()
    can_generate_join_code = serializers.SerializerMethodField()

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


class GroupMemberSerializer(serializers.Serializer):
    """群组成员序列化器"""

    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    role = serializers.CharField(read_only=True)
    joined_at = serializers.DateTimeField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)


class GroupInvitationSerializer(serializers.Serializer):
    """群组邀请序列化器"""

    id = serializers.CharField(read_only=True)
    group = GroupSerializer(read_only=True)
    inviter = UserSerializer(read_only=True)
    invitee = UserSerializer(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True)
    responded_at = serializers.DateTimeField(read_only=True, allow_null=True)


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


class SharedScreenSerializer(serializers.Serializer):
    """共享屏幕序列化器"""

    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)
    title = serializers.CharField(max_length=100)
    status = serializers.CharField(read_only=True)
    started_at = serializers.DateTimeField(read_only=True)
    ended_at = serializers.DateTimeField(read_only=True, allow_null=True)
    webrtc_room_id = serializers.CharField(read_only=True)

    def create(self, validated_data):
        return SharedScreen.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for field in ['title', 'status', 'ended_at', 'webrtc_room_id']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance
