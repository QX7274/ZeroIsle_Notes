"""
笔记模型测试
"""

from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from notes.models import Note, Category, Tag
from notes.serializers import NoteDetailSerializer, NoteListSerializer

from .helpers import mongo_user_for, reset_mongo_test_data

User = get_user_model()

class NoteModelTest(TestCase):
    """笔记模型测试类"""
    
    def setUp(self):
        """测试前准备"""
        reset_mongo_test_data()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        # mongoengine 文档引用的是镜像出的 MongoUser，不是 Django user
        self.mongo_user = mongo_user_for(self.user)
        
        self.category = Category.objects.create(
            name='测试分类',
            user=self.mongo_user
        )
        
        self.tag = Tag.objects.create(
            name='测试标签',
            user=self.mongo_user
        )
        
        self.note = Note.objects.create(
            title='测试笔记',
            content='这是一个测试笔记的内容',
            user=self.mongo_user,
            category=self.category,
            tags=[self.tag]
        )
    
    def test_note_creation(self):
        """测试笔记创建"""
        self.assertEqual(self.note.title, '测试笔记')
        self.assertEqual(self.note.content, '这是一个测试笔记的内容')
        self.assertEqual(self.note.user, self.mongo_user)
        self.assertEqual(self.note.category, self.category)
        # mongoengine ListField 返回 BaseList（list 子类），没有 Django QuerySet 的 .count()
        self.assertEqual(len(self.note.tags), 1)
        self.assertEqual(self.note.tags[0], self.tag)
        self.assertFalse(self.note.is_favorite)
        self.assertFalse(self.note.is_public)
        self.assertFalse(self.note.is_deleted)
    
    def test_note_str(self):
        """测试笔记字符串表示"""
        # 当前模型契约：Note.__str__ 返回 "title (id)"（见 notes/mongodb_models/note.py:59）
        self.assertEqual(str(self.note), f'测试笔记 ({self.note.id})')
    
    def test_note_word_count(self):
        """测试笔记字数统计（口径：非空白字符数，CJK 与 ASCII 一视同仁）

        口径定义见 Note.word_count（notes/mongodb_models/note.py）：
        统计 str.isspace() 为假的字符数，空格/制表符/换行/全角空格(U+3000) 都不计；
        空内容或纯空白为 0；按字符计而不是按自然语言词数计。
        同时断言真实对外契约：NoteListSerializer / NoteDetailSerializer 必须返回该字段
        （此前 serializer 声明了 word_count 而模型未实现，接口从不返回）。
        """
        # setUp 的笔记内容 '这是一个测试笔记的内容' → 11 个非空白字符
        self.assertEqual(self.note.word_count, 11)
        self.assertEqual(NoteDetailSerializer(self.note).data['word_count'], 11)
        self.assertEqual(NoteListSerializer(self.note).data['word_count'], 11)

        cases = [
            ('', 0),                          # 空串
            ('   \t\n  ', 0),                # 纯空白（空格/制表/换行）
            ('hello world', 10),              # ASCII 多词：空格不计
            ('你好，世界', 5),                 # CJK：含全角标点，均为非空白字符
            ('Hello 世界\n你好 world', 14),   # 混合：5 + 2 + 2 + 5
            ('你好\u3000世界', 4),            # 全角空格 U+3000 属于空白
        ]
        for content, expected in cases:
            note = Note.objects.create(
                title='字数口径用例',
                content=content,
                user=self.mongo_user,
                category=self.category,
            )
            self.assertEqual(note.word_count, expected, f'content={content!r} 的非空白字符数应为 {expected}')
            # 从库重新读回（客户端实际拿到的形态）：计算属性不得依赖未落库的实例状态
            self.assertEqual(Note.objects.get(id=note.id).word_count, expected)
            # 对外契约：两个序列化器都要返回同一口径的值
            self.assertEqual(
                NoteDetailSerializer(note).data['word_count'], expected,
                f'NoteDetailSerializer 对 content={content!r} 的 word_count 不一致',
            )
            self.assertEqual(
                NoteListSerializer(note).data['word_count'], expected,
                f'NoteListSerializer 对 content={content!r} 的 word_count 不一致',
            )
    
    def test_note_soft_delete(self):
        """测试笔记软删除（真实契约：软删除在视图层，模型没有软删除/硬删除 API）

        现状核实：notes/mongodb_models/note.py 的 Note 只有 is_deleted/deleted_at 字段，
        既没有软删除方法也没有 hard_delete()；Note.delete() 是 mongoengine 的物理删除。
        真实行为由 RealmNoteViewSet.destroy（notes/views/realm_note.py:294）提供：
        DELETE 后文档仍在、is_deleted=True、deleted_at 落库，列表/详情接口不再可见。
        """
        client = APIClient()
        client.force_authenticate(user=self.user)
        list_url = reverse('note-list')
        detail_url = reverse('note-detail', args=[self.note.id])

        # 删除前：列表可见
        before = client.get(list_url)
        self.assertEqual(before.status_code, status.HTTP_200_OK)
        self.assertEqual(before.data['count'], 1)

        response = client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 软删除：文档仍在，仅打上删除标记
        updated_note = Note.objects.get(id=self.note.id)
        self.assertTrue(updated_note.is_deleted)
        self.assertIsNotNone(updated_note.deleted_at)

        # 删除后：列表不可见
        after = client.get(list_url)
        self.assertEqual(after.status_code, status.HTTP_200_OK)
        self.assertEqual(after.data['count'], 0)
        self.assertEqual(after.data['results'], [])

        # 详情也不可访问
        detail = client.get(detail_url)
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)
