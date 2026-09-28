"""RISK-BE-003 迁移脚本测试（mongomock，不碰真实库）。

覆盖：
1. dry-run 不改数据；
2. apply 后 users._id 变为 Binary、指向它的 Note/Category/Tag 引用同步改写、反解成功、业务字段与文档数不变；
3. 幂等：重复执行不再改动，计划为空；
4. 主键口径守护：users 与 notes 侧模型的 UUID 主键都是 binary=True。
"""

import uuid as uuid_module

from bson.binary import Binary, UuidRepresentation
from django.test import TestCase
from mongoengine import UUIDField
from mongoengine.connection import get_db

from notes.mongodb_models import Category, Note, Tag
from users.mongodb_models import User

from scripts.migrate_user_uuid_to_binary import (
    build_plan,
    iter_user_reference_fields,
    migrate,
)

MONGO_COLLECTIONS = ('users', 'user_profiles', 'notes', 'note_versions', 'categories', 'tags')


def _register_authoritative_models():
    """把 notes.mongodb_models 的 Note/Category/Tag 固定为 mongoengine 注册表中的同名类。

    mongoengine 的 _document_registry 以「类名」为键：notes.mongodb_models_legacy /
    community.mongodb_models 里存在同名 Document，谁最后被导入谁生效。注册表被覆盖后，
    scripts.migrate_user_uuid_to_binary.iter_user_reference_fields() 会枚举到错误的模型、
    漏统计真实引用（已作为产品缺陷上报）。测试这里固定口径，保证 build_plan 统计确定。
    """
    from mongoengine.base.common import _document_registry

    for model in (Note, Category, Tag):
        _document_registry[model.__name__] = model


def _cleanup_collections(db):
    """mongomock 不参与 Django 事务回滚，用例开始前把相关集合恢复成干净的「旧库形态」。

    注意不能只 delete_many({})：mongoengine 的 Document.save() 会自动 ensure_indexes，
    别的用例保存 MongoUser 后会在 users 上留下 unique index(username)（同一 pytest 进程
    共享同一个 mongomock）。迁移脚本按「先插入新文档 → 再删旧文档」改写主键，一旦沿用
    残留索引就会立刻撞 E11000（已作为产品缺陷上报：脚本在带 unique username 索引的
    真实库上无法 apply）。drop_collection 同时清掉文档与索引，保证用例与执行顺序无关。
    """
    for name in MONGO_COLLECTIONS:
        db.drop_collection(name)
    # 其他含 User 引用的集合也可能残留（同进程共享 mongomock），一并 drop：
    # drop_collection 同时清索引，保证迁移的「删旧→插新」不被残留 unique index 干扰。
    for collection_name, _field_name, _is_list in iter_user_reference_fields():
        if collection_name not in MONGO_COLLECTIONS:
            db.drop_collection(collection_name)


