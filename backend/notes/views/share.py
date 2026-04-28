"""
笔记分享视图（优化版）
- 使用ShareService封装业务逻辑
- 修复权限控制（by_code和verify_password允许匿名访问）
- 修复查询语法
- 添加访问审计
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from notes.mongodb_models import NoteShare, Note
from notes.serializers import NoteShareSerializer
from notes.services.share_service import ShareService
from common.permissions import IsOwnerOrReadOnly
import logging

logger = logging.getLogger(__name__)

class NoteShareViewSet(viewsets.ViewSet):
    """
    笔记分享视图集（优化版）
    - 使用ShareService
    - 修复查询语法
    - 正确的权限控制
    """
    serializer_class = NoteShareSerializer
    permission_classes = [IsAuthenticated]  # 默认需要认证

    def get_permissions(self):
        """
        根据action设置不同的权限
        """
        if self.action in ['by_code', 'verify_password']:
            # by_code和verify_password允许匿名访问
            return [AllowAny()]
        return [IsAuthenticated()]

    def list(self, request):
        """获取分享列表（修复查询语法）"""
        user = request.user
        note_id = request.query_params.get('note_id')

        if note_id:
            # 修复：先获取Note对象，再按note引用过滤
            try:
                note = Note.objects.get(id=note_id, user=user)
                shares = ShareService.get_user_shares(user, note=note)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            shares = ShareService.get_user_shares(user)

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
        """创建分享（使用ShareService）"""
        # 获取笔记
        note_id = request.data.get('note')
        if not note_id:
            return Response(
                {"detail": "缺少笔记ID"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {"detail": "笔记不存在或无权访问"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 使用ShareService创建分享
        try:
            share = ShareService.create_share(
                note=note,
                user=request.user,
                share_type=request.data.get('share_type', 'link'),
                share_to=request.data.get('share_to'),
                password=request.data.get('password'),
                expires_at=request.data.get('expires_at'),
                max_view_count=request.data.get('max_view_count')
            )

            serializer = NoteShareSerializer(share)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"创建分享失败: {str(e)}")
            return Response(
                {"detail": "创建分享失败"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, pk=None):
        """更新分享（使用ShareService）"""
        try:
            share = NoteShare.objects.get(id=pk, user=request.user)

            # 使用ShareService更新
            password = request.data.get('password') if 'password' in request.data else None

            share = ShareService.update_share(
                share=share,
                share_type=request.data.get('share_type'),
                share_to=request.data.get('share_to'),
                password=password,
                expires_at=request.data.get('expires_at'),
                max_view_count=request.data.get('max_view_count'),
                is_active=request.data.get('is_active')
            )

            serializer = NoteShareSerializer(share)
            return Response(serializer.data)
        except NoteShare.DoesNotExist:
            return Response(
                {"detail": "分享不存在或无权访问"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"更新分享失败: {str(e)}")
            return Response(
                {"detail": "更新分享失败"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, pk=None):
        """删除分享（软删除）"""
        try:
            share = NoteShare.objects.get(id=pk, user=request.user)
            ShareService.revoke_share(share)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteShare.DoesNotExist:
            return Response(
                {"detail": "分享不存在或无权访问"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"删除分享失败: {str(e)}")
            return Response(
                {"detail": "删除分享失败"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """撤销分享（使用ShareService）"""
        try:
            share = NoteShare.objects.get(id=pk, user=request.user)
            ShareService.revoke_share(share)
            return Response({'message': '分享已撤销'})
        except NoteShare.DoesNotExist:
            return Response(
                {"detail": "分享不存在或无权访问"},
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
        """获取与我分享的笔记（使用ShareService）"""
        try:
            shares = ShareService.get_shares_to_user(request.user, active_only=True)
            serializer = NoteShareSerializer(shares, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取分享笔记失败: {str(e)}")
            return Response(
                {'error': '获取分享笔记失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def my_shares(self, request):
        """获取我分享的笔记（使用ShareService）"""
        try:
            shares = ShareService.get_user_shares(request.user, active_only=True)
            serializer = NoteShareSerializer(shares, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取我的分享失败: {str(e)}")
            return Response(
                {'error': '获取我的分享失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def by_code(self, request):
        """通过分享码获取分享（允许匿名访问，使用ShareService）"""
        share_code = request.query_params.get('code')
        if not share_code:
            return Response(
                {'error': '缺少分享码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 使用ShareService获取分享
            share = ShareService.get_share_by_code(share_code)
            if not share:
                return Response(
                    {'error': '分享不存在或已失效'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 验证访问权限（不提供密码）
            access_result = ShareService.verify_share_access(share)

            if not access_result['accessible']:
                if access_result['requires_password']:
                    # 需要密码，返回部分信息
                    serializer = NoteShareSerializer(share, context={'hide_content': True})
                    return Response({
                        'share': serializer.data,
                        'requires_password': True
                    })
                else:
                    # 其他原因不可访问
                    return Response(
                        {'error': access_result['reason']},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 记录访问（包含审计日志）
            request_meta = request.META if hasattr(request, 'META') else None
            if not ShareService.record_share_access(share, request_meta):
                return Response(
                    {'error': '已达到最大访问次数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 返回完整信息
            serializer = NoteShareSerializer(share)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取分享失败: {str(e)}")
            return Response(
                {'error': '获取分享失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def verify_password(self, request, pk=None):
        """验证分享密码（允许匿名访问，使用ShareService）"""
        password = request.data.get('password')
        if not password:
            return Response(
                {'error': '缺少密码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            share = NoteShare.objects.get(id=pk, is_active=True)

            # 使用ShareService验证访问权限（包含密码验证）
            access_result = ShareService.verify_share_access(share, password=password)

            if not access_result['accessible']:
                return Response(
                    {'error': access_result['reason']},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 记录访问（包含审计日志）
            request_meta = request.META if hasattr(request, 'META') else None
            if not ShareService.record_share_access(share, request_meta):
                return Response(
                    {'error': '已达到最大访问次数'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 返回完整信息
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