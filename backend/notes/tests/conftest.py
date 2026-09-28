"""backend/notes/tests 专用兼容垫片（RISK-BE-002）：让 mongomock 能写 UUID 主键。

根因（本机实测）
================
环境：/opt/anaconda3/envs/ZeroIsle —— pymongo 4.6.1 + mongomock 4.3.0 + mongoengine 0.27.0。

1) pymongo 4 起，CodecOptions 默认 uuid_representation = UNSPECIFIED(0)；此时 bson 拒绝编码
   原生 uuid.UUID，抛：
   ValueError: cannot encode native uuid.UUID with UuidRepresentation.UNSPECIFIED
2) mongomock 4.3.0 的 MongoClient 虽然接受 uuidRepresentation 关键字，但它被 **kwargs 吞掉，
   没有传进自己的 CodecOptions（mongomock/mongo_client.py:42 只传 tz_aware）；而且 mongomock 做
   文档校验时调用 BSON.encode(data, check_keys=...) 未透传 codec_options
   （mongomock/collection.py:552 / 985 / 2108），必然落到 UNSPECIFIED 默认值。
   ⇒ backend/backend/settings/testing.py 里传的 uuidRepresentation='standard' 对 mongomock 无效；
     30+ 条用例在保存 Category/Tag/Note 等 UUID 主键模型时直接报错，与业务代码无关。

垫片做什么
==========
只替换 mongomock.collection 模块内的 BSON 引用，让它的校验编码使用
CodecOptions(uuid_representation=STANDARD)。mongomock 内存里仍保存原生 UUID 对象，读写语义不变；
仅作用于测试进程，且仅作用于 mongomock —— 不使用 mongomock 的路径（真实 Mongo / 生产代码）完全不受影响。

可复制的验证
============
    python -X utf8 -m pytest -q backend/notes/tests
    python -X utf8 -m pytest -q -rs          # 既有门禁不回归：21 passed / 2 skipped

已知的后续阻塞（本垫片不掩盖、不跳过）
======================================
启用本垫片后 UUID 报错 100% 消失，backend/notes/tests 变为 35 failed / 23 passed / 3 skipped
（3 skipped 为缺少 async 插件，与 MongoDB 无关）。剩余 35 条与本垫片无关，是**测试用例自身过时**
（Django ORM 语义 vs mongoengine ReferenceField）：
  - 29 条：bson.errors.InvalidDocument: cannot encode object <users.models.user.User>
    —— setUp 里把 Django auth User 直接传给 mongoengine ReferenceField（Category.user / Note.user），
       而这两个模型引用的是 users.mongodb_models.User（MongoUser），二者由 users/signals.py 的
       post_save 镜像（MongoUser.django_user_id）关联；生产代码已做 Django→MongoUser 解析
       （notes/views/realm_note.py::_get_mongo_user），只有测试没有。
  - 6 条：mongoengine.errors.ValidationError (User:...) Field is required: ['password']
    —— 测试直接构造 MongoUser 却没给 required 的 password。
建议修复（另行任务，需改测试断言集合）：测试里改用信号已镜像出的 MongoUser
（MongoUser.objects(django_user_id=str(django_user.id)).first()）参与 mongoengine 模型构造；
DRF force_authenticate 仍传 Django user（视图自己解析）。
本垫片只消除环境级 UUID 不兼容，不对上述真实失败做任何 skip / xfail。

何时可以删除
============
上游修复「mongomock 忽略 uuidRepresentation / BSON.encode 未透传 codec_options」后（需实测确认），
删掉本文件即可。若不想引入垫片，还有三条替代路径：
  a) 固定 pymongo<4（4.0 之前默认 uuid_representation=STANDARD）；
  b) 升级 mongomock 到已修复版本；
  c) USE_REAL_MONGO_FOR_TESTS=1 + MONGO_URI=... 连真实 Mongo（不走本垫片）。
"""

import bson
import bson.binary
from bson.codec_options import CodecOptions

# 与 testing.py 里 uuidRepresentation='standard' 的意图保持一致
_UUID_STANDARD_CODEC_OPTIONS = CodecOptions(
    uuid_representation=bson.binary.UuidRepresentation.STANDARD
)


class _UuidFriendlyBSON:
    """mongomock 专用 BSON 包装：校验编码时强制 STANDARD UUID 表示。"""

    @staticmethod
    def encode(document, check_keys=False, codec_options=None):
        chosen = codec_options
        representation = getattr(chosen, 'uuid_representation', None)
        if chosen is None or representation == bson.binary.UuidRepresentation.UNSPECIFIED:
            chosen = _UUID_STANDARD_CODEC_OPTIONS
        return bson.BSON.encode(document, check_keys=check_keys, codec_options=chosen)


def _install_mongomock_uuid_shim():
    """幂等安装垫片；mongomock 不可用时静默跳过（例如改用真实 Mongo）。"""
    try:
        import mongomock.collection as mongomock_collection
    except Exception:  # pragma: no cover - 依赖缺失时不应影响测试收集
        return False

    if getattr(mongomock_collection, '_uuid_compat_shim_installed', False):
        return True

    mongomock_collection.BSON = _UuidFriendlyBSON
    mongomock_collection._uuid_compat_shim_installed = True
    return True


_SHIM_INSTALLED = _install_mongomock_uuid_shim()


def pytest_report_header(config):
    """在测试头部显式声明垫片状态，避免把「兼容垫片」误读成真实兼容。"""
    if _SHIM_INSTALLED:
        return (
            'backend/notes/tests: mongomock UUID 兼容垫片已启用 '
            '(RISK-BE-002；详见 backend/notes/tests/conftest.py 文件头)'
        )
    return 'backend/notes/tests: mongomock UUID 兼容垫片未启用（mongomock 不可用）'
