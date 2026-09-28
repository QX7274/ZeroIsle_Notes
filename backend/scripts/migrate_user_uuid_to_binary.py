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
import ast
import importlib
import logging
import os
import sys
import uuid as uuid_module
from pathlib import Path

from bson import DBRef
from bson.binary import Binary, UuidRepresentation

logger = logging.getLogger(__name__)

USERS_COLLECTION = 'users'

# 主键改写期间用于「可回滚」的备份集合（每个用户一条，成功后立即删除）
BACKUP_COLLECTION = 'user_uuid_migration_backup'

# backend/ 目录（本文件在 backend/scripts/ 下）
BACKEND_ROOT = Path(__file__).resolve().parents[1]

# AST 扫描时跳过的目录：测试与迁移脚本里定义的 Document 不需要参与生产数据迁移
SKIP_DIR_PARTS = frozenset({'tests', 'migrations', '__pycache__', 'node_modules', '.git'})

# 视为「Document 基类」的名字（判断某模块是否定义了 mongoengine 文档模型）
DOCUMENT_BASE_NAMES = frozenset({'Document', 'DynamicDocument'})

# 兜底模块列表：AST 扫描覆盖不到的场景（模块在 backend/ 之外、或类由 type() 动态创建）仍需显式导入。
# 正常情况下 discover_document_modules() 已经能发现全部模块，这里只是安全网。
FALLBACK_MODULES = (
    'users.mongodb_models',
    'notes.mongodb_models',
    'payments.mongodb_models',
    'knowledge_graph.mongodb_models',
    'tasks.mongodb_models',
    'notification.mongodb_models',
    'notification.notification_preferences_service',
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


def _module_name_for(path, root):
    """把 backend/xxx/yyy.py 映射为可导入模块名 xxx.yyy（__init__.py → 包名）。"""
    relative = path.relative_to(root)
    parts = list(relative.parts)
    parts[-1] = parts[-1][:-3]
    if parts[-1] == '__init__':
        parts.pop()
    return '.'.join(parts)


def _defines_document(tree):
    """AST 里是否存在继承 Document / DynamicDocument 的类定义。"""
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        for base in node.bases:
            if isinstance(base, ast.Name):
                base_name = base.id
            elif isinstance(base, ast.Attribute):
                base_name = base.attr
            else:
                continue
            if base_name in DOCUMENT_BASE_NAMES:
                return True
    return False


def discover_document_modules(root=None):
    """扫描 backend/ 源码，返回所有「定义了 mongoengine Document」的模块名。

    为什么不能只靠 mongoengine 注册表：注册表只包含**已经被导入**的类，
    而 Document 不都定义在 *_mongodb_models_* 包里（例如
    notification/notification_preferences_service.py、各 app 的 views/services）。
    因此先用 AST 找出候选模块并导入，再用注册表枚举，才能避免漏字段的半迁移。
    """
    scan_root = Path(root) if root is not None else BACKEND_ROOT
    modules = set()
    for path in scan_root.rglob('*.py'):
        parents = path.relative_to(scan_root).parts[:-1]
        if any(part in SKIP_DIR_PARTS for part in parents):
            continue
        try:
            tree = ast.parse(path.read_text(encoding='utf-8'))
        except (SyntaxError, UnicodeDecodeError) as exc:
            logger.warning('跳过无法解析的源文件 %s: %s', path, exc)
            continue
        if _defines_document(tree):
            modules.add(_module_name_for(path, scan_root))
    return sorted(modules)


_DISCOVERY_CACHE = None


def ensure_document_modules_imported(root=None, force=False):
    """导入所有可能定义 Document 的模块，让注册表尽可能完整。

    :returns: (imported, failed) —— failed 里的模块已经逐个告警，不静默。
    """
    global _DISCOVERY_CACHE

    if _DISCOVERY_CACHE is not None and root is None and not force:
        return _DISCOVERY_CACHE

    candidates = set(discover_document_modules(root)) | set(FALLBACK_MODULES)
    imported = []
    failed = []
    for module_name in sorted(candidates):
        if module_name in sys.modules:
            imported.append(module_name)
            continue
        try:
            importlib.import_module(module_name)
            imported.append(module_name)
        except Exception as exc:  # noqa: BLE001 - 可选依赖缺失允许跳过，但必须可见
            failed.append(module_name)
            logger.warning('导入 Document 模块失败 %s: %s', module_name, exc)

    result = (imported, failed)
    if root is None:
        _DISCOVERY_CACHE = result
    return result


def _document_class_names(module_name):
    """AST 找出模块里定义的 Document 类名。"""
    path = _module_file(module_name)
    if not path.exists():
        return []
    try:
        tree = ast.parse(path.read_text(encoding='utf-8'))
    except (SyntaxError, UnicodeDecodeError):
        return []
    names = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        for base in node.bases:
            base_name = None
            if isinstance(base, ast.Name):
                base_name = base.id
            elif isinstance(base, ast.Attribute):
                base_name = base.attr
            if base_name in DOCUMENT_BASE_NAMES:
                names.append(node.name)
                break
    return names


def find_registry_conflicts():
    """同名 Document 定义在多个模块里 —— mongoengine 注册表按「类名」索引，后导入者遮蔽先导入者。

    这类遮蔽会让「只信注册表」的枚举漏字段、造成半迁移。脚本用源码静态枚举兜底，
    同时把冲突显式报出来（宁可多报，也不要静默漏改）。
    """
    sources = {}
    for module_name in discover_document_modules():
        for class_name in _document_class_names(module_name):
            sources.setdefault(class_name, []).append(module_name)

    conflicts = []
    for class_name, modules in sorted(sources.items()):
        if len(modules) < 2:
            continue
        conflicts.append({
            'class_name': class_name,
            'modules': sorted(modules),
            'affects_user_references': any(module_declares_user_reference(m) for m in modules),
        })
    return conflicts


def collect_unique_indexes(db, collection_names):
    """列出相关集合上的唯一索引。

    迁移会改写 users._id 与引用字段，操作者必须知道哪些唯一索引受影响：
    users 上的 unique index(username) 曾让「先插后删」直接撞 E11000（现已改为「备份→删旧→插新→删备份」，
    索引全程保留、不会被 drop/recreate）。
    """
    specs = []
    for collection_name in sorted(set(collection_names)):
        try:
            indexes = db[collection_name].index_information()
        except Exception as exc:  # noqa: BLE001 - 读不到索引要可见，但不应中断计划
            logger.warning('读取集合 %s 的索引失败: %s', collection_name, exc)
            continue
        for name, info in indexes.items():
            if not info.get('unique'):
                continue
            specs.append({
                'collection': collection_name,
                'name': name,
                'key': [list(item) for item in info.get('key', [])],
            })
    return specs


def _module_file(module_name):
    """模块名 → backend/ 下的源文件路径。"""
    return BACKEND_ROOT.joinpath(*module_name.split('.')).with_suffix('.py')


def _call_name(node):
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Attribute):
            return node.func.attr
        if isinstance(node.func, ast.Name):
            return node.func.id
    return None


