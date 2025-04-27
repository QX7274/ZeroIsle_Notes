"""
笔记分享视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteShare
from notes.serializers import NoteShareSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

class NoteShareViewSet(viewsets.ModelViewSet):
    """
    笔记分享视图集
    """
    serializer_class = NoteShareSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        note_id = self.request.query_params.get('note_id')
        if note_id:
            return NoteShare.objects.filter(note__user=user, note_id=note_id)
        return NoteShare.objects.filter(note__user=user)
    
    def perform_create(self, serializer):
        """创建分享时设置创建时间"""
        serializer.save(created_at=timezone.now())
    
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """撤销分享"""
        share = self.get_object()
        try:
            share.is_active = False
            share.revoked_at = timezone.now()
            share.save()
            return Response({'message': '分享已撤销'})
        except Exception as e:
            logger.error(f"撤销分享失败: {str(e)}")
            return Response(
                {'error': '撤销分享失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def shared_with_me(self, request):
        """获取与我分享的笔记"""
        try:
            shares = NoteShare.objects.filter(
                shared_with=request.user,
                is_active=True,
                expires_at__gt=timezone.now()
            )
            return Response(NoteShareSerializer(shares, many=True).data)
        except Exception as e:
            logger.error(f"获取分享笔记失败: {str(e)}")
            return Response(
                {'error': '获取分享笔记失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def my_shares(self, request):
        """获取我分享的笔记"""
        try:
            shares = NoteShare.objects.filter(
                note__user=request.user,
                is_active=True
            )
            return Response(NoteShareSerializer(shares, many=True).data)
        except Exception as e:
            logger.error(f"获取我的分享失败: {str(e)}")
            return Response(
                {'error': '获取我的分享失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 