"""
社区内容治理（审核）视图
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from ..mongodb_models import Report, Post, Comment
from ..serializers.moderation import ReportSerializer, ReportDetailSerializer
from common.services.audit_service import AuditService

class IsAdminOrModerator(permissions.BasePermission):
    """
    自定义权限，只允许管理员或社区版主访问。
    """
    def has_permission(self, request, view):
        return request.user and (request.user.is_staff or request.user.is_superuser)

class ModerationViewSet(viewsets.ViewSet):
    """
    提供社区内容审核的API端点。
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrModerator]

    def list(self, request):
        """获取待处理的举报列表"""
        status_filter = request.query_params.get('status', 'pending')
        reports = Report.objects.filter(status=status_filter).order_by('created_at')
        
        page = self.paginate_queryset(reports)
        if page is not None:
            serializer = ReportSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ReportSerializer(reports, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个举报的详细信息，包括被举报内容"""
        try:
            report = Report.objects.get(id=pk)
            serializer = ReportDetailSerializer(report)
            return Response(serializer.data)
        except Report.DoesNotExist:
            return Response({'error': '举报不存在'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """处理举报并采取措施"""
        try:
            report = Report.objects.get(id=pk)
            if report.status != 'pending':
                return Response({'error': '该举报已被处理'}, status=status.HTTP_400_BAD_REQUEST)

            action_taken = request.data.get('action', 'hide') # 'hide', 'delete'
            content_object = self._get_content_object(report)

            if not content_object:
                return Response({'error': '被举报的内容不存在'}, status=status.HTTP_404_NOT_FOUND)

            if action_taken == 'hide':
                if hasattr(content_object, 'status'):
                    content_object.status = 'hidden'
                    content_object.save()
                else:
                    return Response({'error': '该内容不支持隐藏操作'}, status=status.HTTP_400_BAD_REQUEST)
            elif action_taken == 'delete':
                content_object.delete() # Soft delete
            else:
                return Response({'error': '无效的操作'}, status=status.HTTP_400_BAD_REQUEST)

            report.resolve(request.user)

            AuditService.log_action(
                user=request.user,
                action='report_resolved',
                target_object=report,
                details={'action_taken': action_taken},
                request=request
            )

            return Response({'status': 'resolved', 'action_taken': action_taken})
        except Report.DoesNotExist:
            return Response({'error': '举报不存在'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """驳回举报"""
        try:
            report = Report.objects.get(id=pk)
            if report.status != 'pending':
                return Response({'error': '该举报已被处理'}, status=status.HTTP_400_BAD_REQUEST)

            report.reject(request.user)

            AuditService.log_action(
                user=request.user,
                action='report_rejected',
                target_object=report,
                request=request
            )

            return Response({'status': 'rejected'})
        except Report.DoesNotExist:
            return Response({'error': '举报不存在'}, status=status.HTTP_404_NOT_FOUND)

    def _get_content_object(self, report):
        """根据举报信息获取被举报的对象"""
        if report.content_type == 'Post':
            return Post.objects.filter(id=report.object_id).first()
        elif report.content_type == 'Comment':
            return Comment.objects.filter(id=report.object_id).first()
        return None

    # pagination methods to be used by list view
    @property
    def paginator(self):
        if not hasattr(self, '_paginator'):
            from rest_framework.pagination import PageNumberPagination
            self._paginator = PageNumberPagination()
        return self._paginator

    def paginate_queryset(self, queryset):
        return self.paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        return self.paginator.get_paginated_response(data)