def _first_arg_is_user(node):
    args = getattr(node, 'args', None)
    if not args:
        return False
    first = args[0]
    if isinstance(first, ast.Name):
        return first.id == 'User'
    if isinstance(first, ast.Constant):
        return first.value == 'User'
    return False


def _is_user_reference_call(node):
    name = _call_name(node)
    if name in ('ReferenceField', 'LazyReferenceField'):
        return _first_arg_is_user(node)
    if name == 'ListField' and node.args:
        inner = node.args[0]
        return _call_name(inner) in ('ReferenceField', 'LazyReferenceField') and _first_arg_is_user(inner)
    return False


def _iter_class_assignments(tree):
    """产出 (ClassDef, 字段名, 赋值表达式) 三元组。"""
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        for statement in node.body:
            if not isinstance(statement, ast.Assign):
                continue
            for target in statement.targets:
                if isinstance(target, ast.Name):
                    yield node, target.id, statement.value


def module_declares_user_reference(module_name):
    """静态（AST）判断模块里是否声明了 ReferenceField('User')(不论是否写了 meta.collection)。"""
    path = _module_file(module_name)
    if not path.exists():
        return False
    try:
        tree = ast.parse(path.read_text(encoding='utf-8'))
    except (SyntaxError, UnicodeDecodeError):
        return False
    return any(
        _is_user_reference_call(value) for _cls, _field, value in _iter_class_assignments(tree)
    )


def static_user_reference_fields(module_name):
    """导入失败时的兜底：静态提取模块里显式声明的 User 引用字段。

    只处理**显式写了 meta = {'collection': ...}** 的 Document：
    没有 meta 时 mongoengine 的集合名由类名推导，静态推导容易出错，
    这种情况宁可在计划里报「未解析」，也不猜一个集合名去写数据。
    """
    path = _module_file(module_name)
    if not path.exists():
        return set()

    try:
        tree = ast.parse(path.read_text(encoding='utf-8'))
    except (SyntaxError, UnicodeDecodeError):
        return set()

    fields = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        is_document = any(
            (isinstance(base, ast.Name) and base.id == 'Document')
            or (isinstance(base, ast.Attribute) and base.attr == 'Document')
            for base in node.bases
        )
        if not is_document:
            continue

        collection = None
        for statement in node.body:
            if not isinstance(statement, ast.Assign):
                continue
            is_meta = any(isinstance(t, ast.Name) and t.id == 'meta' for t in statement.targets)
            if is_meta and isinstance(statement.value, ast.Dict):
                for key, value in zip(statement.value.keys, statement.value.values):
                    if isinstance(key, ast.Constant) and key.value == 'collection' and isinstance(value, ast.Constant):
                        collection = value.value
        if not collection:
            continue

        for statement in node.body:
            if not isinstance(statement, ast.Assign):
                continue
            for target in statement.targets:
                if not isinstance(target, ast.Name):
                    continue
                value = statement.value
                if _call_name(value) in ('ReferenceField', 'LazyReferenceField') and _first_arg_is_user(value):
                    fields.add((collection, target.id, False))
                elif _call_name(value) == 'ListField' and value.args:
                    inner = value.args[0]
                    if _call_name(inner) in ('ReferenceField', 'LazyReferenceField') and _first_arg_is_user(inner):
                        fields.add((collection, target.id, True))
    return fields


