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
from rest_framework.response import Response
from .mongodb_models import Group, GroupMember, GroupInvitation, SharedScreen
from .serializers import (
    GroupSerializer, GroupDetailSerializer, GroupMemberSerializer,
    GroupInvitationSerializer, SharedScreenSerializer
)


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

        # 检查是否为创建者
        if group.creator == request.user:
            return True

        # 检查是否为管理员
        return GroupMember.objects.filter(
            group=group,
            user=request.user,
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

        # 检查是否为创建者
        if group.creator == request.user:
            return True

        # 检查是否为成员
        return GroupMember.objects.filter(
            group=group,
            user=request.user,
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
        user = self.request.user
        # 用户创建的群组 + 用户加入的群组
        return Group.objects.filter(
            Q(creator=user) | Q(members__user=user, members__is_active=True),
            is_active=True
        ).distinct()

    def get_serializer_class(self):
        """根据操作选择序列化器"""
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer

    def perform_create(self, serializer):
        """创建群组时设置创建者"""
        serializer.save(creator=self.request.user)

    @action(detail=True, methods=['post'])
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

    @action(detail=False, methods=['post'])
    def join_by_code(self, request):
        """通过加入码加入群组"""
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
        if GroupMember.objects.filter(group=group, user=request.user).exists():
            # 如果已经是成员但被禁用，则重新激活
            member = GroupMember.objects.get(group=group, user=request.user)
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
            user=request.user,
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
            inviter=request.user,
            invitee=invitee,
            expires_at=expires_at
        )

        # TODO: 发送通知给被邀请人

        return Response(
            GroupInvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED
        )

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

        # 检查是否为创建者
        if group.creator == request.user:
            return Response(
                {"detail": "群组创建者不能离开群组，请先转让群组或删除群组"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 检查是否为成员
        try:
            member = GroupMember.objects.get(group=group, user=request.user, is_active=True)
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
        return GroupInvitation.objects.filter(
            invitee=self.request.user,
            status='pending',
            expires_at__gt=timezone.now()
        )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """接受邀请"""
        invitation = self.get_object()

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
            user=request.user,
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
            user=request.user,
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
        user = self.request.user
        # 用户创建的共享 + 用户所在群组的共享
        return SharedScreen.objects.filter(
            Q(user=user) | Q(group__members__user=user, group__members__is_active=True),
            status__in=['active', 'paused']
        ).distinct()

    def perform_create(self, serializer):
        """创建共享屏幕时设置用户和WebRTC房间ID"""
        # 获取群组
        group_id = self.request.data.get('group_id')
        if not group_id:
            return Response(
                {"detail": "群组ID不能为空"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response(
                {"detail": "群组不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 检查用户是否为群组成员
        if not IsGroupMember().has_object_permission(self.request, self, group):
            return Response(
                {"detail": "您不是该群组的成员"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 生成WebRTC房间ID
        webrtc_room_id = f"screen_{uuid.uuid4().hex[:8]}"

        serializer.save(
            user=self.request.user,
            group=group,
            webrtc_room_id=webrtc_room_id
        )

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """暂停共享"""
        shared_screen = self.get_object()

        # 检查权限
        if shared_screen.user != request.user:
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

        # 检查权限
        if shared_screen.user != request.user:
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

        # 检查权限
        if shared_screen.user != request.user and not IsGroupCreatorOrAdmin().has_object_permission(request, self, shared_screen.group):
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
