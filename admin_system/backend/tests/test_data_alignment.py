"""
数据口径对齐回归测试（阶段3）。

锁定管理后台与主后端共用集合时的主键/集合名口径，防止回退。
背景详见 docs/管理后台功能基线与演进规划.md 第 5 节。

核心事实：
- 主后端统一使用 UUIDField(primary_key=True)（binary=True，BSON subtype 4）；
- 管理后台此前 UserProfile 写死 binary=False，会把 _id 落成字符串，
  与主后端指向同一集合却互相查不到（RISK-BE-003 同类事故）；
- 管理后台另有若干模型未声明 id，会落成 ObjectId。
"""

import uuid

import pytest
from mongoengine import UUIDField

from content.models import Attachment, Comment, Note, Tag
from users.models import UserActivity, UserProfile, VerificationCode


# 这些模型的集合与主后端共用，主键必须同为 binary UUID
SHARED_COLLECTION_MODELS = [
    (UserProfile, "users"),
    (UserActivity, "user_activities"),
    (VerificationCode, "verification_codes"),
    (Tag, "tags"),
    (Note, "notes"),
]


@pytest.mark.parametrize("model,collection", SHARED_COLLECTION_MODELS)
def test_shared_collection_pk_is_binary_uuid(model, collection):
    """共用集合的模型必须声明 binary UUID 主键。"""
    assert model._meta["collection"] == collection
    field = model._fields["id"]
    assert isinstance(field, UUIDField), f"{model.__name__}.id 应为 UUIDField（当前未声明 id 会落成 ObjectId）"
    assert field._binary is True, (
        f"{model.__name__}.id 的 binary 必须为 True 才与主后端一致；"
        "binary=False 会把 _id 落成字符串，导致跨系统引用解引用失败"
    )


def test_userprofile_pk_encodes_as_binary_uuid_not_string():
    """UserProfile 主键必须以 binary UUID 编码，而不是字符串。

    说明：这里断言的是 **mongoengine 字段的编码行为**，而不是真的往 mongomock
    里写一条再读回来。原因是本环境 mongoengine 4.x 在构造底层客户端时固定使用
    UuidRepresentation.UNSPECIFIED（会打印 "No uuidRepresentation is specified!
    Falling back to 'pythonLegacy'"），在该表示下写入原生 uuid.UUID 会直接抛
    ValueError——这是 mongomock/驱动表示层的限制，不是被测代码的问题。
    真正决定"_id 落库成 binary 还是字符串"的是 UUIDField._binary 这个开关，
    因此直接断言它更准确、也更稳定（不依赖数据库行为差异）。
    """
    field = UserProfile._fields["id"]
    assert field._binary is True, (
        "UserProfile.id 必须是 binary UUID（_binary=True）。"
        "历史缺陷是 binary=False，会把 _id 落成字符串，"
        "与主后端的 Binary UUID 互相查不到"
    )

    # 反证：binary=False 才是"字符串落库"的形态，二者必须区分得出来
    from mongoengine import UUIDField

    string_mode = UUIDField(primary_key=True, default=uuid.uuid4, binary=False)
    assert string_mode._binary is False
    assert string_mode._binary != field._binary, (
        "binary 与 non-binary 两种主键形态必须可区分；若相等说明该断言失去意义"
    )


def test_phantom_collections_now_point_to_real_app_collections():
    """评论/附件集合名必须与主 App 实际写入的集合一致。

    主 App 写 note_comments / note_attachments；
    管理后台此前写 comments / attachments（主 App 从不写入），
    导致评论与附件管理页永远为空。
    """
    assert Comment._meta["collection"] == "note_comments"
    assert Attachment._meta["collection"] == "note_attachments"


def test_backup_data_group_covers_real_comment_and_attachment_collections():
    """备份的 data 分组必须覆盖主 App 真实集合，否则评论/附件备份不到。

    原先这里校验的是模块源码文本，属于脆弱的"字符串包含"断言。
    改为真正调用 _get_collections_for_backup 并检查其返回值，
    这样才能验证"白名单里的名字确实会被选中"这一行为。
    """
    from settings_api.backup_service_enhanced import BackupServiceEnhanced

    service = BackupServiceEnhanced.__new__(BackupServiceEnhanced)

    # 只替换 db 依赖，不触发真实连接
    class _FakeDB:
        def list_collection_names(self):
            return [
                "notes", "note_comments", "note_attachments",
                "categories", "tags", "users",
            ]

    service.db = _FakeDB()

    selected = service.get_collection_lists_by_type("data")
    assert "note_comments" in selected, f"备份未覆盖 note_comments，实际选中：{selected}"
    assert "note_attachments" in selected, f"备份未覆盖 note_attachments，实际选中：{selected}"
