"""RISK-BE-003 迁移脚本：把 users 集合的字符串 _id 改写为 Binary，并同步修复指向 User 的引用。

背景
----
users.mongodb_models.User 曾用 UUIDField(binary=False)，主键落库为**字符串**；
notes 等模型是默认 binary=True。引用反解（ReferenceField._lazy_load_ref → db.dereference）
按 UUID/Binary 去查字符串 _id，必然 DoesNotExist —— 这就是 RISK-BE-003。
模型侧已对齐（去掉 binary=False）；本脚本负责把**既有数据**改写：

  1) users._id: "<uuid>" → Binary.from_uuid(UUID("<uuid>"), STANDARD)
     mongodb 不允许原地改 _id，因此按「读原文档 → 用新 _id 重新插入 → 删除旧文档」处理；
  2) 所有指向 User 的引用字段（ReferenceField(User) / ListField(ReferenceField(User))）：
     把 "<uuid>" 或 DBRef('users', "<uuid>") 改写成 Binary 表示。

安全约定
--------
- 默认 dry-run：只统计并打印将要处理的用户数与引用数，不写任何数据；
- 只有显式 --apply 才写入；
- 幂等：第二次执行时已无字符串 _id，计划为空、不做任何写入；
- 失败不吞异常：写入异常向上抛并带上集合/文档 id；
- 先插入新文档再删旧文档：中途失败只会产生重复文档，不会丢数据。
- 本任务没有对任何真实库执行 --apply。

用法
----
    cd backend
    export DJANGO_SETTINGS_MODULE=<你的生产 settings 模块>
    python -m scripts.migrate_user_uuid_to_binary            # dry-run，先复核计划
    python -m scripts.migrate_user_uuid_to_binary --apply    # 备份之后再执行
"""

import argparse
import importlib
import logging
import os
import sys
import uuid as uuid_module

from bson import DBRef
from bson.binary import Binary, UuidRepresentation

logger = logging.getLogger(__name__)

USERS_COLLECTION = 'users'

# 发现「指向 User 的引用字段」前需要导入的模型模块；可选模块导入失败只告警不静默
MODEL_MODULES = (
    'users.mongodb_models',
    'notes.mongodb_models',
    'payments.mongodb_models',
    'knowledge_graph.mongodb_models',
    'tasks.mongodb_models',
    'notification.mongodb_models',
    'mind_map.mongodb_models',
    'reminder.mongodb_models',
    'voice_recognition.mongodb_models',
    'groups.mongodb_models',
    'canvas.mongodb_models',
    'search.mongodb_models',
)

# 表示「该值无需改动」的哨兵，避免 None 与真实 null 混淆
UNCHANGED = object()


def parse_uuid(value):
    """把字符串或 uuid.UUID 解析成 uuid.UUID；无法解析返回 None。"""
    if isinstance(value, uuid_module.UUID):
        return value
    if isinstance(value, str):
        try:
            return uuid_module.UUID(value)
        except (ValueError, AttributeError, TypeError):
            return None
    return None


def to_binary(value):
    """规范化为标准 Binary（subtype 4）；无法解析返回 None。"""
    parsed = parse_uuid(value)
    if parsed is None:
        return None
    return Binary.from_uuid(parsed, UuidRepresentation.STANDARD)


def import_model_modules():
    """导入可能声明了 User 引用的模型模块；失败只告警。"""
    for module_name in MODEL_MODULES:
        try:
            importlib.import_module(module_name)
        except Exception as exc:  # noqa: BLE001 - 可选模块允许缺失，但必须可见
            logger.warning('跳过模型模块 %s: %s', module_name, exc)


def _reference_target(field):
    """ReferenceField(User) 或 ListField(ReferenceField(User)) → (is_list, 目标类)。"""
    from mongoengine.fields import ListField, ReferenceField

    if isinstance(field, ReferenceField):
        return False, field.document_type
    inner = getattr(field, 'field', None)
    if isinstance(field, ListField) and isinstance(inner, ReferenceField):
        return True, inner.document_type
    return None


def iter_user_reference_fields():
    """产出所有指向 User 的引用字段：(collection, field_name, is_list)。"""
    from mongoengine.base.common import _document_registry
    from users.mongodb_models import User

    import_model_modules()
    seen = set()
    for model in list(_document_registry.values()):
        if not hasattr(model, '_get_collection_name'):
            continue
        collection = model._get_collection_name()
        if not collection or collection == USERS_COLLECTION:
            continue
        for field_name, field in model._fields.items():
            target = _reference_target(field)
            if not target:
                continue
            is_list, document_type = target
            if document_type is not User:
                continue
            key = (collection, field_name, is_list)
            if key not in seen:
                seen.add(key)
                yield key


def collect_legacy_user_ids(db):
    """收集 users 集合里 _id 为字符串（且形如 UUID）的文档 id。"""
    legacy_ids = []
    for document in db[USERS_COLLECTION].find({}):
        raw_id = document.get('_id')
        if isinstance(raw_id, str) and parse_uuid(raw_id) is not None:
            legacy_ids.append(raw_id)
    return sorted(legacy_ids)


