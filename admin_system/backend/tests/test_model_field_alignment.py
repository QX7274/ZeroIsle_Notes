"""模型字段对齐守护：防止"集合里有、模型没声明"的字段再次导致 500。

背景
----
管理后台与主后端共用同一个 users 集合。集合中的字段由主后端定义，
管理后台的 UserProfile 只声明了其中一部分。

mongoengine 的 Document.__getattr__ 对**未声明**字段会抛 FieldDoesNotExist，
而且 getattr(obj, name, default) **屏蔽不掉**该异常
（默认值只在抛 AttributeError 时生效）。
因此代码里只要读到未声明字段，接口就直接 500。

本轮已因此修掉两处真实缺陷：
  1. password     未声明 -> 管理后台无法校验密码，登录不可能成功；
  2. is_superuser 未声明 -> analytics 权限判定抛 AttributeError。

本文件把这个教训固化为测试。
"""

import ast
import pathlib

import pytest

from users.models import UserProfile

def _find_repo_root(start):
    """向上寻找仓库根（含 backend/users/mongodb_models.py 的那一层）。

    不写死 parents[N]：本仓库在隔离 worktree 下运行测试时，
    文件深度与主工作区不同，硬编码层级会指到错误目录并让测试被静默跳过。
    """
    for parent in [start, *start.parents]:
        candidate = parent / "backend" / "users" / "mongodb_models.py"
        if candidate.exists():
            return parent
    return None


REPO_ROOT = _find_repo_root(pathlib.Path(__file__).resolve())
MAIN_USER_MODEL = (
    REPO_ROOT / "backend" / "users" / "mongodb_models.py" if REPO_ROOT else None
)

# 这些字段主后端有、但管理后台**有意**不声明。
# 每一条都要写明理由，避免用"忽略清单"掩盖真实缺漏。
INTENTIONALLY_OMITTED = {
    # 管理后台不需要参与 Realm 同步的写入，且其值可能含敏感凭证；
    # 目前没有任何代码读取它，保持不声明以免扩大暴露面。
    "realm_api_key",
}


def _declared_fields(path, class_name):
    """从源码静态提取某 Document 类声明的字段名 -> 字段类型名。"""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            out = {}
            for st in node.body:
                if (
                    isinstance(st, ast.Assign)
                    and len(st.targets) == 1
                    and isinstance(st.targets[0], ast.Name)
                    and isinstance(st.value, ast.Call)
                ):
                    fn = getattr(st.value.func, "id", "")
                    if fn.endswith("Field"):
                        out[st.targets[0].id] = fn
            return out
    return {}


@pytest.mark.skipif(
    MAIN_USER_MODEL is None or not MAIN_USER_MODEL.exists(),
    reason="未找到主后端模型（可能只检出 admin_system 子集）",
)
def test_userprofile_declares_all_main_user_fields():
    """users 集合的字段必须都在 UserProfile 中声明（除显式忽略项）。

    否则读取该字段会抛 FieldDoesNotExist 导致 500。
    """
    main_fields = _declared_fields(MAIN_USER_MODEL, "User")
    admin_model_path = pathlib.Path(__file__).resolve().parents[1] / "users" / "models.py"
    admin_fields = _declared_fields(admin_model_path, "UserProfile")

    assert main_fields, "未能从主后端模型解析出字段，测试前提不成立"
    assert admin_fields, "未能从管理后台模型解析出字段，测试前提不成立"

    missing = sorted(
        set(main_fields) - set(admin_fields) - set(INTENTIONALLY_OMITTED)
    )
    assert not missing, (
        "以下字段在主后端 users 集合中存在，但管理后台未声明："
        f"{missing}\n"
        "mongoengine 读取未声明字段会抛 FieldDoesNotExist（getattr 默认值无效），"
        "会导致接口 500。请在 users/models.py 的 UserProfile 中声明它们，"
        "或加入 INTENTIONALLY_OMITTED 并写明理由。"
    )


def test_critical_fields_are_readable():
    """关键字段必须能直接读取（回归 password / is_superuser 两处缺陷）。"""
    user = UserProfile(username="field_probe", email="field_probe@example.com")
    for name in ("password", "is_superuser", "is_staff", "is_active",
                 "is_verified", "first_name", "last_name", "realm_id"):
        # 不应抛 FieldDoesNotExist
        getattr(user, name)


def test_is_superuser_does_not_raise_via_getattr():
    """getattr 带默认值也不能屏蔽 FieldDoesNotExist，故必须声明字段。"""
    user = UserProfile(username="super_probe", email="super_probe@example.com")
    assert getattr(user, "is_superuser", False) is False
