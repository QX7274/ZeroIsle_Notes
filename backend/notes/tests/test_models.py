"""
笔记模型测试
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from notes.models import Note, Category, Tag

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
        """测试笔记字数统计"""
        self.assertEqual(self.note.word_count, 12)  # 中文字符计数
        
        # 测试空内容
        empty_note = Note.objects.create(
            title='空笔记',
            content='',
            user=self.mongo_user
        )
        self.assertEqual(empty_note.word_count, 0)
    
    def test_note_soft_delete(self):
        """测试笔记软删除"""
        self.assertFalse(self.note.is_deleted)
        self.assertIsNone(self.note.deleted_at)
        
        self.note.delete()
        
        # 重新获取笔记对象
        updated_note = Note.objects.get(id=self.note.id)
        self.assertTrue(updated_note.is_deleted)
        self.assertIsNotNone(updated_note.deleted_at)
        
        # 测试硬删除
        note_id = self.note.id
        self.note.hard_delete()
        self.assertFalse(Note.objects.filter(id=note_id).exists())
