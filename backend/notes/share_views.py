"""笔记分享视图"""

from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import Note, NoteShare
from .share_serializers import NoteShareCreateSerializer, NoteShareDetailSerializer, SharedNoteSerializer


class NoteShareViewSet(mixins.CreateModelMixin,
                       mixins.RetrieveModelMixin,
                       mixins.UpdateModelMixin,
                       mixins.DestroyModelMixin,
                       mixins.ListModelMixin,
                       viewsets.GenericViewSet):
    """笔记分享视图集"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # 只返回当前用户分享的笔记
        return NoteShare.objects.filter(note__user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return NoteShareCreateSerializer
        return NoteShareDetailSerializer
    
    def create(self, request, *args, **kwargs):
        # 获取要分享的笔记
        note_id = request.data.get('note_id')
        if not note_id:
            return Response({'error': '必须提供笔记ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response({'error': '笔记不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 创建分享
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.context['note'] = note
        self.perform_create(serializer)
        
        # 返回完整的分享信息
        output_serializer = NoteShareDetailSerializer(serializer.instance)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def reset_link(self, request, pk=None):
        """重置分享链接"""
        share = self.get_object()
        # 更新UUID生成新的分享ID
        import uuid
        share.share_id = uuid.uuid4()
        share.save()
        
        serializer = self.get_serializer(share)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_note(self, request):
        """获取笔记的所有分享"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response({'error': '必须提供笔记ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        shares = NoteShare.objects.filter(note_id=note_id, note__user=request.user)
        serializer = self.get_serializer(shares, many=True)
        return Response(serializer.data)


@api_view(['GET', 'POST'])
def access_shared_note(request, share_id):
    """访问共享笔记"""
    try:
        share = NoteShare.objects.get(share_id=share_id)
    except NoteShare.DoesNotExist:
        raise NotFound('分享链接不存在或已失效')
    
    # 检查分享是否过期
    if share.expires_at and share.expires_at < timezone.now():
        return Response({'error': '分享链接已过期'}, status=status.HTTP_403_FORBIDDEN)
    
    # 检查访问权限
    if share.access_type == 'password':
        # 密码访问
        password = request.data.get('password') if request.method == 'POST' else None
        if not password or password != share.password:
            return Response({
                'access_type': 'password',
                'requires_password': True,
                'message': '请提供访问密码'
            }, status=status.HTTP_401_UNAUTHORIZED)
    
    elif share.access_type == 'specific_users':
        # 指定用户访问
        if request.user.is_anonymous or not share.allowed_users.filter(id=request.user.id).exists():
            return Response({
                'access_type': 'specific_users',
                'message': '您没有权限访问此笔记'
            }, status=status.HTTP_403_FORBIDDEN)
    
    # 增加查看次数
    share.view_count += 1
    share.save()
    
    # 返回笔记内容
    serializer = SharedNoteSerializer(share.note)
    return Response({
        'note': serializer.data,
        'share': {
            'is_editable': share.is_editable,
            'owner_username': share.note.user.username
        }
    })


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_shared_note(request, share_id):
    """更新共享笔记"""
    try:
        share = NoteShare.objects.get(share_id=share_id)
    except NoteShare.DoesNotExist:
        raise NotFound('分享链接不存在或已失效')
    
    # 检查分享是否过期
    if share.expires_at and share.expires_at < timezone.now():
        return Response({'error': '分享链接已过期'}, status=status.HTTP_403_FORBIDDEN)
    
    # 检查是否允许编辑
    if not share.is_editable:
        return Response({'error': '此笔记不允许编辑'}, status=status.HTTP_403_FORBIDDEN)
    
    # 检查访问权限
    if share.access_type == 'specific_users' and not share.allowed_users.filter(id=request.user.id).exists():
        return Response({'error': '您没有权限编辑此笔记'}, status=status.HTTP_403_FORBIDDEN)
    
    # 更新笔记内容
    note = share.note
    content = request.data.get('content')
    if not content:
        return Response({'error': '必须提供笔记内容'}, status=status.HTTP_400_BAD_REQUEST)
    
    note.content = content
    note.save()
    
    serializer = SharedNoteSerializer(note)
    return Response(serializer.data)