"""管理后台数据口径核查工具（阶段3 闭环）。

背景
----
阶段3 已把管理后台与主后端的共享集合口径对齐到代码层面：
  - users / notes / tags / user_activities / verification_codes 的主键统一为
    UUIDField(primary_key=True)（binary=True，BSON subtype 4）；
  - 评论/附件集合名从 comments / attachments 改为主 App 真实的
    note_comments / note_attachments。

但**代码对齐不等于数据已对齐**：库里可能仍存在历史形态的文档
（字符串 _id 或 ObjectId），这些数据不会被代码改动修正，
必须靠数据迁移处理。本工具的作用是**在迁移前/后做客观核查**，
避免"以为已经修好了"这种最危险的状态。

它做什么
--------
以只读方式连接 MongoDB，对每个共享集合统计主键形态分布：

    { "binary_uuid": n1, "string_uuid": n2, "objectid": n3, "other": n4 }

并给出结论：
  - OK          ：全部为主键应为的形态，无需迁移；
  - NEEDS_MIGRATION：存在异构主键，需要迁移（列出样本）；
  - EMPTY       ：集合为空，无需处理。

它**绝不写入任何数据**，只做 find + 计数。

用法
----
    cd admin_system/backend
    python -m scripts.check_shared_collection_consistency

可选环境变量（与主后端/管理后台的既有命名都兼容）：
    MONGO_HOST / MONGO_PORT / MONGO_DB_NAME（或旧名 MONGO_DB）/ MONGO_USER / MONGO_PASSWORD
    或直接给 MONGO_URI

退出码：
    0 = 全部 OK 或 EMPTY
    1 = 存在需要迁移的异构主键（便于接入 CI/上线门禁）
    2 = 连接或配置错误
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from collections import Counter

# 共享集合 → 期望的主键形态
# 说明：这些集合同时被主后端与管理后台读写，主键必须是 binary UUID（subtype 4）。
SHARED_COLLECTIONS = {
    'users': 'binary_uuid',
    'notes': 'binary_uuid',
    'tags': 'binary_uuid',
    'user_activities': 'binary_uuid',
    'verification_codes': 'binary_uuid',
    # 评论/附件在阶段3 由 comments/attachments 改名为 note_comments/note_attachments
    'note_comments': 'binary_uuid',
    'note_attachments': 'binary_uuid',
}

# 阶段3 修正前的旧集合名。若它们仍存在且有数据，说明改名后留下了孤儿数据，
# 需要人工确认是迁移还是清理。
LEGACY_COLLECTION_NAMES = ('comments', 'attachments', 'note_categories')


def classify_id(value) -> str:
    """判断一个 _id 值属于哪种形态。"""
    # 延迟 import，避免在没装 bson 的环境里 import 期就失败
    from bson.binary import Binary
    from bson.objectid import ObjectId

    if isinstance(value, Binary):
        # subtype 4 即标准 UUID
        if value.subtype == 4:
            return 'binary_uuid'
        return 'binary_other'
    if isinstance(value, ObjectId):
        return 'objectid'
    if isinstance(value, str):
        # 进一步区分"看起来像 UUID 的字符串"与普通字符串
        try:
            uuid.UUID(value)
            return 'string_uuid'
        except (ValueError, AttributeError, TypeError):
            return 'string_other'
    if isinstance(value, uuid.UUID):
        # pymongo 在 standard 表示下通常返回 UUID 对象
        return 'binary_uuid'
    return 'other'


def _build_client():
    """按环境变量构造 MongoClient；URI 优先。"""
    from pymongo import MongoClient

    uri = os.environ.get('MONGO_URI')
    if uri:
        return MongoClient(uri, serverSelectionTimeoutMS=5000)

    host = os.environ.get('MONGO_HOST', 'localhost')
    port = int(os.environ.get('MONGO_PORT', 27017) or 27017)
    user = os.environ.get('MONGO_USER', '')
    password = os.environ.get('MONGO_PASSWORD', '')
    if user and password:
        from urllib.parse import quote_plus

        uri = f"mongodb://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/"
        return MongoClient(uri, serverSelectionTimeoutMS=5000)
    return MongoClient(host, port, serverSelectionTimeoutMS=5000)


def _db_name():
    return (
        os.environ.get('MONGO_DB_NAME')
        or os.environ.get('MONGO_DB')          # 管理后台沿用的旧名
        or 'zeroislenotes'
    )


def check_collection(db, name: str, expected: str, sample_limit: int = 5):
    """核查单个集合的主键形态分布（只读）。"""
    if name not in db.list_collection_names():
        return {'collection': name, 'status': 'MISSING', 'total': 0, 'distribution': {}}

    coll = db[name]
    distribution = Counter()
    samples = {}
    total = 0
    for doc in coll.find({}, {'_id': 1}):
        total += 1
        kind = classify_id(doc.get('_id'))
        distribution[kind] += 1
        if kind != expected and len(samples.get(kind, [])) < sample_limit:
            samples.setdefault(kind, []).append(repr(doc.get('_id')))

    if total == 0:
        return {'collection': name, 'status': 'EMPTY', 'total': 0,
                'distribution': dict(distribution)}

    wrong = {k: v for k, v in distribution.items() if k != expected}
    status = 'OK' if not wrong else 'NEEDS_MIGRATION'
    return {
        'collection': name,
        'status': status,
        'total': total,
        'expected': expected,
        'distribution': dict(distribution),
        'wrong_samples': samples,
    }


def check_legacy_collections(db):
    """检查阶段3 改名后可能残留的旧集合。"""
    findings = []
    for name in LEGACY_COLLECTION_NAMES:
        if name in db.list_collection_names():
            count = db[name].estimated_document_count()
            findings.append({'collection': name, 'count': count})
    return findings


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='管理后台共享集合主键口径只读核查')
    parser.add_argument('--json', action='store_true', help='以 JSON 输出（便于接入门禁）')
    args = parser.parse_args(argv)

    try:
        client = _build_client()
        db = client[_db_name()]
        client.admin.command('ping')
    except Exception as exc:  # noqa: BLE001
        print(f'[ERROR] 无法连接 MongoDB：{type(exc).__name__}: {exc}', file=sys.stderr)
        return 2

    results = [check_collection(db, name, expected)
               for name, expected in SHARED_COLLECTIONS.items()]
    legacy = check_legacy_collections(db)

    needs = [r for r in results if r['status'] == 'NEEDS_MIGRATION']

    if args.json:
        print(json.dumps({
            'db': _db_name(),
            'results': results,
            'legacy_collections': legacy,
            'needs_migration': [r['collection'] for r in needs],
        }, ensure_ascii=False, indent=2))
    else:
        print(f'数据库: {_db_name()}')
        print('-' * 68)
        for r in results:
            dist = ', '.join(f'{k}={v}' for k, v in sorted(r['distribution'].items())) or '-'
            print(f"{r['collection']:22s} {r['status']:16s} total={r['total']:<8} {dist}")
            for kind, vals in (r.get('wrong_samples') or {}).items():
                print(f'    异构样本[{kind}]: {vals}')
        if legacy:
            print('-' * 68)
            print('阶段3 改名后仍存在的旧集合（需确认是迁移还是清理）：')
            for f in legacy:
                print(f"  {f['collection']:22s} count={f['count']}")
        print('-' * 68)
        if needs:
            print(f'结论: 需要迁移 —— {", ".join(r["collection"] for r in needs)}')
            print('请先执行主后端迁移脚本（见 docs/管理后台数据口径迁移手册.md）：')
            print('  cd backend && python -m scripts.migrate_user_uuid_to_binary        # dry-run')
        else:
            print('结论: 所有共享集合主键口径一致，无需迁移。')

    return 1 if needs else 0


if __name__ == '__main__':
    raise SystemExit(main())
