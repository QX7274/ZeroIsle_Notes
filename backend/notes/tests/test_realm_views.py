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

from .helpers import mongo_user_for, reset_mongo_test_data

User = get_user_model()
logger = logging.getLogger(__name__)

# notes 与 community 两个 app 都注册了 basename=tag / category，notes_realm_url('tags') 会命中
# community 的视图（后注册者胜出），因此这里直接构造 notes app 的 Realm 端点路径。
NOTES_API_PREFIX = '/api/v1/notes/'
RESOURCE_PATHS = {'notes': 'notes', 'categories': 'categories', 'tags': 'tags'}


def notes_realm_url(resource, pk=None):
    base = NOTES_API_PREFIX + RESOURCE_PATHS[resource] + '/'
    return base if pk is None else base + str(pk) + '/'

class RealmNoteViewSetTestCase(TestCase):
    """MongoDB Realm笔记视图集测试"""

    def setUp(self):
        """测试前准备"""
        reset_mongo_test_data()
        self.client = APIClient()

        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        self.client.force_authenticate(user=self.user)
        # mongoengine 文档引用的是镜像出的 MongoUser，不是 Django user
        self.mongo_user = mongo_user_for(self.user)

        # 创建测试分类
        self.category = Category(
            id=uuid.uuid4(),
            user=self.mongo_user,
            name='测试分类',
            description='测试分类描述',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.category.save()

        # 创建测试标签
        self.tag = Tag(
            id=uuid.uuid4(),
            user=self.mongo_user,
            name='测试标签',
            color='#FF0000',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.tag.save()

        # 创建测试笔记
        self.note = Note(
            id=uuid.uuid4(),
            user=self.mongo_user,
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
        Note.objects.filter(user=self.mongo_user).delete()
        Category.objects.filter(user=self.mongo_user).delete()
        Tag.objects.filter(user=self.mongo_user).delete()

    def test_list_notes(self):
        """测试获取笔记列表"""
        url = notes_realm_url('notes')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['title'], '测试笔记')

    def test_retrieve_note(self):
        """测试获取单个笔记详情"""
        url = notes_realm_url('notes', self.note.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], '测试笔记')
        self.assertEqual(response.data['content'], '测试笔记内容')

    def test_create_note(self):
        """测试创建笔记"""
        url = notes_realm_url('notes')
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
        # 当前契约（notes/serializers/note.py NoteDetailSerializer）：
        # - category 是 source='category.id' 的扁平 UUID 字符串；
        # - tags 目前是 ListField(child=CharField())，mongoengine 的 Tag 会被 str() 成 "name (id)"。
        #   （对比 NoteListSerializer 用的是 TagSerializer(many=True)；若之后统一成嵌套 dict，
        #     这里应同步改为 response.data['tags'][0]['id']。）
        self.assertEqual(response.data['category'], str(self.category.id))
        self.assertEqual(len(response.data['tags']), 1)
        self.assertEqual(response.data['tags'][0], str(self.tag))
        self.assertTrue(response.data['is_favorite'])
        self.assertFalse(response.data['is_public'])

    def test_update_note(self):
        """测试更新笔记"""
        url = notes_realm_url('notes', self.note.id)
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
        url = notes_realm_url('notes', self.note.id)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 验证笔记已软删除
        note = Note.objects.get(id=self.note.id)
        self.assertTrue(note.is_deleted)

class RealmCategoryViewSetTestCase(TestCase):
    """MongoDB Realm分类视图集测试"""

    def setUp(self):
        """测试前准备"""
        reset_mongo_test_data()
        self.client = APIClient()

        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        self.client.force_authenticate(user=self.user)
        # mongoengine 文档引用的是镜像出的 MongoUser，不是 Django user
        self.mongo_user = mongo_user_for(self.user)

        # 创建测试分类
        self.category = Category(
            id=uuid.uuid4(),
            user=self.mongo_user,
            name='测试分类',
            description='测试分类描述',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.category.save()

    def tearDown(self):
        """测试后清理"""
        # 删除测试数据
        Category.objects.filter(user=self.mongo_user).delete()

    def test_list_categories(self):
        """测试获取分类列表"""
        url = notes_realm_url('categories')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], '测试分类')

    def test_retrieve_category(self):
        """测试获取单个分类详情"""
        url = notes_realm_url('categories', self.category.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], '测试分类')
        self.assertEqual(response.data['description'], '测试分类描述')

    def test_create_category(self):
        """测试创建分类"""
        url = notes_realm_url('categories')
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
        url = notes_realm_url('categories', self.category.id)
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
        url = notes_realm_url('categories', self.category.id)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 验证分类已软删除
        category = Category.objects.get(id=self.category.id)
        self.assertTrue(category.is_deleted)

class RealmTagViewSetTestCase(TestCase):
    """MongoDB Realm标签视图集测试"""

    def setUp(self):
        """测试前准备"""
        reset_mongo_test_data()
        self.client = APIClient()

        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        self.client.force_authenticate(user=self.user)
        # mongoengine 文档引用的是镜像出的 MongoUser，不是 Django user
        self.mongo_user = mongo_user_for(self.user)

        # 创建测试标签
        self.tag = Tag(
            id=uuid.uuid4(),
            user=self.mongo_user,
            name='测试标签',
            color='#FF0000',
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        self.tag.save()

    def tearDown(self):
        """测试后清理"""
        # 删除测试数据
        Tag.objects.filter(user=self.mongo_user).delete()

    def test_list_tags(self):
        """测试获取标签列表"""
        url = notes_realm_url('tags')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], '测试标签')

    def test_retrieve_tag(self):
        """测试获取单个标签详情"""
        url = notes_realm_url('tags', self.tag.id)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], '测试标签')
        self.assertEqual(response.data['color'], '#FF0000')

    def test_create_tag(self):
        """测试创建标签"""
        url = notes_realm_url('tags')
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
        url = notes_realm_url('tags', self.tag.id)
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
        url = notes_realm_url('tags', self.tag.id)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # 验证标签已软删除
        tag = Tag.objects.get(id=self.tag.id)
        self.assertTrue(tag.is_deleted)