class UserUuidBinaryMigrationTests(TestCase):
    def setUp(self):
        self.db = get_db('default')
        _cleanup_collections(self.db)
        _register_authoritative_models()

        self.legacy_id = str(uuid_module.uuid4())
        # notes 侧主键本来就是 Binary 口径；这里显式用 Binary 构造，避免 mongomock 对原生 UUID 的
        # 编码校验（UNSPECIFIED）——与迁移后真实落库形态一致。
        self.note_id = Binary.from_uuid(uuid_module.uuid4(), UuidRepresentation.STANDARD)
        self.category_id = Binary.from_uuid(uuid_module.uuid4(), UuidRepresentation.STANDARD)
        self.tag_id = Binary.from_uuid(uuid_module.uuid4(), UuidRepresentation.STANDARD)

        # 复刻旧库形态：users._id 是字符串；引用存的也是字符串（dbref=False 时直接存主键值）
        self.db.users.insert_one({
            '_id': self.legacy_id,
            'username': 'legacy-user',
            'password': 'hashed-password',
            'is_active': True,
        })
        self.db.notes.insert_one({
            '_id': self.note_id,
            'user': self.legacy_id,
            'title': 'T',
            'content': 'C',
            'is_deleted': False,
        })
        self.db.categories.insert_one({
            '_id': self.category_id,
            'user': self.legacy_id,
            'name': 'C1',
            'is_deleted': False,
        })
        self.db.tags.insert_one({
            '_id': self.tag_id,
            'user': self.legacy_id,
            'name': 'T1',
            'is_deleted': False,
        })

    def test_build_plan_counts_legacy_users_and_references(self):
        plan = build_plan(self.db)

        self.assertEqual(plan['legacy_user_ids'], [self.legacy_id])
        self.assertEqual(plan['user_count'], 1)
        self.assertEqual(plan['reference_count'], 3)
        for key in ('notes.user', 'categories.user', 'tags.user'):
            self.assertEqual(plan['references'].get(key), 1)

    def test_dry_run_does_not_change_any_data(self):
        lines = []
        migrate(self.db, apply=False, out=lines.append)

        self.assertTrue(any('dry-run' in line for line in lines))
        self.assertTrue(any('notes.user: 1' in line for line in lines))
        # 数据保持旧形态
        self.assertIsNotNone(self.db.users.find_one({'_id': self.legacy_id}))
        self.assertEqual(self.db.notes.find_one({'_id': self.note_id})['user'], self.legacy_id)
        self.assertEqual(self.db.categories.find_one({'_id': self.category_id})['user'], self.legacy_id)
        self.assertEqual(self.db.tags.find_one({'_id': self.tag_id})['user'], self.legacy_id)

    def test_apply_rewrites_id_and_references_and_dereference_works(self):
        expected_binary = Binary.from_uuid(
            uuid_module.UUID(self.legacy_id), UuidRepresentation.STANDARD
        )

        migrate(self.db, apply=True, out=lambda *_args: None)

        # 1) users._id 变成 Binary，旧字符串主键消失，业务字段保留
        user_document = self.db.users.find_one({'_id': expected_binary})
        self.assertIsNotNone(user_document)
        self.assertEqual(user_document['username'], 'legacy-user')
        self.assertEqual(user_document['password'], 'hashed-password')
        self.assertIsNone(self.db.users.find_one({'_id': self.legacy_id}))

        # 2) 引用同步改写为 Binary
        self.assertEqual(self.db.notes.find_one({'_id': self.note_id})['user'], expected_binary)
        self.assertEqual(self.db.categories.find_one({'_id': self.category_id})['user'], expected_binary)
        self.assertEqual(self.db.tags.find_one({'_id': self.tag_id})['user'], expected_binary)

        # 3) 反解成功（修复前这里是 DoesNotExist）
        self.assertEqual(Note.objects.get(id=self.note_id).user.username, 'legacy-user')
        self.assertEqual(Category.objects.get(id=self.category_id).user.username, 'legacy-user')
        self.assertEqual(Tag.objects.get(id=self.tag_id).user.username, 'legacy-user')

        # 4) 文档数与业务字段不变
        self.assertEqual(self.db.users.count_documents({}), 1)
        self.assertEqual(self.db.notes.count_documents({}), 1)
        self.assertEqual(self.db.categories.count_documents({}), 1)
        self.assertEqual(self.db.tags.count_documents({}), 1)
        note_document = self.db.notes.find_one({'_id': self.note_id})
        self.assertEqual(note_document['title'], 'T')
        self.assertEqual(note_document['content'], 'C')

    def test_apply_is_idempotent(self):
        migrate(self.db, apply=True, out=lambda *_args: None)
        user_id_after_first = self.db.users.find_one({})['_id']
        note_user_after_first = self.db.notes.find_one({})['user']

        plan = build_plan(self.db)
        self.assertEqual(plan['user_count'], 0)
        self.assertEqual(plan['reference_count'], 0)

        lines = []
        migrate(self.db, apply=True, out=lines.append)
        self.assertTrue(any('幂等' in line for line in lines))

        self.assertEqual(self.db.users.find_one({})['_id'], user_id_after_first)
        self.assertEqual(self.db.notes.find_one({})['user'], note_user_after_first)
        self.assertEqual(self.db.users.count_documents({}), 1)

    def test_users_and_notes_primary_keys_use_binary_uuid(self):
        for model in (User, Note, Category, Tag):
            id_field = model._fields[model._meta['id_field']]
            self.assertIsInstance(id_field, UUIDField, model.__name__)
            self.assertTrue(
                getattr(id_field, '_binary'),
                '%s 的主键应为 binary=True（与 notes 侧口径一致）' % model.__name__,
            )
