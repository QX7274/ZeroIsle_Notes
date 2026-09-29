"""task-41 回归守护：mongoengine 的文档注册表不得被同名类遮蔽。

背景（实测根因）：
- 迁移脚本的「引用发现」（backend/scripts/migrate_user_uuid_to_binary.py）会 import 所有定义
  Document 的模块，其中包含 backend/notes/mongodb_models_legacy.py；
- mongoengine 的 _document_registry **按类名索引**，legacy 模块的同名类会覆盖规范类：
  registry['Note'] 从 notes.mongodb_models.note.Note 变成 notes.mongodb_models_legacy.Note；
- 后果：notes/tests/test_consumers.py 的 fixture 在构造 NoteCollaboration(note=...) 时，
  ReferenceField('Note') 会解析并缓存成 legacy 类 → ValidationError
  （A ReferenceField only accepts DBRef, LazyReference, ObjectId or documents: ['note']），
  表现为「多目录合并跑时多出 3 个 error」（本文件所在套件的隔离 fixture 已负责恢复注册表）。

本守护用断言把「合并跑 == 分别单跑」的前提钉死：只要有人再次留下遮蔽，这里立刻失败。
"""


def test_registry_note_entry_points_to_canonical_class():
    from mongoengine.base.common import _document_registry

    from notes.mongodb_models import Note

    entry = _document_registry.get('Note')
    assert entry is not None, 'mongoengine 注册表里没有 Note，字符串引用无法解析'
    assert entry is Note, (
        'mongoengine 注册表里的 Note 被同名类遮蔽：%r（应为 %r）。'
        '这会让 ReferenceField("Note") 解析到错误模型，'
        'notes/tests/test_consumers.py 的 fixture 会因此把 skip 变成 ValidationError（task-41）'
        % (entry, Note)
    )


def test_registry_user_entry_points_to_canonical_class():
    from mongoengine.base.common import _document_registry

    from users.mongodb_models import User

    entry = _document_registry.get('User')
    assert entry is not None, 'mongoengine 注册表里没有 User'
    assert entry is User, 'mongoengine 注册表里的 User 被同名类遮蔽：%r' % (entry,)
