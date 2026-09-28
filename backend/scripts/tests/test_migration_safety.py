"""迁移脚本在真实库约束下的安全性测试（RISK-BE-003 / WS-AC）。

背景（ws-b-projection 复现）：真实库 users 上有 unique index(username)，
脚本若「先插新文档再删旧文档」会撞 E11000 —— 在真实库上根本无法 apply。
现在改为「备份 → 删旧 → 插新 → 删备份」，本文件锁定该行为。
"""

import uuid as uuid_module

from bson import ObjectId
from bson.binary import Binary, UuidRepresentation
from django.test import TestCase
from mongoengine.connection import get_db

from scripts.migrate_user_uuid_to_binary import build_plan, migrate

BACKUP_COLLECTION = 'user_uuid_migration_backup'


class MigrationWithUniqueIndexTests(TestCase):
    def setUp(self):
        self.db = get_db('default')
        for name in ('users', 'notes', BACKUP_COLLECTION):
            self.db.drop_collection(name)

        # 复刻真实库约束：mongoengine 的 Document.save() 会自动 ensure_indexes
        self.db.users.create_index('username', unique=True)

        self.legacy_id = str(uuid_module.uuid4())
        self.note_id = Binary.from_uuid(uuid_module.uuid4(), UuidRepresentation.STANDARD)
        self.db.users.insert_one({
            '_id': self.legacy_id,
            'username': 'unique-legacy',
            'password': 'hashed',
        })
        self.db.notes.insert_one({
            '_id': self.note_id,
            'user': self.legacy_id,
            'title': 'T',
        })

    def test_plan_lists_affected_unique_indexes_and_prints_them(self):
        plan = build_plan(self.db)

        users_indexes = [spec for spec in plan['unique_indexes'] if spec['collection'] == 'users']
        self.assertTrue(
            any(spec['name'] == 'username_1' or spec['key'] == [['username', 1]] for spec in users_indexes),
            '计划必须列出 users 上的唯一索引: %s' % users_indexes,
        )

        lines = []
        migrate(self.db, apply=False, out=lines.append)
        self.assertTrue(
            any(line.startswith('  unique index users.') for line in lines),
            'dry-run 输出必须打印将处理的索引: %s' % lines,
        )

    def test_apply_succeeds_even_with_unique_username_index(self):
        expected_binary = Binary.from_uuid(
            uuid_module.UUID(self.legacy_id), UuidRepresentation.STANDARD
        )

        migrate(self.db, apply=True, out=lambda *_args: None)

        self.assertEqual(self.db.users.count_documents({}), 1)
        user_document = self.db.users.find_one({'_id': expected_binary})
        self.assertIsNotNone(user_document)
        self.assertEqual(user_document['username'], 'unique-legacy')
        self.assertIsNone(self.db.users.find_one({'_id': self.legacy_id}))
        self.assertEqual(self.db.notes.find_one({'_id': self.note_id})['user'], expected_binary)
        # 备份集合用完即清，不应残留
        self.assertEqual(self.db[BACKUP_COLLECTION].count_documents({}), 0)

        # 唯一索引必须仍然存在（迁移只改 _id，不 drop 索引）
        index_names = self.db.users.index_information()
        self.assertIn('username_1', index_names)
        self.assertTrue(index_names['username_1'].get('unique'))

    def test_unique_index_is_still_enforced_after_migration(self):
        migrate(self.db, apply=True, out=lambda *_args: None)

        with self.assertRaises(Exception):
            self.db.users.insert_one({
                '_id': Binary.from_uuid(uuid_module.uuid4(), UuidRepresentation.STANDARD),
                'username': 'unique-legacy',
                'password': 'x',
            })
