"""分析模块权限类测试。

锁定的缺陷：这三个权限类此前用 Django ORM 的 has_perm 做判定，
而方案 B 之后 request.user 是 mongoengine 用户文档，没有 has_perm。
实测抛 AttributeError -> DRF 返回 500，即所有相关接口必然崩溃。
"""

import pytest

from analytics.permissions import (
    CanExportReports,
    CanGenerateReports,
    CanViewAnalytics,
    _is_admin,
)
from users.models import UserProfile

ALL_PERMS = [CanViewAnalytics, CanGenerateReports, CanExportReports]


class _Req:
    def __init__(self, user):
        self.user = user


_SEQ = {'n': 0}


def _user(username, **kwargs):
    """创建测试用户。

    用递增后缀保证 username/email 唯一 —— mongoengine 在 mongomock 下
    跨用例共享同一个内存库，固定名字会在第二次调用时撞唯一索引
    （NotUniqueError），与权限逻辑无关。
    """
    _SEQ['n'] += 1
    suffix = _SEQ['n']
    u = UserProfile(
        username=f'{username}_{suffix}',
        email=f'{username}_{suffix}@example.com',
        **kwargs,
    )
    u.save()
    return u


@pytest.mark.parametrize("perm_cls", ALL_PERMS)
def test_permission_does_not_raise_on_mongoengine_user(perm_cls):
    """核心回归：不得再抛 AttributeError（旧实现导致 500）。"""
    user = _user("perm_staff", is_staff=True)
    # 旧实现会在这里抛 AttributeError: has_perm
    result = perm_cls().has_permission(_Req(user), None)
    assert result is True


@pytest.mark.parametrize("perm_cls", ALL_PERMS)
def test_non_staff_is_denied(perm_cls):
    user = _user("perm_nonstaff", is_staff=False)
    assert perm_cls().has_permission(_Req(user), None) is False


@pytest.mark.parametrize("perm_cls", ALL_PERMS)
def test_superuser_is_allowed(perm_cls):
    user = _user("perm_super", is_staff=False, is_superuser=True)
    assert perm_cls().has_permission(_Req(user), None) is True


@pytest.mark.parametrize("perm_cls", ALL_PERMS)
def test_anonymous_is_denied(perm_cls):
    class _Anon:
        is_authenticated = False
        is_staff = True

    assert perm_cls().has_permission(_Req(_Anon()), None) is False


def test_is_admin_helper_requires_authentication():
    """未认证用户即使带 is_staff 也不放行。"""

    class _Anon:
        is_authenticated = False
        is_staff = True
        is_superuser = True

    assert _is_admin(_Req(_Anon())) is False


def test_no_django_permission_api_left():
    """源码级守护：不应再调用依赖 Django 权限表的接口。

    注意：模块 docstring 里会**提到** has_perm 以说明历史原因，
    因此不能用"源码里不含该字符串"来断言（那样会误伤注释）。
    这里用 AST 检查真实的属性调用（request.user.has_perm(...)），
    只针对可执行代码。
    """
    import ast
    import inspect

    import analytics.permissions as mod

    tree = ast.parse(inspect.getsource(mod))
    forbidden = set()
    for node in ast.walk(tree):
        # 匹配 xxx.has_perm / xxx.has_module_perms 形式的属性访问
        if isinstance(node, ast.Attribute) and node.attr in (
            "has_perm",
            "has_module_perms",
        ):
            forbidden.add(node.attr)
    assert not forbidden, f"仍在使用 Django 权限接口: {sorted(forbidden)}"
