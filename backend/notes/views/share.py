"""
笔记分享视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteShare, Note
from notes.serializers import NoteShareSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import timedelta
import uuid
import random
import string

logger = logging.getLogger(__name__)

class NoteShareViewSet(viewsets.ViewSet):
    """
    笔记分享视图集
    """
    serializer_class = NoteShareSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取分享列表"""
        user = request.user
        note_id = request.query_params.get('note_id')

        if note_id:
            shares = NoteShare.objects.filter(note__user=user, note=note_id)
        else:
            shares = NoteShare.objects.filter(user=user)

        serializer = NoteShareSerializer(shares, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个分享详情"""
        try:
            share = NoteShare.objects.get(id=pk, user=request.user)
            serializer = NoteShareSerializer(share)
            return Response(serializer.data)
        except NoteShare.DoesNotExist:
            return Response(
                {"detail": "分享不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建分享"""
        serializer = NoteShareSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取笔记
            note_id = request.data.get('note')
            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 生成分享码
            share_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))

            # 创建分享
            share = NoteShare(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                share_type=request.data.get('share_type', 'link'),
                share_to=request.data.get('share_to', ''),
                share_code=share_code,
                expires_at=request.data.get('expires_at'),
                is_password_protected=request.data.get('is_password_protected', False),
                password=request.data.get('password', ''),
                is_active=True,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            share.save()

            serializer = NoteShareSerializer(share)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新分享"""
        try:
            share = NoteShare.objects.get(id=pk, user=request.user)
            serializer = NoteShareSerializer(share, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新分享信息
                share.share_type = request.data.get('share_type', share.share_type)
                share.share_to = request.data.get('share_to', share.share_to)
                share.expires_at = request.data.get('expires_at', share.expires_at)
                share.is_password_protected = request.data.get('is_password_protected', share.is_password_protected)

                # 只有在提供了新密码时才更新密码
                if 'password' in request.data and request.data['password']:
                    share.password = request.data['password']

                share.is_active = request.data.get('is_active', share.is_active)
                share.updated_at = timezone.now()
                share.save()

                serializer = NoteShareSerializer(share)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteShare.DoesNotExist:
            return Response(
                {"detail": "分享不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除分享"""
        try:
            share = NoteShare.objects.get(id=pk, user=request.user)
            share.is_active = False
            share.updated_at = timezone.now()
            share.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteShare.DoesNotExist:
            return Response(
                {"detail": "分享不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """撤销分享"""
        try:
            share = NoteShare.objects.get(id=pk, user=request.user)
            share.is_active = False
            share.updated_at = timezone.now()
            share.save()
            return Response({'message': '分享已撤销'})
        except NoteShare.DoesNotExist:
            return Response(
                {"detail": "分享不存在"},
                status=status.HTTP_404_NOT_FOUND
            )
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
            # 查找分享给我的邮箱的分享
            email_shares = NoteShare.objects.filter(
                share_type='email',
                share_to=request.user.email,
                is_active=True
            )

            # 查找分享给我的用户的分享
            user_shares = NoteShare.objects.filter(
                share_type='user',
                share_to=str(request.user.id),
                is_active=True
            )

            # 合并结果
            shares = list(email_shares) + list(user_shares)

            # 过滤掉已过期的分享
            valid_shares = []
            for share in shares:
                if not share.is_expired():
                    valid_shares.append(share)

            serializer = NoteShareSerializer(valid_shares, many=True)
            return Response(serializer.data)
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
                user=request.user,
                is_active=True
            )
            serializer = NoteShareSerializer(shares, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取我的分享失败: {str(e)}")
            return Response(
                {'error': '获取我的分享失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def by_code(self, request):
        """通过分享码获取分享"""
        share_code = request.query_params.get('code')
        if not share_code:
            return Response(
                {'error': '缺少分享码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            share = NoteShare.objects.get(
                share_code=share_code,
                is_active=True
            )

            # 检查是否过期
            if share.is_expired():
                return Response(
                    {'error': '分享已过期'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 增加查看次数
            share.increment_view_count()

            # 如果需要密码，则不返回笔记内容
            if share.is_password_protected:
                serializer = NoteShareSerializer(share, context={'hide_content': True})
                return Response({
                    'share': serializer.data,
                    'requires_password': True
                })

            serializer = NoteShareSerializer(share)
            return Response(serializer.data)
        except NoteShare.DoesNotExist:
            return Response(
                {'error': '分享不存在或已失效'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"获取分享失败: {str(e)}")
            return Response(
                {'error': '获取分享失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def verify_password(self, request, pk=None):
        """验证分享密码"""
        password = request.data.get('password')
        if not password:
            return Response(
                {'error': '缺少密码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            share = NoteShare.objects.get(id=pk, is_active=True)

            # 检查是否过期
            if share.is_expired():
                return Response(
                    {'error': '分享已过期'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 验证密码
            if share.password != password:
                return Response(
                    {'error': '密码错误'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = NoteShareSerializer(share)
            return Response(serializer.data)
        except NoteShare.DoesNotExist:
            return Response(
                {'error': '分享不存在或已失效'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"验证密码失败: {str(e)}")
            return Response(
                {'error': '验证密码失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )