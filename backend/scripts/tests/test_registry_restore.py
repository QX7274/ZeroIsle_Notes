"""RISK-BE-017 回归：迁移脚本的「引用发现」不得在进程内污染 mongoengine 注册表。

背景（task-41 定位、task-42 根治）：
- 发现逻辑会 import 所有定义 Document 的模块，含 notes/mongodb_models_legacy.py；
- _document_registry 按类名索引 ⇒ legacy 的 Note/NoteCollaboration… 覆盖规范类，且进程内永久生效；
- 后果：ReferenceField("Note") 解析到 legacy 类 → NoteCollaboration 校验失败
  （A ReferenceField only accepts DBRef, LazyReference, ObjectId or documents: ['note']）。

本文件锁定三件事：
1) 进程内污染回归：调用发现逻辑后，注册表键必须与调用前一致（Note/User 指向规范类）；
2) 能力不回退：发现结果仍包含 notes/categories/tags.user，且同名冲突仍被报出；
3) 异常路径：枚举中途抛错也必须回填（try/finally）。
"""

from unittest.mock import patch

from django.test import TestCase
from mongoengine.base.common import _document_registry

from notes.mongodb_models import Note
from scripts import migrate_user_uuid_to_binary as script
from scripts.migrate_user_uuid_to_binary import (
    collect_user_reference_fields,
    find_registry_conflicts,
    iter_user_reference_fields,
)
from users.mongodb_models import User

EXPECTED_NOTE_FIELDS = (
    ('notes', 'user', False),
    ('categories', 'user', False),
    ('tags', 'user', False),
)


class RegistryRestoreTests(TestCase):
    def test_discovery_does_not_pollute_registry(self):
        before = dict(_document_registry)
        self.assertIs(before.get('Note'), Note, '前置条件：registry[Note] 应已是规范类')

        collect_user_reference_fields()  # 直接走发现路径（无枚举缓存）

        self.assertIs(_document_registry.get('Note'), Note, '发现后 registry[Note] 被 legacy 覆盖')
        self.assertIs(_document_registry.get('User'), User, '发现后 registry[User] 被覆盖')

        changed = [name for name, model in before.items() if _document_registry.get(name) is not model]
        self.assertEqual(changed, [], '以下注册表键在发现后被替换: %s' % changed)

    def test_discovery_keeps_new_registrations(self):
        """回填只恢复被覆盖的键，不删除枚举期间新增的注册项（否则 get_document 会 NotRegistered）。"""
        before_keys = set(_document_registry)
        collect_user_reference_fields()
        added = set(_document_registry) - before_keys

        from mongoengine.base.common import get_document

        for name in added:
            self.assertIs(get_document(name), _document_registry[name])

    def test_capability_not_regressed_after_restore(self):
        first = set(collect_user_reference_fields())
        second = set(collect_user_reference_fields())

        for key in EXPECTED_NOTE_FIELDS:
            self.assertIn(key, first)
        # 回填注册表后再次枚举，结果必须一致（静态兜底 + 缓存保证不漏）
        self.assertEqual(first, second, '回填后再次枚举出现差异: %s' % sorted(first ^ second))
        self.assertEqual(set(iter_user_reference_fields()), first)

        conflicts = find_registry_conflicts()
        by_name = {item['class_name']: item for item in conflicts}
        self.assertIn('Note', by_name, '同名类冲突检测不应回退')
        self.assertGreaterEqual(len(by_name['Note']['modules']), 2)

    def test_registry_restored_when_enumeration_raises(self):
        with patch.object(script, '_reference_target', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                collect_user_reference_fields()

        self.assertIs(_document_registry.get('Note'), Note, '异常路径没有回填 registry[Note]')
        self.assertIs(_document_registry.get('User'), User, '异常路径没有回填 registry[User]')
        self.assertNotEqual(
            getattr(_document_registry.get('Note'), '__module__', ''),
            'notes.mongodb_models_legacy',
        )