def _needs_rewrite(value, legacy_ids):
    if isinstance(value, str):
        return value in legacy_ids
    if isinstance(value, DBRef):
        return (
            value.collection == USERS_COLLECTION
            and isinstance(value.id, str)
            and value.id in legacy_ids
        )
    return False


def _rewrite_single(value, binary_map):
    if isinstance(value, str) and value in binary_map:
        return binary_map[value]
    if isinstance(value, DBRef) and value.collection == USERS_COLLECTION:
        if isinstance(value.id, str) and value.id in binary_map:
            return DBRef(value.collection, binary_map[value.id], value.database)
    return value


def _rewrite_value(value, binary_map, is_list):
    if is_list and isinstance(value, list):
        changed = False
        rewritten = []
        for item in value:
            new_item = _rewrite_single(item, binary_map)
            if new_item is not item:
                changed = True
            rewritten.append(new_item)
        return rewritten if changed else UNCHANGED
    new_value = _rewrite_single(value, binary_map)
    return new_value if new_value is not value else UNCHANGED


def _count_references(collection, field_name, legacy_ids, is_list):
    count = 0
    for document in collection.find({field_name: {'$exists': True}}):
        value = document.get(field_name)
        if is_list and isinstance(value, list):
            count += sum(1 for item in value if _needs_rewrite(item, legacy_ids))
        elif _needs_rewrite(value, legacy_ids):
            count += 1
    return count


def build_plan(db):
    """统计迁移计划：多少 users 文档、多少引用需要改写（只读，不写库）。"""
    legacy_ids = collect_legacy_user_ids(db)
    legacy_id_set = set(legacy_ids)
    references = {}
    for collection_name, field_name, is_list in iter_user_reference_fields():
        count = _count_references(db[collection_name], field_name, legacy_id_set, is_list)
        if count:
            references['%s.%s' % (collection_name, field_name)] = count
    return {
        'legacy_user_ids': legacy_ids,
        'user_count': len(legacy_ids),
        'references': references,
        'reference_count': sum(references.values()),
    }


def _rewrite_references(collection, field_name, is_list, binary_map):
    updated = 0
    for document in collection.find({field_name: {'$exists': True}}):
        new_value = _rewrite_value(document.get(field_name), binary_map, is_list)
        if new_value is UNCHANGED:
            continue
        try:
            collection.update_one({'_id': document['_id']}, {'$set': {field_name: new_value}})
        except Exception:
            logger.error(
                '改写引用失败 collection=%s field=%s _id=%r', collection.name, field_name, document.get('_id')
            )
            raise
        updated += 1
    return updated


def migrate(db, apply=False, out=print):
    """执行迁移；apply=False 时只打印计划（默认 dry-run）。

    :returns: 计划字典（legacy_user_ids / user_count / references / reference_count）
    """
    plan = build_plan(db)
    out(
        '[migrate_user_uuid_binary] mode=%s target_db=%s users=%d references=%d'
        % ('apply' if apply else 'dry-run', db.name, plan['user_count'], plan['reference_count'])
    )
    for key in sorted(plan['references']):
        out('  reference %s: %d' % (key, plan['references'][key]))

    if not apply:
        out('dry-run：未写入任何数据（确认无误后再加 --apply）')
        return plan

    if not plan['legacy_user_ids']:
        out('没有字符串 _id 的 users 文档，无需迁移（幂等）')
        return plan

    users = db[USERS_COLLECTION]
    binary_map = {}
    for legacy_id in plan['legacy_user_ids']:
        new_id = to_binary(legacy_id)
        document = users.find_one({'_id': legacy_id})
        if document is None:
            continue
        new_document = dict(document)
        new_document['_id'] = new_id
        try:
            # 先插入新文档，再删除旧文档：中途失败不会丢数据
            users.insert_one(new_document)
            users.delete_one({'_id': legacy_id})
        except Exception:
            logger.error('改写 users 主键失败 legacy_id=%s', legacy_id)
            raise
        binary_map[legacy_id] = new_id
        out('  user %s -> %s' % (legacy_id, new_id))

    updated = 0
    for collection_name, field_name, is_list in iter_user_reference_fields():
        updated += _rewrite_references(db[collection_name], field_name, is_list, binary_map)

    out('迁移完成：users=%d 引用字段更新=%d' % (len(binary_map), updated))
    return plan


def get_default_db():
    """取 mongoengine 默认连接对应的数据库。"""
    from mongoengine.connection import get_db

    return get_db('default')


def main(argv=None):
    parser = argparse.ArgumentParser(description='RISK-BE-003：users 字符串 _id → Binary 迁移（默认 dry-run）')
    parser.add_argument('--apply', action='store_true', help='真正写入（默认只打印计划）')
    parser.add_argument('--settings', default=os.environ.get('DJANGO_SETTINGS_MODULE'),
                        help='Django settings 模块（也可用环境变量 DJANGO_SETTINGS_MODULE）')
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s %(message)s')

    if not args.settings:
        print('需要 DJANGO_SETTINGS_MODULE（或 --settings）来定位数据库连接，已中止。', file=sys.stderr)
        return 2

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', args.settings)
    import django

    django.setup()

    db = get_default_db()
    print('目标数据库: %s（执行前请先备份；本脚本默认 dry-run）' % db.name)
    migrate(db, apply=args.apply)
    return 0


if __name__ == '__main__':
    sys.exit(main())
