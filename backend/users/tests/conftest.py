"""backend/users/tests 的 mongomock UUID 兼容垫片安装点（RISK-BE-002 同一实现）。

背景：users.User 的主键已与 notes 侧对齐为 binary=True（RISK-BE-003 修复），
mongoengine 在 mongomock 下会写入原生 uuid.UUID，而 mongomock 4.3.0 的
BSON.encode 校验用 UNSPECIFIED 表示 → ValueError。

垫片实现只有一份，放在 backend/notes/tests/conftest.py；这里只负责导入以完成安装，
避免复制第二份逻辑。若将来 users/tests 需要在没有 notes 包的场景下独立运行，
可以改为把实现搬到一个共享模块。
"""

try:
    from notes.tests.conftest import _install_mongomock_uuid_shim
except Exception:  # pragma: no cover - 兜底：导入失败时不要让测试收集直接崩
    _install_mongomock_uuid_shim = None

_SHIM_INSTALLED = bool(_install_mongomock_uuid_shim()) if _install_mongomock_uuid_shim else False
