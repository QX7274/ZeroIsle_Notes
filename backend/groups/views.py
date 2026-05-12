"""
群组模块视图
"""

import random
import string
import uuid
from django.utils import timezone
from mongoengine.queryset.visitor import Q
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from .mongodb_models import Group, GroupMember, GroupInvitation, SharedScreen
from .serializers import (
    GroupSerializer, GroupDetailSerializer, GroupMemberSerializer,
    GroupInvitationSerializer, GroupInviteCandidateSerializer, SharedScreenSerializer
)
import logging
from notification.services import NotificationService
from users.utils import get_mongo_user_from_django


def _get_request_mongo_user(request):
    if hasattr(request, 'mongo_user') and request.mongo_user:
        return request.mongo_user
    return get_mongo_user_from_django(getattr(request, 'user', None))


def _is_group_creator(group, mongo_user):
    return bool(
        group
        and mongo_user
        and str(getattr(group.creator, 'id', '')) == str(getattr(mongo_user, 'id', ''))
    )


def _get_visible_groups_for_mongo_user(mongo_user):
    if not mongo_user:
        return Group.objects.none()

    member_group_ids = [
        str(getattr(member.group, 'id', ''))
        for member in GroupMember.objects.filter(user=mongo_user, is_active=True)
        if getattr(member, 'group', None) is not None
    ]
    member_group_ids = list(dict.fromkeys(filter(None, member_group_ids)))

    group_query = Q(creator=mongo_user)
    if member_group_ids:
        group_query = group_query | Q(id__in=member_group_ids)

    return Group.objects.filter(group_query, is_active=True).distinct()


class IsGroupCreatorOrAdmin(permissions.BasePermission):
    """
    检查用户是否为群组创建者或管理员
    """
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            group = obj
        elif hasattr(obj, 'group'):
            group = obj.group
        else:
            return False

        mongo_user = _get_request_mongo_user(request)
        if _is_group_creator(group, mongo_user):
            return True

        if not mongo_user:
            return False

        return GroupMember.objects.filter(
            group=group,
            user=mongo_user,
            role='admin',
            is_active=True
        ).exists()


class IsGroupMember(permissions.BasePermission):
    """
    检查用户是否为群组成员
    """
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            group = obj
        elif hasattr(obj, 'group'):
            group = obj.group
        else:
            return False

        mongo_user = _get_request_mongo_user(request)
        if _is_group_creator(group, mongo_user):
            return True

        if not mongo_user:
            return False

        return GroupMember.objects.filter(
            group=group,
            user=mongo_user,
            is_active=True
        ).exists()


