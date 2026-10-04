"""
管理后台后端测试配置。

- 使用 `admin_backend.settings` 作为 Django 设置。
- 用 mongomock 替代真实 MongoDB，使测试无需外部依赖即可运行
  （与主后端 backend/conftest.py 的做法一致）。

关键顺序问题（本文件存在的原因）
--------------------------------
`admin_backend/settings.py` 在**导入阶段**就会调用 `mongoengine.connect(...)`，
一旦本机没有 mongod，该连接会一直阻塞到 ServerSelectionTimeoutError（约 30 秒），
并且 `mongoengine.connection._connections['default']` 已经被登记为真实客户端。

因此仅仅"替换掉 mongoengine.connect 函数"是不够的——settings 已经建好连接了。
本 conftest 的做法是：

1. 先在 Django 加载 settings **之前**把 `mongoengine.connect` 指向 mongomock
   （这样 settings 里那次 connect 走的就是内存客户端）；
2. 再在 `pytest_configure` 里显式 `disconnect` + `connect` 一次，
   确保 `_connections['default']` 确实绑定到 mongomock 客户端，而不是真实客户端。
"""

import os
import sys

import mongomock

# 让 tests 可以直接 import 各 app（本目录即 manage.py 所在目录）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "admin_backend.settings")

_MONGOMOCK_CLIENT = mongomock.MongoClient()


def _patch_mongoengine_connect():
    """把 mongoengine.connect 重定向到内存版 mongomock（幂等）。"""
    import mongoengine

    if getattr(mongoengine.connect, "_is_mongomock_patched", False):
        return

    original_connect = mongoengine.connect

    def _connect(*args, **kwargs):
        kwargs["mongo_client_class"] = mongomock.MongoClient
        return original_connect(*args, **kwargs)

    _connect._is_mongomock_patched = True
    mongoengine.connect = _connect


# 第 1 步：在 Django 导入 settings 之前完成打补丁
_patch_mongoengine_connect()


def pytest_configure():
    """第 2 步：加载 Django 后，把 default 连接强制切换到 mongomock。"""
    import django

    django.setup()

    import mongoengine
    from mongoengine import connection

    db_name = "admin_test_db"
    # 丢弃 settings 阶段建立的（指向真实 mongod 的）连接
    try:
        connection._connections.pop("default", None)
        connection._dbs.pop("default", None)
    except Exception:  # pragma: no cover - 不同 mongoengine 版本内部结构略有差异
        pass

    mongoengine.disconnect(alias="default")
    mongoengine.connect(
        db=db_name,
        alias="default",
        mongo_client_class=mongomock.MongoClient,
    )
