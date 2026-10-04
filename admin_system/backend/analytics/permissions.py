"""分析模块权限类。

背景与修复
--------
此前这三个权限类用 Django ORM 的权限接口做判定：

    return request.user and request.user.has_perm('analytics.view_analytics_report')

但方案 B 之后，request.user 已经是 **mongoengine 的用户文档**，
而 mongoengine 的 Document **没有** has_perm 方法（Django ORM 的 User 才有，
它依赖 auth_permission / auth_user_user_permissions 等 SQL 表）。实测结果：

    AttributeError: 'UserProfile' object has no attribute 'has_perm'

由于这是在权限类的 has_permission 里抛出，DRF 不会把它当成"无权限"，
而是直接 500 —— 即**所有使用这三个权限的接口在任何请求下都会崩**。
涉及 analytics/views.py 的 5 处（报表列表/生成/导出、分析视图等）。

修复口径
--------
本项目并没有启用 Django 的权限表（数据库引擎是 dummy），
因此"细粒度权限位"在本项目中无从谈起。实际可用且与主后端口径一致的
判定依据只有"是否管理员"（is_staff / is_superuser）。

因此这三个类改为**以管理员身份为准**，并保留类名与语义分层：
  - CanViewAnalytics   ：管理员可看分析数据
  - CanGenerateReports ：管理员可生成报表
  - CanExportReports   ：管理员可导出报表

这样既修掉了 500，又不假装实现了并不存在的细粒度权限模型。
若将来需要真正的角色/权限位，应先在 MongoDB 中建立权限模型
（而不是重新引入 Django 权限表），届时再替换这里的判定逻辑。
"""

from rest_framework.permissions import BasePermission


def _is_admin(request):
    """统一的管理员判定：已认证且（is_staff 或 is_superuser）。

    不依赖任何 Django ORM 接口，因此对 mongoengine 用户文档同样适用。
    """
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    return bool(
        getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)
    )


class CanViewAnalytics(BasePermission):
    """允许管理员查看分析数据。

    说明：原实现依赖 Django ORM 的 has_perm，在 mongoengine 用户上会抛
    AttributeError 导致 500；现改为管理员判定（详见模块 docstring）。
    """

    def has_permission(self, request, view):
        return _is_admin(request)


class CanGenerateReports(BasePermission):
    """允许管理员生成报表（同上，原 has_perm 实现已废弃）。"""

    def has_permission(self, request, view):
        return _is_admin(request)


class CanExportReports(BasePermission):
    """允许管理员导出报表（同上，原 has_perm 实现已废弃）。"""

    def has_permission(self, request, view):
        return _is_admin(request)
