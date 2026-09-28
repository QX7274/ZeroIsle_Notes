"""backend/scripts/tests 的 mongomock UUID 兼容垫片安装点。

与 backend/users/tests/conftest.py 相同：垫片实现只有一份（backend/notes/tests/conftest.py），
这里只导入以完成安装，避免复制第二份逻辑。
"""

try:
    from notes.tests.conftest import _install_mongomock_uuid_shim
except Exception:  # pragma: no cover - 兜底：导入失败不要让测试收集直接崩
    _install_mongomock_uuid_shim = None

_SHIM_INSTALLED = bool(_install_mongomock_uuid_shim()) if _install_mongomock_uuid_shim else False
