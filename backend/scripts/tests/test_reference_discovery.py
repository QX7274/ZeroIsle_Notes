"""迁移脚本「引用发现」补漏测试（RISK-BE-003 / WS-AC）。

背景：脚本原先用硬编码模块列表发现 ReferenceField(User)，service / views 里定义的 Document
会被漏掉，导致「部分引用改 Binary、部分没改」的半迁移（比不迁移更危险）。
现在改为：AST 扫描 backend 源码 → 导入所有定义 Document 的模块 → 用 mongoengine 注册表枚举字段。

本文件锁定：
1. service 风格模块（不在 mongodb_models 包里）能被扫描发现；
2. 这类模块里 Document 的 User 引用会出现在迁移计划里；
3. 守护：注册表中所有 User 引用字段 ⊆ 脚本发现到的字段集合（将来新增文档不会被悄悄漏掉）。
"""

import uuid as uuid_module

from bson import ObjectId
from django.test import TestCase
from mongoengine import Document
from mongoengine.base.common import _document_registry
from mongoengine.connection import get_db
from mongoengine.fields import ListField, ReferenceField

from users.mongodb_models import User

from scripts.migrate_user_uuid_to_binary import (
    build_plan,
    discover_document_modules,
    ensure_document_modules_imported,
    find_registry_conflicts,
    iter_user_reference_fields,
    migrate,
    static_user_reference_fields,
)


class ServiceStylePreference(Document):
    """模拟「定义在 service 模块里」的 Document：不在任何 mongodb_models 包里。

    这是历史硬编码列表会漏掉的形态；collection 带 ws_ac_ 前缀，避免与真实模型冲突。
    """

    user = ReferenceField(User, required=True)
    meta = {'collection': 'ws_ac_service_style_prefs'}


def _registry_user_reference_fields():
    """独立实现（刻意不复用脚本里的 helper），用于守护测试，避免同源错误互相掩盖。"""
    fields = set()
    for model in list(_document_registry.values()):
        if not hasattr(model, '_get_collection_name'):
            continue
        collection = model._get_collection_name()
        if collection == 'users':
            continue
        for field_name, field in model._fields.items():
            if isinstance(field, ReferenceField) and field.document_type is User:
                fields.add((collection, field_name, False))
            inner = getattr(field, 'field', None)
            if isinstance(field, ListField) and isinstance(inner, ReferenceField) and inner.document_type is User:
                fields.add((collection, field_name, True))
    return fields


class ShadowedNote(Document):
    """模拟「同名 Document 遮蔽」：注册表里 Note 被别的模块的同名类顶替。"""

    user = ReferenceField(User, required=True)
    meta = {'collection': 'ws_ac_shadowed_notes'}


