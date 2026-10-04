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
from bson.binary import UuidRepresentation

# 让 tests 可以直接 import 各 app（本目录即 manage.py 所在目录）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "admin_backend.settings")


# mongomock 客户端只建一次并复用，保证各测试看到同一个内存库
_SHARED_CLIENT = None


def _make_client(*args, **kwargs):
    """构造一个与真实 MongoDB 行为一致的 mongomock 客户端。

    mongoengine 会以 mongo_client_class(host=..., port=..., **opts) 的形式调用本函数，
    因此必须接收并忽略这些连接参数（mongomock 是进程内的，无需 host/port）。

    uuidRepresentation='standard' 是必须的：
    主后端与管理后台的用户主键都是 UUIDField(binary=True)，
    落库时会被编码成 BSON Binary（subtype 4）。若不显式指定该表示，
    pymongo/bson 会在编码原生 uuid.UUID 时抛：
      ValueError: cannot encode native uuid.UUID with UuidRepresentation.UNSPECIFIED
    真实 MongoDB 驱动在握手中会协商到 standard，因此测试环境也必须对齐，
    否则测试会因"表示方式不同"而失败，掩盖真正的口径问题。
    """
    global _SHARED_CLIENT
    if _SHARED_CLIENT is None:
        _SHARED_CLIENT = mongomock.MongoClient(uuidRepresentation="standard")
    return _SHARED_CLIENT


def _patch_mongoengine_connect():
    """把 mongoengine.connect 重定向到内存版 mongomock（幂等）。"""
    import mongoengine

    if getattr(mongoengine.connect, "_is_mongomock_patched", False):
        return

    original_connect = mongoengine.connect

    def _connect(*args, **kwargs):
        kwargs["mongo_client_class"] = _make_client
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
        mongo_client_class=_make_client,
    )

    _force_standard_uuid_representation()


def _force_standard_uuid_representation():
    """确保底层 MongoClient 使用 UuidRepresentation.STANDARD。

    为什么需要这一步（实测结论）：
    mongoengine 4.x 的 connect 会把 `mongo_client_class` 交给 pymongo 的
    MongoClient，但本环境里 mongoengine 内部仍按默认的 UNSPECIFIED 表示
    构造客户端（mongoengine/connection.py 会 warning
    "No uuidRepresentation is specified! Falling back to 'pythonLegacy'"）。
    在该表示下，插入原生 uuid.UUID 会直接抛：
      ValueError: cannot encode native uuid.UUID with UuidRepresentation.UNSPECIFIED
    这会让"主键是否为 binary UUID"这一类断言根本无法执行。

    真实 MongoDB 驱动在握手中会协商到 standard，因此测试环境必须显式对齐，
    否则测试失败的原因是"表示方式没配对"，而不是真正的口径问题。
    """
    from bson.binary import UuidRepresentation
    from mongoengine import connection

    for alias in ("default",):
        client = connection._connections.get(alias)
        db = connection._dbs.get(alias)
        for target in (client, getattr(db, "client", None)):
            if target is None:
                continue
            try:
                target.options.uuid_representation = UuidRepresentation.STANDARD
            except Exception:  # pragma: no cover - 不同 pymongo/mongomock 版本属性位置不同
                try:
                    target._uuid_representation = UuidRepresentation.STANDARD
                except Exception:
                    pass
