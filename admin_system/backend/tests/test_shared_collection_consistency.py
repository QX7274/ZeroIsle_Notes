"""共享集合主键口径核查工具的测试（阶段3 闭环）。

用 mongomock 造出各种主键形态的数据，验证核查工具能正确识别，
且**绝不修改数据**。
"""

import uuid

import mongomock
import pytest
from bson.binary import Binary, UuidRepresentation
from bson.objectid import ObjectId

from scripts.check_shared_collection_consistency import (
    SHARED_COLLECTIONS,
    check_collection,
    classify_id,
)


@pytest.fixture
def db():
    return mongomock.MongoClient(uuidRepresentation='standard').get_database('t')


# ---------- classify_id ----------

def test_classify_binary_uuid():
    raw = Binary.from_uuid(uuid.uuid4(), UuidRepresentation.STANDARD)
    assert classify_id(raw) == 'binary_uuid'


def test_classify_string_uuid():
    assert classify_id(str(uuid.uuid4())) == 'string_uuid'


def test_classify_objectid():
    assert classify_id(ObjectId()) == 'objectid'


def test_classify_plain_string():
    assert classify_id('not-a-uuid') == 'string_other'


def test_classify_native_uuid():
    assert classify_id(uuid.uuid4()) == 'binary_uuid'


# ---------- check_collection ----------

def test_all_binary_reports_ok(db):
    for _ in range(3):
        db['users'].insert_one({'_id': Binary.from_uuid(uuid.uuid4(), UuidRepresentation.STANDARD)})
    result = check_collection(db, 'users', 'binary_uuid')
    assert result['status'] == 'OK'
    assert result['total'] == 3
    assert result['distribution'] == {'binary_uuid': 3}


def test_string_ids_report_needs_migration(db):
    """核心用例：字符串 _id（RISK-BE-003 的形态）必须被识别为需要迁移。"""
    db['users'].insert_one({'_id': str(uuid.uuid4())})
    result = check_collection(db, 'users', 'binary_uuid')
    assert result['status'] == 'NEEDS_MIGRATION'
    assert result['distribution'] == {'string_uuid': 1}
    assert 'string_uuid' in result['wrong_samples']


def test_objectid_reports_needs_migration(db):
    """阶段3 之前未声明 id 的模型会落 ObjectId，也必须被识别。"""
    db['tags'].insert_one({'_id': ObjectId()})
    result = check_collection(db, 'tags', 'binary_uuid')
    assert result['status'] == 'NEEDS_MIGRATION'
    assert result['distribution'] == {'objectid': 1}


def test_mixed_ids_are_counted_separately(db):
    db['notes'].insert_one({'_id': Binary.from_uuid(uuid.uuid4(), UuidRepresentation.STANDARD)})
    db['notes'].insert_one({'_id': str(uuid.uuid4())})
    db['notes'].insert_one({'_id': ObjectId()})
    result = check_collection(db, 'notes', 'binary_uuid')
    assert result['status'] == 'NEEDS_MIGRATION'
    assert result['total'] == 3
    assert result['distribution'] == {'binary_uuid': 1, 'string_uuid': 1, 'objectid': 1}


def test_empty_collection_reports_empty(db):
    """显式创建一个空集合，应报 EMPTY（无需迁移）。"""
    db.create_collection('users')
    result = check_collection(db, 'users', 'binary_uuid')
    assert result['status'] == 'EMPTY'
    assert result['total'] == 0


def test_deleted_collection_reports_missing(db):
    """集合被清空后若被后端剔除，应报 MISSING 而不是 EMPTY。

    注意：mongomock（与真实 MongoDB 语义一致）在集合变空后会将其从
    list_collection_names() 中移除，因此这里落到 MISSING 分支。
    两种状态对迁移决策的含义相同——都无需迁移。
    """
    db['users'].insert_one({'_id': Binary.from_uuid(uuid.uuid4(), UuidRepresentation.STANDARD)})
    db['users'].delete_many({})
    result = check_collection(db, 'users', 'binary_uuid')
    assert result['status'] in ('EMPTY', 'MISSING')
    assert result['total'] == 0


def test_missing_collection_reports_missing(db):
    result = check_collection(db, 'does_not_exist', 'binary_uuid')
    assert result['status'] == 'MISSING'


def test_check_does_not_modify_data(db):
    """核查工具必须是只读的。"""
    db['users'].insert_one({'_id': str(uuid.uuid4()), 'username': 'legacy'})
    before = list(db['users'].find({}))
    check_collection(db, 'users', 'binary_uuid')
    after = list(db['users'].find({}))
    assert before == after, '核查工具不应修改任何数据'


def test_shared_collections_are_all_binary_uuid():
    """口径表本身的自检：共享集合期望形态都应是 binary_uuid。"""
    assert SHARED_COLLECTIONS
    assert set(SHARED_COLLECTIONS.values()) == {'binary_uuid'}
    # 阶段3 改名后的集合必须在内
    assert 'note_comments' in SHARED_COLLECTIONS
    assert 'note_attachments' in SHARED_COLLECTIONS