class ReferenceDiscoveryTests(TestCase):
    def setUp(self):
        self.db = get_db('default')
        self.db.users.delete_many({})
        self.db.ws_ac_service_style_prefs.delete_many({})
        self.db.drop_collection('knowledge_bases')

        self.legacy_id = str(uuid_module.uuid4())
        self.db.users.insert_one({
            '_id': self.legacy_id,
            'username': 'ws-ac-legacy',
            'password': 'x',
        })
        self.db.ws_ac_service_style_prefs.insert_one({
            '_id': ObjectId(),
            'user': self.legacy_id,
        })

    def test_service_style_module_is_discovered_by_scan(self):
        discovered = discover_document_modules()

        # notification 的偏好设置 Document 定义在 service 模块里，硬编码列表曾漏掉它
        self.assertIn('notification.notification_preferences_service', discovered)
        # 也应包含各 app 的 views/services 里的文档模型，而不仅是 *_mongodb_models*
        self.assertGreater(len(discovered), 10)
        self.assertTrue(
            any(not name.endswith('mongodb_models') for name in discovered),
            '扫描结果应包含非 mongodb_models 模块',
        )

    def test_service_style_document_user_reference_is_planned(self):
        plan = build_plan(self.db)

        self.assertEqual(plan['references'].get('ws_ac_service_style_prefs.user'), 1)
        self.assertEqual(plan['user_count'], 1)

    def test_discovered_fields_cover_every_registered_user_reference(self):
        ensure_document_modules_imported()

        expected = _registry_user_reference_fields()
        discovered = set(iter_user_reference_fields())

        # 避免「空集空过」：注册表里确实有 User 引用字段
        self.assertTrue(expected, '注册表里应至少有一个 User 引用字段')
        missing = expected - discovered
        self.assertFalse(
            missing,
            '以下 User 引用字段未被迁移脚本发现（会出现半迁移）: %s' % sorted(missing),
        )
        # 真实模型必须在内，防止发现逻辑整体退化
        self.assertIn(('notes', 'user', False), discovered)
        # 测试内自建的 service 风格 Document 也必须在内
        self.assertIn(('ws_ac_service_style_prefs', 'user', False), discovered)

    def test_static_extractor_recovers_fields_from_unimportable_module(self):
        """knowledge_base.mongodb_models 在当前环境导入失败（NotRegistered），
        但它的字段必须能被静态提取，否则这些集合的 User 引用会被半迁移漏掉。"""
        fields = static_user_reference_fields('knowledge_base.mongodb_models')

        expected = {
            ('knowledge_bases', 'owner', False),
            ('knowledge_base_snapshots', 'created_by', False),
            ('knowledge_base_imports', 'user', False),
            ('knowledge_base_queries', 'user', False),
        }
        self.assertTrue(expected <= fields, '静态提取缺失: %s' % sorted(expected - fields))

    def test_iter_fields_includes_statics_from_unimportable_modules(self):
        discovered = set(iter_user_reference_fields())

        self.assertIn(('knowledge_bases', 'owner', False), discovered)
        self.assertIn(('knowledge_base_queries', 'user', False), discovered)

    def test_plan_surfaces_unresolved_modules(self):
        plan = build_plan(self.db)
        _imported, failed = ensure_document_modules_imported()

        self.assertIn('unresolved_modules', plan)
        self.assertEqual({item['module'] for item in plan['unresolved_modules']}, set(failed))
        for item in plan['unresolved_modules']:
            self.assertIsInstance(item['declares_user_reference'], bool)

        # 当前环境 knowledge_base.mongodb_models 因 NotRegistered 导入失败，且确实声明了 User 引用
        if 'knowledge_base.mongodb_models' in failed:
            entry = next(
                item for item in plan['unresolved_modules']
                if item['module'] == 'knowledge_base.mongodb_models'
            )
            self.assertTrue(entry['declares_user_reference'])
            self.assertTrue(plan['has_unresolved_user_references'])

    def test_static_extractor_does_not_guess_missing_module(self):
        self.assertEqual(static_user_reference_fields('__not_a_module__'), set())

    def test_registry_conflicts_are_reported(self):
        conflicts = find_registry_conflicts()

        by_name = {item['class_name']: item for item in conflicts}
        self.assertIn('Note', by_name, '仓库里存在同名 Note 定义，应被检测出来')
        self.assertGreaterEqual(len(by_name['Note']['modules']), 2)
        self.assertTrue(
            any(item['affects_user_references'] for item in conflicts),
            '至少应报出一个「同名类里含 User 引用」的冲突',
        )

    def test_shadowed_registry_still_finds_all_note_reference_fields(self):
        """注册表按类名索引会被同名类遮蔽；脚本用源码静态枚举兜底，不允许静默漏字段。"""
        from mongoengine.base.common import _document_registry

        for name in ('notes', 'categories', 'tags', 'ws_ac_shadowed_notes'):
            self.db.drop_collection(name)
        self.db.notes.insert_one({'user': self.legacy_id, 'title': 'T', 'is_deleted': False})
        self.db.categories.insert_one({'user': self.legacy_id, 'name': 'C1', 'is_deleted': False})
        self.db.tags.insert_one({'user': self.legacy_id, 'name': 'T1', 'is_deleted': False})

        saved = {name: _document_registry.get(name) for name in ('Note', 'Category', 'Tag')}
        try:
            # 制造遮蔽：Note/Category/Tag 全被「别的模块的同名类」顶替
            _document_registry['Note'] = ShadowedNote
            _document_registry['Category'] = ShadowedNote
            _document_registry['Tag'] = ShadowedNote

            discovered = set(iter_user_reference_fields())
            self.assertIn(('notes', 'user', False), discovered)
            self.assertIn(('categories', 'user', False), discovered)
            self.assertIn(('tags', 'user', False), discovered)

            plan = build_plan(self.db)
            for key in ('notes.user', 'categories.user', 'tags.user'):
                self.assertEqual(plan['references'].get(key), 1, '%s 被遮蔽漏统计' % key)
            # setUp 还额外放了一条 ws_ac_service_style_prefs 引用，因此总数 >= 3 即可
            self.assertGreaterEqual(plan['reference_count'], 3)
        finally:
            for name, model in saved.items():
                if model is None:
                    _document_registry.pop(name, None)
                else:
                    _document_registry[name] = model

    def test_unhandled_embedded_reference_blocks_apply(self):
        """嵌入文档里的 User 引用（knowledge_bases.members[].user）当前不改写，
        命中时必须拒绝 --apply，而不是留下半迁移。"""
        self.db.knowledge_bases.insert_one({
            '_id': ObjectId(),
            'owner': self.legacy_id,
            'members': [{'user': self.legacy_id, 'role': 'owner'}],
        })

        plan = build_plan(self.db)
        findings = {(item['collection'], item['path']) for item in plan['unhandled_references']}
        self.assertIn(('knowledge_bases', 'members.0.user'), findings)

        with self.assertRaises(RuntimeError):
            migrate(self.db, apply=True, out=lambda *_args: None)

        # 拒绝执行后，用户与嵌入引用都保持旧形态（没有半迁移）
        self.assertIsNotNone(self.db.users.find_one({'_id': self.legacy_id}))
        knowledge_base = self.db.knowledge_bases.find_one({})
        self.assertEqual(knowledge_base['members'][0]['user'], self.legacy_id)
        self.assertEqual(knowledge_base['owner'], self.legacy_id)