def _reference_target(field):
    """ReferenceField(User) 或 ListField(ReferenceField(User)) → (is_list, 目标类)。"""
    from mongoengine.fields import ListField, ReferenceField

    if isinstance(field, ReferenceField):
        return False, field.document_type
    inner = getattr(field, 'field', None)
    if isinstance(field, ListField) and isinstance(inner, ReferenceField):
        return True, inner.document_type
    return None


def iter_user_reference_fields(root=None):
    """产出所有指向 User 的引用字段：(collection, field_name, is_list)。

    先确保「所有定义了 Document 的模块」都已导入，再用 mongoengine 注册表枚举，
    因此 service/views 里定义的 Document 也不会漏。
    """
    from mongoengine.base.common import _document_registry
    from users.mongodb_models import User

    imported, failed = ensure_document_modules_imported(root)
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

    # 静态提取兜底（对**所有候选模块**做，而不只是导入失败的）：
    # mongoengine 的 _document_registry 以「类名」为键，不同 app 里的同名 Document
    # （例如 community.mongodb_models.Note 与 notes.mongodb_models.Note）会互相覆盖，
    # 后导入者生效；只信注册表会漏掉被覆盖模型的 User 引用字段。
    # 静态提取直接读源码，与注册表谁生效无关，因此这里取并集，避免半迁移。
    for module_name in sorted(set(imported) | set(failed)):
        for key in sorted(static_user_reference_fields(module_name)):
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


def _iter_reference_values(value, prefix=''):
    """递归产出文档里所有字符串 / DBRef 值的 (path, value)。"""
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _iter_reference_values(item, prefix + str(key) + '.')
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            yield from _iter_reference_values(item, prefix + str(index) + '.')
    elif isinstance(value, (str, DBRef)):
        yield prefix.rstrip('.'), value


def find_unhandled_legacy_references(db, legacy_ids):
    """找出「指向 legacy user、但不在已知顶层引用字段里」的值。

    典型例子：嵌入文档里的引用（knowledge_bases.members[].user 指向 User）。
    这类嵌套引用当前迁移**不改写**；一旦命中就必须拒绝 --apply —— 半迁移比不迁移更危险。
    """
    if not legacy_ids:
        return []

    legacy_id_set = set(legacy_ids)
    covered = {}
    for collection_name, field_name, _is_list in iter_user_reference_fields():
        covered.setdefault(collection_name, set()).add(field_name.split('.')[0])

    findings = []
    for collection_name in db.list_collection_names():
        if collection_name == USERS_COLLECTION:
            continue
        handled_fields = covered.get(collection_name, set())
        for document in db[collection_name].find({}):
            for path, value in _iter_reference_values(document):
                if not _needs_rewrite(value, legacy_id_set):
                    continue
                root_field = path.split('.')[0]
                if root_field not in handled_fields:
                    findings.append({
                        'collection': collection_name,
                        'path': path,
                        'document_id': document.get('_id'),
                    })
    return findings


