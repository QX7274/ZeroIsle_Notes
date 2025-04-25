"""
笔记视图测试
"""

from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from notes.models import Note, Category, Tag

User = get_user_model()

class NoteViewSetTest(APITestCase):
    """笔记视图集测试类"""
    
    def setUp(self):
        """测试前准备"""
        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        
        # 创建另一个用户
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='otherpassword'
        )
        
        # 创建分类
        self.category = Category.objects.create(
            name='测试分类',
            user=self.user
        )
        
        # 创建标签
        self.tag = Tag.objects.create(
            name='测试标签',
            user=self.user
        )
        
        # 创建笔记
        self.note = Note.objects.create(
            title='测试笔记',
            content='这是一个测试笔记的内容',
            user=self.user,
            category=self.category
        )
        self.note.tags.add(self.tag)
        
        # 创建公开笔记
        self.public_note = Note.objects.create(
            title='公开笔记',
            content='这是一个公开的笔记',
            user=self.user,
            is_public=True
        )
        
        # 创建其他用户的笔记
        self.other_note = Note.objects.create(
            title='其他用户的笔记',
            content='这是其他用户的笔记',
            user=self.other_user
        )
        
        # 登录
        self.client.force_authenticate(user=self.user)
    
    def test_list_notes(self):
        """测试获取笔记列表"""
        url = reverse('note-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)  # 用户自己的两个笔记
    
    def test_create_note(self):
        """测试创建笔记"""
        url = reverse('note-list')
        data = {
            'title': '新笔记',
            'content': '这是一个新笔记',
            'category': self.category.id,
            'tags': [self.tag.id],
            'is_favorite': True
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Note.objects.count(), 4)
        self.assertEqual(Note.objects.get(title='新笔记').user, self.user)
    
    def test_retrieve_note(self):
        """测试获取笔记详情"""
        url = reverse('note-detail', args=[self.note.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], '测试笔记')
        self.assertEqual(response.data['content'], '这是一个测试笔记的内容')
    
    def test_update_note(self):
        """测试更新笔记"""
        url = reverse('note-detail', args=[self.note.id])
        data = {
            'title': '更新的笔记',
            'content': '这是更新后的内容'
        }
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, '更新的笔记')
        self.assertEqual(self.note.content, '这是更新后的内容')
    
    def test_delete_note(self):
        """测试删除笔记"""
        url = reverse('note-detail', args=[self.note.id])
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.note.refresh_from_db()
        self.assertTrue(self.note.is_deleted)
    
    def test_toggle_favorite(self):
        """测试切换收藏状态"""
        url = reverse('note-toggle-favorite', args=[self.note.id])
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.note.refresh_from_db()
        self.assertTrue(self.note.is_favorite)
        
        # 再次切换
        response = self.client.post(url)
        self.note.refresh_from_db()
        self.assertFalse(self.note.is_favorite)
    
    def test_other_user_cannot_update_note(self):
        """测试其他用户不能更新笔记"""
        self.client.force_authenticate(user=self.other_user)
        url = reverse('note-detail', args=[self.note.id])
        data = {
            'title': '尝试更新',
            'content': '尝试更新内容'
        }
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, '测试笔记')  # 标题未变
    
    def test_other_user_can_view_public_note(self):
        """测试其他用户可以查看公开笔记"""
        self.client.force_authenticate(user=self.other_user)
        url = reverse('note-detail', args=[self.public_note.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], '公开笔记')
