"""
MongoDB Realm视图测试
"""

import json
import uuid
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from django.contrib.auth import get_user_model
from notes.mongodb_models import Note, Category, Tag
from mongodb_service import mongodb_service
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

class RealmNoteViewSetTestCase(TestCase):
    """MongoDB Realm笔记视图集测试"""

    def setUp(self):
        """测试前准备"""
        self.client = APIClient()

        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        self.client.force_authenticate(user=self.user)

        # 创建测试分类
        self.category = Category(
            id=uuid.uuid4(),
            user=self.user,
            name='测试分类',
            description='测试分类描述',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.category.save()

        # 创建测试标签
        self.tag = Tag(
            id=uuid.uuid4(),
            user=self.user,
            name='测试标签',
            color='#FF0000',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.tag.save()

        # 创建测试笔记
        self.note = Note(
            id=uuid.uuid4(),
            user=self.user,
            title='测试笔记',
            content='测试笔记内容',
            category=self.category,
            tags=[self.tag],
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.note.save()

    def tearDown(self):
        """测试后清理"""
        # 删除测试数据
        Note.objects.filter(user=self.user).delete()
        Category.objects.filter(user=self.user).delete()
        Tag.objects.filter(user=self.user).delete()

    def test_list_notes(self):
        """测试获取笔记列表"""
        url = reverse('realm-note-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['title'], '测试笔记')

    def test_retrieve_note(self):
        """测试获取单个笔记详情"""
        url = reverse('realm-note-detail', args=[str(self.note.id)])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], '测试笔记')
        self.assertEqual(response.data['content'], '测试笔记内容')

    def test_create_note(self):
        """测试创建笔记"""
        url = reverse('realm-note-list')
        data = {
            'title': '新笔记',
            'content': '新笔记内容',
            'category': str(self.category.id),
            'tags': [str(self.tag.id)],
            'is_favorite': True,
            'is_public': False
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], '新笔记')
        self.assertEqual(response.data['content'], '新笔记内容')
        self.assertEqual(response.data['category']['id'], str(self.category.id))
        self.assertEqual(len(response.data['tags']), 1)
        self.assertEqual(response.data['tags'][0]['id'], str(self.tag.id))
        self.assertTrue(response.data['is_favorite'])
        self.assertFalse(response.data['is_public'])

    def test_update_note(self):
        """测试更新笔记"""
        url = reverse('realm-note-detail', args=[str(self.note.id)])
        data = {
            'title': '更新的笔记',
            'content': '更新的笔记内容',
            'category': str(self.category.id),
            'tags': [str(self.tag.id)],
            'is_favorite': True,
            'is_public': True
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], '更新的笔记')
        self.assertEqual(response.data['content'], '更新的笔记内容')
        self.assertTrue(response.data['is_favorite'])
        self.assertTrue(response.data['is_public'])

    def test_delete_note(self):
        """测试删除笔记"""
        url = reverse('realm-note-detail', args=[str(self.note.id)])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 验证笔记已软删除
        note = Note.objects.get(id=self.note.id)
        self.assertTrue(note.is_deleted)

class RealmCategoryViewSetTestCase(TestCase):
    """MongoDB Realm分类视图集测试"""

    def setUp(self):
        """测试前准备"""
        self.client = APIClient()

        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        self.client.force_authenticate(user=self.user)

        # 创建测试分类
        self.category = Category(
            id=uuid.uuid4(),
            user=self.user,
            name='测试分类',
            description='测试分类描述',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.category.save()

    def tearDown(self):
        """测试后清理"""
        # 删除测试数据
        Category.objects.filter(user=self.user).delete()

    def test_list_categories(self):
        """测试获取分类列表"""
        url = reverse('realm-category-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], '测试分类')

    def test_retrieve_category(self):
        """测试获取单个分类详情"""
        url = reverse('realm-category-detail', args=[str(self.category.id)])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], '测试分类')
        self.assertEqual(response.data['description'], '测试分类描述')

    def test_create_category(self):
        """测试创建分类"""
        url = reverse('realm-category-list')
        data = {
            'name': '新分类',
            'description': '新分类描述',
            'color': '#00FF00'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], '新分类')
        self.assertEqual(response.data['description'], '新分类描述')
        self.assertEqual(response.data['color'], '#00FF00')

    def test_update_category(self):
        """测试更新分类"""
        url = reverse('realm-category-detail', args=[str(self.category.id)])
        data = {
            'name': '更新的分类',
            'description': '更新的分类描述',
            'color': '#0000FF'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], '更新的分类')
        self.assertEqual(response.data['description'], '更新的分类描述')
        self.assertEqual(response.data['color'], '#0000FF')

    def test_delete_category(self):
        """测试删除分类"""
        url = reverse('realm-category-detail', args=[str(self.category.id)])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 验证分类已软删除
        category = Category.objects.get(id=self.category.id)
        self.assertTrue(category.is_deleted)

class RealmTagViewSetTestCase(TestCase):
    """MongoDB Realm标签视图集测试"""

    def setUp(self):
        """测试前准备"""
        self.client = APIClient()

        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        self.client.force_authenticate(user=self.user)

        # 创建测试标签
        self.tag = Tag(
            id=uuid.uuid4(),
            user=self.user,
            name='测试标签',
            color='#FF0000',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.tag.save()

    def tearDown(self):
        """测试后清理"""
        # 删除测试数据
        Tag.objects.filter(user=self.user).delete()

    def test_list_tags(self):
        """测试获取标签列表"""
        url = reverse('realm-tag-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], '测试标签')

    def test_retrieve_tag(self):
        """测试获取单个标签详情"""
        url = reverse('realm-tag-detail', args=[str(self.tag.id)])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], '测试标签')
        self.assertEqual(response.data['color'], '#FF0000')

    def test_create_tag(self):
        """测试创建标签"""
        url = reverse('realm-tag-list')
        data = {
            'name': '新标签',
            'color': '#00FF00'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], '新标签')
        self.assertEqual(response.data['color'], '#00FF00')

    def test_update_tag(self):
        """测试更新标签"""
        url = reverse('realm-tag-detail', args=[str(self.tag.id)])
        data = {
            'name': '更新的标签',
            'color': '#0000FF'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], '更新的标签')
        self.assertEqual(response.data['color'], '#0000FF')

    def test_delete_tag(self):
        """测试删除标签"""
        url = reverse('realm-tag-detail', args=[str(self.tag.id)])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 验证标签已软删除
        tag = Tag.objects.get(id=self.tag.id)
        self.assertTrue(tag.is_deleted)