def build_plan(db):
    """统计迁移计划：多少 users 文档、多少引用需要改写（只读，不写库）。

    unresolved_modules 列出「导入失败」的 Document 模块：其中声明了 User 引用的会另外标出来，
    提醒操作者人工确认（这类模块的字段已尽量用静态提取兜底）。
    """
    legacy_ids = collect_legacy_user_ids(db)
    legacy_id_set = set(legacy_ids)
    reference_fields = list(iter_user_reference_fields())
    references = {}
    for collection_name, field_name, is_list in reference_fields:
        count = _count_references(db[collection_name], field_name, legacy_id_set, is_list)
        if count:
            references['%s.%s' % (collection_name, field_name)] = count

    _imported, failed = ensure_document_modules_imported()
    registry_conflicts = find_registry_conflicts()
    touched_collections = [USERS_COLLECTION] + [name for name, _f, _l in reference_fields]
    unresolved_modules = [
        {'module': name, 'declares_user_reference': module_declares_user_reference(name)}
        for name in failed
    ]
    return {
        'legacy_user_ids': legacy_ids,
        'user_count': len(legacy_ids),
        'references': references,
        'reference_count': sum(references.values()),
        'unresolved_modules': unresolved_modules,
        'has_unresolved_user_references': any(
            item['declares_user_reference'] for item in unresolved_modules
        ),
        # 已知引用字段之外、但仍指向 legacy user 的值（例如嵌入文档里的 user）：
        # 这些当前不会被改写，命中即拒绝 --apply。
        'unhandled_references': find_unhandled_legacy_references(db, legacy_ids),
        # 迁移会改写的集合上的唯一索引（操作者需要知道哪些约束受影响）
        'unique_indexes': collect_unique_indexes(db, touched_collections),
        # 同名 Document 冲突（注册表按类名索引会互相遮蔽；脚本已用源码静态枚举兜底）
        'registry_conflicts': registry_conflicts,
        'has_registry_conflicts': any(item['affects_user_references'] for item in registry_conflicts),
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


def rewrite_user_primary_key(db, legacy_id, new_id):
    """把 users._id 从字符串改写为 Binary，并保证 unique index(username) 下也能成功。

    真实库的 users 上有 unique index(username)（mongoengine 会自动 ensure_indexes）：
    如果先插新文档、再删旧文档，两条记录同名 → 立刻撞 E11000。
    因此顺序改为「备份 → 删旧 → 插新 → 删备份」；插入失败时用备份把这一步回滚。

    :returns: 新的 _id（Binary）；若原文档不存在返回 None
    """
    users = db[USERS_COLLECTION]
    document = users.find_one({'_id': legacy_id})
    if document is None:
        return None

    backup = dict(document)
    new_document = dict(document)
    new_document['_id'] = new_id

    db[BACKUP_COLLECTION].insert_one({'_id': legacy_id, 'document': backup})
    try:
        users.delete_one({'_id': legacy_id})
        users.insert_one(new_document)
    except Exception:
        logger.error('改写 users 主键失败 legacy_id=%s，尝试用备份回滚', legacy_id)
        try:
            if users.find_one({'_id': legacy_id}) is None:
                users.insert_one(backup)
        except Exception:  # noqa: BLE001 - 回滚失败也要把原始异常抛出去
            logger.error('回滚备份也失败 legacy_id=%s，请人工检查 %s', legacy_id, BACKUP_COLLECTION, exc_info=True)
        raise
    db[BACKUP_COLLECTION].delete_one({'_id': legacy_id})
    return new_id


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
    for spec in plan['unique_indexes']:
        out(
            '  unique index %s.%s key=%s（迁移只改写 _id/引用，不 drop 索引）'
            % (spec['collection'], spec['name'], spec['key'])
        )
    for conflict in plan['registry_conflicts']:
        if not conflict['affects_user_references']:
            continue
        out(
            '  WARNING 同名 Document 冲突 %s：%s（注册表按类名索引会被遮蔽，'
            '脚本已改用源码静态枚举兜底）'
            % (conflict['class_name'], ', '.join(conflict['modules']))
        )
    for item in plan['unresolved_modules']:
        out(
            '  WARNING 模块导入失败 %s（%s）'
            % (
                item['module'],
                '静态检出 User 引用，已尽力兜底，请人工确认'
                if item['declares_user_reference']
                else '未静态检出 User 引用，仍建议人工确认',
            )
        )
    if plan['has_unresolved_user_references']:
        logger.warning(
            '存在导入失败且声明了 User 引用的模块：%s；请先修正导入或人工核对，避免半迁移',
            [item['module'] for item in plan['unresolved_modules'] if item['declares_user_reference']],
        )
    for finding in plan['unhandled_references'][:20]:
        out(
            '  WARNING 未覆盖的引用 %s.%s（文档 %s）'
            % (finding['collection'], finding['path'], finding['document_id'])
        )
    if len(plan['unhandled_references']) > 20:
        out('  ... 其余 %d 条未覆盖引用已省略' % (len(plan['unhandled_references']) - 20))

    if plan['unhandled_references']:
        message = (
            '发现 %d 条迁移不覆盖的 User 引用（如嵌入文档里的 user）；'
            '为避免半迁移，本次不执行 --apply，请先处理这些路径（见上面的 WARNING 列表）'
            % len(plan['unhandled_references'])
        )
        logger.error(message)
        if apply:
            raise RuntimeError(message)

    if not apply:
        out('dry-run：未写入任何数据（确认无误后再加 --apply）')
        return plan

    if not plan['legacy_user_ids']:
        out('没有字符串 _id 的 users 文档，无需迁移（幂等）')
        return plan

    binary_map = {}
    for legacy_id in plan['legacy_user_ids']:
        new_id = rewrite_user_primary_key(db, legacy_id, to_binary(legacy_id))
        if new_id is None:
            continue
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