class GroupViewSet(viewsets.ModelViewSet):
    """
    群组视图集
    """
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """获取用户可见的群组"""
        mongo_user = _get_request_mongo_user(self.request)
        return _get_visible_groups_for_mongo_user(mongo_user)

    def get_serializer_class(self):
        """根据操作选择序列化器"""
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer

    def perform_create(self, serializer):
        """创建群组时设置创建者"""
        mongo_user = _get_request_mongo_user(self.request)
        if not mongo_user:
            raise ValidationError({"detail": "当前用户缺少 Mongo 用户映射"})
        serializer.save(creator=mongo_user)

    @action(detail=True, methods=['post'], url_path='generate-join-code')
    def generate_join_code(self, request, pk=None):
        """生成群组加入码"""
        group = self.get_object()

        # 检查权限
        if not IsGroupCreatorOrAdmin().has_object_permission(request, self, group):
            return Response(
                {"detail": "您没有权限生成加入码"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 获取过期时间（分钟）
        expires_in = request.data.get('expires_in', 30)
        try:
            expires_in = int(expires_in)
            if expires_in < 5 or expires_in > 1440:  # 5分钟到24小时
                raise ValueError()
        except (ValueError, TypeError):
            return Response(
                {"detail": "过期时间必须是5到1440之间的整数（分钟）"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 生成加入码
        join_code = group.generate_join_code(expires_in_minutes=expires_in)

        return Response({
            "join_code": join_code,
            "expires_at": group.join_code_expires_at
        })

    @action(detail=False, methods=['post'], url_path='join-by-code')
    def join_by_code(self, request):
        """通过加入码加入群组"""
        mongo_user = _get_request_mongo_user(request)
        if not mongo_user:
            return Response(
                {"detail": "当前用户缺少 Mongo 用户映射"},
                status=status.HTTP_400_BAD_REQUEST
            )

        join_code = request.data.get('join_code')
        if not join_code:
            return Response(
                {"detail": "加入码不能为空"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 查找群组
        try:
            group = Group.objects.get(
                join_code=join_code,
                join_code_expires_at__gt=timezone.now(),
                is_active=True
            )
        except Group.DoesNotExist:
            return Response(
                {"detail": "加入码无效或已过期"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 检查用户是否已经是成员
        if GroupMember.objects.filter(group=group, user=mongo_user).exists():
            # 如果已经是成员但被禁用，则重新激活
            member = GroupMember.objects.get(group=group, user=mongo_user)
            if not member.is_active:
                member.is_active = True
                member.save()
                return Response(
                    {"detail": "您已重新加入群组", "group": GroupSerializer(group).data},
                    status=status.HTTP_200_OK
                )
            return Response(
                {"detail": "您已经是该群组的成员", "group": GroupSerializer(group).data},
                status=status.HTTP_200_OK
            )

        # 创建成员
        GroupMember.objects.create(
            group=group,
            user=mongo_user,
            role='member'
        )

        return Response(
            {"detail": "成功加入群组", "group": GroupSerializer(group).data},
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """邀请用户加入群组"""
        group = self.get_object()
        mongo_user = _get_request_mongo_user(request)
        if not mongo_user:
            return Response(
                {"detail": "当前用户缺少 Mongo 用户映射"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查权限
        if not IsGroupCreatorOrAdmin().has_object_permission(request, self, group):
            return Response(
                {"detail": "您没有权限邀请用户"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 获取被邀请人
        invitee_id = request.data.get('user_id')
        if not invitee_id:
            return Response(
                {"detail": "用户ID不能为空"},
                status=status.HTTP_400_BAD_REQUEST
            )

        from users.mongodb_models import User
        try:
            invitee = User.objects.get(id=invitee_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "用户不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 检查用户是否已经是成员
        if GroupMember.objects.filter(group=group, user=invitee, is_active=True).exists():
            return Response(
                {"detail": "该用户已经是群组成员"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查是否已经有待处理的邀请
        if GroupInvitation.objects.filter(
            group=group,
            invitee=invitee,
            status='pending',
            expires_at__gt=timezone.now()
        ).exists():
            return Response(
                {"detail": "已经向该用户发送了邀请"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 创建邀请
        expires_at = timezone.now() + timezone.timedelta(days=7)  # 默认7天过期
        invitation = GroupInvitation.objects.create(
            group=group,
            inviter=mongo_user,
            invitee=invitee,
            expires_at=expires_at
        )

        # 发送通知给被邀请人（失败不影响主流程）
        try:
            NotificationService().create_notification(
                recipient=invitee,
                notification_type='collaboration',
                title='群组邀请',
                message=f'{mongo_user.username} 邀请你加入群组 "{group.name}"',
                sender=mongo_user,
                related_object=invitation
            )
        except Exception as notify_error:
            logging.getLogger(__name__).warning(f"发送群组邀请通知失败: {notify_error}")

        return Response(
            GroupInvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['get'], url_path='invite-candidates')
    def invite_candidates(self, request, pk=None):
        """搜索可邀请的群组候选用户"""
        group = self.get_object()
        mongo_user = _get_request_mongo_user(request)
        if not mongo_user:
            return Response(
                {"detail": "当前用户缺少 Mongo 用户映射"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not IsGroupCreatorOrAdmin().has_object_permission(request, self, group):
            return Response(
                {"detail": "您没有权限邀请用户"},
                status=status.HTTP_403_FORBIDDEN
            )

        keyword = (request.query_params.get('keyword') or '').strip()
        if len(keyword) < 2:
            return Response(
                {"detail": "搜索关键词至少需要 2 个字符"},
                status=status.HTTP_400_BAD_REQUEST
            )

        from users.mongodb_models import User

        member_user_ids = {
            str(getattr(member.user, 'id', ''))
            for member in GroupMember.objects.filter(group=group, is_active=True)
            if getattr(member, 'user', None) is not None
        }
        pending_invitee_ids = {
            str(getattr(invitation.invitee, 'id', ''))
            for invitation in GroupInvitation.objects.filter(
                group=group,
                status='pending',
                expires_at__gt=timezone.now()
            )
            if getattr(invitation, 'invitee', None) is not None
        }

        candidates = User.objects(
            Q(username__icontains=keyword)
            | Q(nickname__icontains=keyword)
            | Q(email__icontains=keyword)
        ).filter(is_active=True)[:20]

        serializer = GroupInviteCandidateSerializer(
            candidates,
            many=True,
            context={
                'request_mongo_user_id': str(getattr(mongo_user, 'id', '')),
                'member_user_ids': member_user_ids,
                'pending_invitee_ids': pending_invitee_ids,
            }
        )
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """获取群组成员列表"""
        group = self.get_object()

        # 检查权限
        if not IsGroupMember().has_object_permission(request, self, group):
            return Response(
                {"detail": "您不是该群组的成员"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 获取成员列表
        members = GroupMember.objects.filter(group=group, is_active=True)
        serializer = GroupMemberSerializer(members, many=True)

        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """离开群组"""
        group = self.get_object()
        mongo_user = _get_request_mongo_user(request)
        if not mongo_user:
            return Response(
                {"detail": "当前用户缺少 Mongo 用户映射"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查是否为创建者
        if _is_group_creator(group, mongo_user):
            return Response(
                {"detail": "群组创建者不能离开群组，请先转让群组或删除群组"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查是否为成员
        try:
            member = GroupMember.objects.get(group=group, user=mongo_user, is_active=True)
        except GroupMember.DoesNotExist:
            return Response(
                {"detail": "您不是该群组的成员"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 设置为非活跃
        member.is_active = False
        member.save()

        return Response(
            {"detail": "您已成功离开群组"},
            status=status.HTTP_200_OK
        )


class GroupInvitationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    群组邀请视图集
    """
    serializer_class = GroupInvitationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """获取用户收到的邀请"""
        mongo_user = _get_request_mongo_user(self.request)
        if not mongo_user:
            return GroupInvitation.objects.none()
        return GroupInvitation.objects.filter(
            invitee=mongo_user,
            status='pending',
            expires_at__gt=timezone.now()
        )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """接受邀请"""
        invitation = self.get_object()
        mongo_user = _get_request_mongo_user(request)
        if not mongo_user:
            return Response(
                {"detail": "当前用户缺少 Mongo 用户映射"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查邀请是否已过期
        if invitation.is_expired():
            invitation.status = 'expired'
            invitation.save()
            return Response(
                {"detail": "邀请已过期"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查用户是否已经是成员
        if GroupMember.objects.filter(
            group=invitation.group,
            user=mongo_user,
            is_active=True
        ).exists():
            invitation.status = 'accepted'
            invitation.responded_at = timezone.now()
            invitation.save()
            return Response(
                {"detail": "您已经是该群组的成员"},
                status=status.HTTP_200_OK
            )

        # 创建成员
        GroupMember.objects.create(
            group=invitation.group,
            user=mongo_user,
            role='member'
        )

        # 更新邀请状态
        invitation.status = 'accepted'
        invitation.responded_at = timezone.now()
        invitation.save()

        return Response(
            {"detail": "成功加入群组", "group": GroupSerializer(invitation.group).data},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒绝邀请"""
        invitation = self.get_object()

        # 检查邀请是否已过期
        if invitation.is_expired():
            invitation.status = 'expired'
            invitation.save()
            return Response(
                {"detail": "邀请已过期"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 更新邀请状态
        invitation.status = 'rejected'
        invitation.responded_at = timezone.now()
        invitation.save()

        return Response(
            {"detail": "已拒绝邀请"},
            status=status.HTTP_200_OK
        )


class SharedScreenViewSet(viewsets.ModelViewSet):
    """
    共享屏幕视图集
    """
    serializer_class = SharedScreenSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """获取用户可见的共享屏幕"""
        mongo_user = _get_request_mongo_user(self.request)
        if not mongo_user:
            return SharedScreen.objects.none()

        visible_groups = list(_get_visible_groups_for_mongo_user(mongo_user))
        return SharedScreen.objects.filter(
            Q(user=mongo_user) | Q(group__in=visible_groups),
            status__in=['active', 'paused']
        ).distinct()

    def perform_create(self, serializer):
        """创建共享屏幕时校验群组和成员资格，并生成WebRTC房间ID。"""
        mongo_user = _get_request_mongo_user(self.request)
        if not mongo_user:
            raise ValidationError({"detail": "当前用户缺少 Mongo 用户映射"})

        group_id = self.request.data.get('group_id')
        if not group_id:
            raise ValidationError({"group_id": "群组ID不能为空"})

        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            raise NotFound("群组不存在")

        if not IsGroupMember().has_object_permission(self.request, self, group):
            raise PermissionDenied("您不是该群组的成员")

        webrtc_room_id = f"screen_{uuid.uuid4().hex[:8]}"

        serializer.save(
            user=mongo_user,
            group=group,
            webrtc_room_id=webrtc_room_id
        )

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """暂停共享"""
        shared_screen = self.get_object()
        mongo_user = _get_request_mongo_user(request)

        # 检查权限
        if not mongo_user or str(getattr(shared_screen.user, 'id', '')) != str(getattr(mongo_user, 'id', '')):
            return Response(
                {"detail": "只有共享者可以暂停共享"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 更新状态
        shared_screen.status = 'paused'
        shared_screen.save()

        return Response(
            {"detail": "共享已暂停"},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """恢复共享"""
        shared_screen = self.get_object()
        mongo_user = _get_request_mongo_user(request)

        # 检查权限
        if not mongo_user or str(getattr(shared_screen.user, 'id', '')) != str(getattr(mongo_user, 'id', '')):
            return Response(
                {"detail": "只有共享者可以恢复共享"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 检查状态
        if shared_screen.status != 'paused':
            return Response(
                {"detail": "只有暂停状态的共享可以恢复"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 更新状态
        shared_screen.status = 'active'
        shared_screen.save()

        return Response(
            {"detail": "共享已恢复"},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """结束共享"""
        shared_screen = self.get_object()
        mongo_user = _get_request_mongo_user(request)

        # 检查权限
        if (
            not mongo_user
            or (
                str(getattr(shared_screen.user, 'id', '')) != str(getattr(mongo_user, 'id', ''))
                and not IsGroupCreatorOrAdmin().has_object_permission(request, self, shared_screen.group)
            )
        ):
            return Response(
                {"detail": "只有共享者或群组管理员可以结束共享"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 更新状态
        shared_screen.status = 'ended'
        shared_screen.ended_at = timezone.now()
        shared_screen.save()

        return Response(
            {"detail": "共享已结束"},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'])
    def join(self, request, pk=None):
        """加入共享"""
        shared_screen = self.get_object()

        # 检查状态
        if shared_screen.status == 'ended':
            return Response(
                {"detail": "共享已结束"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查权限
        if not IsGroupMember().has_object_permission(request, self, shared_screen.group):
            return Response(
                {"detail": "您不是该群组的成员"},
                status=status.HTTP_403_FORBIDDEN
            )

        return Response({
            "webrtc_room_id": shared_screen.webrtc_room_id,
            "status": shared_screen.status
        })
