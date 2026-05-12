"""
群组模块序列化器
"""

from bson.dbref import DBRef
from mongoengine.errors import DoesNotExist as MongoDoesNotExist
from rest_framework import serializers

from users.utils import get_mongo_user_from_django

from .mongodb_models import Group, GroupInvitation, GroupMember, SharedScreen


def _extract_reference_id(raw_ref):
    if raw_ref is None:
        return None
    if isinstance(raw_ref, DBRef):
        return raw_ref.id
    if hasattr(raw_ref, 'pk'):
        return raw_ref.pk
    if hasattr(raw_ref, 'id'):
        return raw_ref.id
    return raw_ref


def _get_reference_document(instance, field_name, queryset):
    if not instance:
        return None

    try:
        document = getattr(instance, field_name, None)
        if document is not None:
            return document
    except MongoDoesNotExist:
        pass

    raw_ref = getattr(instance, '_data', {}).get(field_name)
    raw_id = _extract_reference_id(raw_ref)
    if raw_id is None:
        return None
    return queryset(id=raw_id).first()


def _serialize_user(instance, field_name='user'):
    from users.mongodb_models import User as MongoUser

    user = _get_reference_document(instance, field_name, MongoUser.objects)
    if not user:
        raw_ref = getattr(instance, '_data', {}).get(field_name) if instance else None
        raw_id = _extract_reference_id(raw_ref)
        return {
            'id': str(raw_id) if raw_id is not None else '',
            'username': '',
            'email': '',
            'phone': '',
            'is_active': False,
            'date_joined': None,
            'last_login': None,
        }

    return {
        'id': str(getattr(user, 'id', '')),
        'username': getattr(user, 'username', '') or '',
        'email': getattr(user, 'email', '') or '',
        'phone': getattr(user, 'phone', '') or '',
        'is_active': bool(getattr(user, 'is_active', False)),
        'date_joined': getattr(user, 'date_joined', None),
        'last_login': getattr(user, 'last_login', None),
    }


def _get_group_creator_id(group):
    if not group:
        return None

    try:
        creator = getattr(group, 'creator', None)
        if creator is not None:
            return _extract_reference_id(creator)
    except MongoDoesNotExist:
        pass

    raw_ref = getattr(group, '_data', {}).get('creator')
    return _extract_reference_id(raw_ref)


def _serialize_group(instance, include_creator=True):
    group = instance
    if not isinstance(instance, Group):
        group = _get_reference_document(instance, 'group', Group.objects)

    if not group:
        raw_ref = getattr(instance, '_data', {}).get('group') if instance else None
        raw_id = _extract_reference_id(raw_ref)
        return {
            'id': str(raw_id) if raw_id is not None else '',
            'name': '',
            'description': '',
            'creator': None if include_creator else None,
            'created_at': None,
            'updated_at': None,
            'member_count': 0,
        }

    creator_payload = _serialize_user(group, 'creator') if include_creator else None
    return {
        'id': str(getattr(group, 'id', '')),
        'name': getattr(group, 'name', '') or '',
        'description': getattr(group, 'description', '') or '',
        'creator': creator_payload,
        'created_at': getattr(group, 'created_at', None),
        'updated_at': getattr(group, 'updated_at', None),
        'member_count': GroupMember.objects.filter(group=group, is_active=True).count(),
    }


class GroupSerializer(serializers.Serializer):
    """群组序列化器"""

    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    creator = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    member_count = serializers.SerializerMethodField()

    def get_creator(self, obj):
        return _serialize_user(obj, 'creator')

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
            str(_get_group_creator_id(obj)) == str(getattr(mongo_user, 'id', ''))
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
    user = serializers.SerializerMethodField()
    role = serializers.CharField(read_only=True)
    joined_at = serializers.DateTimeField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    def get_user(self, obj):
        return _serialize_user(obj, 'user')


class GroupInvitationSerializer(serializers.Serializer):
    """群组邀请序列化器"""

    id = serializers.CharField(read_only=True)
    group = serializers.SerializerMethodField()
    inviter = serializers.SerializerMethodField()
    invitee = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True)
    responded_at = serializers.DateTimeField(read_only=True, allow_null=True)

    def get_group(self, obj):
        return _serialize_group(obj)

    def get_inviter(self, obj):
        return _serialize_user(obj, 'inviter')

    def get_invitee(self, obj):
        return _serialize_user(obj, 'invitee')


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
    user = serializers.SerializerMethodField()
    group = serializers.SerializerMethodField()
    title = serializers.CharField(max_length=100)
    status = serializers.CharField(read_only=True)
    started_at = serializers.DateTimeField(read_only=True)
    ended_at = serializers.DateTimeField(read_only=True, allow_null=True)
    webrtc_room_id = serializers.CharField(read_only=True)

    def get_user(self, obj):
        return _serialize_user(obj, 'user')

    def get_group(self, obj):
        return _serialize_group(obj)

    def create(self, validated_data):
        return SharedScreen.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for field in ['title', 'status', 'ended_at', 'webrtc_room_id']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance
