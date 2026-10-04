"""验证 mongoengine 的 Q 组合查询可用，并守护导出接口的关键字过滤。

背景：users/views.py 与 content/views.py 的导出接口此前用
django.db.models.Q 构造 OR 条件：
    queryset.filter(Q(username__icontains=kw) | Q(email__icontains=kw))
但 mongoengine 只认自己的 Q（mongoengine.queryset.visitor.Q），
传 Django 的 Q 会抛：
    InvalidQueryError: Not a query object: (OR: ...) Did you intend to use key=value?
由于这两个接口是"导出"，平时少被触发，静态检查也发现不了。
"""

import pytest
from mongoengine.queryset.visitor import Q as MongoQ

from content.models import Note
from users.models import UserProfile


@pytest.fixture(scope="module")
def users():
    """准备两条用户数据。

    用 module 作用域并做存在性判断：mongomock 的内存库在整个测试进程内共享，
    重复创建同名用户会撞 users.username 唯一索引（NotUniqueError）。
    """
    if not UserProfile.objects(username="q_alice").first():
        UserProfile(username="q_alice", email="alice@example.com").save()
    if not UserProfile.objects(username="q_bob").first():
        UserProfile(username="q_bob", email="bob@example.com").save()


def test_mongoengine_q_with_icontains_works(users):
    qs = UserProfile.objects.filter(
        MongoQ(username__icontains="alice") | MongoQ(email__icontains="alice")
    )
    assert [u.username for u in qs] == ["q_alice"]


def test_django_q_is_not_compatible_with_mongoengine(users):
    """守护：Django 的 Q 在 mongoengine 上必须失败，因此不能用它。

    这条用例的作用是固化"为什么不能用 django.db.models.Q"这一事实；
    若将来 mongoengine 兼容了它，本用例会失败并提醒更新代码与文档。
    """
    from django.db.models import Q as DjangoQ

    with pytest.raises(Exception) as exc:
        UserProfile.objects.filter(
            DjangoQ(username__icontains="alice") | DjangoQ(email__icontains="alice")
        ).count()
    assert "Not a query object" in str(exc.value) or "InvalidQueryError" in type(exc.value).__name__


def test_no_django_q_left_in_export_paths():
    """源码级守护：导出相关的过滤不应再使用 Django 的 Q。

    用 AST 只检查真实的调用/导入，避免被注释与 docstring 误伤。
    """
    import ast
    import pathlib

    backend = pathlib.Path(__file__).resolve().parents[1]
    offenders = []
    for rel in ("users/views.py", "content/views.py"):
        path = backend / rel
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "django.db.models":
                for alias in node.names:
                    if alias.name == "Q":
                        offenders.append(f"{rel}:{node.lineno} 导入 django.db.models.Q")
    assert not offenders, (
        "以下位置仍在使用 Django 的 Q，在 mongoengine 上会抛 InvalidQueryError：\n"
        + "\n".join(offenders)
    )
