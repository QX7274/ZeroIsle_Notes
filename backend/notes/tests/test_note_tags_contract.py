"""标签序列化的对外契约（RISK-BE-005）。

背景：此前 tags 用 @ListField(child=CharField())@，DRF 对 mongoengine 的 Tag 调用 @str()@，
而 @Tag.__str__@ 是 "name (id)"，于是接口返回 "工作 (a0b07759-...)" 这种把 id 混进名称的字符串；
客户端 src/services/api/notesApi.js 对该字段做 tags.map(String) 后直接落库，标签名里就带着 UUID。

本用例锁定「tags 只返回纯名称」这一对外契约。
"""
from notes.mongodb_models import Note, Tag
from notes.serializers import NoteDetailSerializer, NoteListSerializer
from users.mongodb_models import User as MongoUser


def _make_note(tag_names):
    Note.drop_collection()
    Tag.drop_collection()
    MongoUser.drop_collection()
    user = MongoUser(username='tag-contract', password='x').save()
    tags = [Tag(name=name, user=user).save() for name in tag_names]
    note = Note(title='标题', content='正文', user=user, tags=tags).save()
    return Note.objects.get(id=note.id)


def test_list_and_detail_return_plain_tag_names():
    note = _make_note(['工作', '重要'])

    list_tags = NoteListSerializer(note).data['tags']
    detail_tags = NoteDetailSerializer(note).data['tags']

    assert list(list_tags) == ['工作', '重要']
    assert list(detail_tags) == ['工作', '重要']


def test_tag_names_never_leak_ids():
    note = _make_note(['工作'])

    for payload in (NoteListSerializer(note).data, NoteDetailSerializer(note).data):
        for value in payload['tags']:
            assert isinstance(value, str)
            # mongoengine 的 str(Tag) 形如 "工作 (uuid)"；契约要求只有名称、不含括号与 uuid
            assert ' (' not in value
            assert '-' not in value
        assert list(payload['tags']) == ['工作']


def test_note_without_tags_serializes_as_empty_list():
    note = _make_note([])

    assert list(NoteListSerializer(note).data['tags']) == []
    assert list(NoteDetailSerializer(note).data['tags']) == []
