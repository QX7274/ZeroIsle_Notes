"""backend/scripts/tests 的测试隔离与 mongomock UUID 兼容垫片安装点。

垫片实现只有一份（backend/notes/tests/conftest.py），这里只导入以完成安装，避免复制第二份逻辑。
"""

import pytest

try:
    from notes.tests.conftest import _install_mongomock_uuid_shim
except Exception:  # pragma: no cover - 兜底：导入失败不要让测试收集直接崩
    _install_mongomock_uuid_shim = None

_SHIM_INSTALLED = bool(_install_mongomock_uuid_shim()) if _install_mongomock_uuid_shim else False


@pytest.fixture(autouse=True)
def _restore_mongoengine_document_registry():
    """用例结束后恢复被本目录用例覆盖的 mongoengine 文档注册表条目（RISK：跨套件污染）。

    根因（task-41 实测）：
    - 迁移脚本的「引用发现」会 import 所有定义 Document 的模块，其中包含
      backend/notes/mongodb_models_legacy.py；
    - mongoengine 的 _document_registry **按类名索引**，legacy 模块的同名类会覆盖规范类
      （registry['Note'] 从 notes.mongodb_models.note 变成 notes.mongodb_models_legacy）；
    - 同进程其它套件受连带影响：例如 notes/tests/test_consumers.py 的 fixture 构造
      NoteCollaboration(note=...) 时，ReferenceField('Note') 会解析并**缓存**成 legacy 类，
      于是抛 ValidationError（A ReferenceField only accepts DBRef, LazyReference, ObjectId
      or documents: ['note']），表现为「合并跑多出 3 个 error」。

    这里只在用例前后做「快照 + 回填被覆盖的键」：
    - 回填被覆盖的规范类，消除遮蔽；
    - 不动用例期间**新增**的注册项（否则同进程后续 get_document('X') 会 NotRegistered）。
    """

    from mongoengine.base.common import _document_registry

    snapshot = dict(_document_registry)
    try:
        yield
    finally:
        for name, model in snapshot.items():
            _document_registry[name] = model
