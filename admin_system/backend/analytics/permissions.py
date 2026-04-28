from rest_framework.permissions import BasePermission

class CanViewAnalytics(BasePermission):
    """允许用户查看分析数据的权限"""
    def has_permission(self, request, view):
        return request.user and request.user.has_perm('analytics.view_analytics_report')

class CanGenerateReports(BasePermission):
    """允许用户生成报表的权限"""
    def has_permission(self, request, view):
        return request.user and request.user.has_perm('analytics.add_analytics_report')

class CanExportReports(BasePermission):
    """允许用户导出报表的权限"""
    def has_permission(self, request, view):
        return request.user and request.user.has_perm('analytics.export_analytics_report')

