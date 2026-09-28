"""
笔记视图测试
"""

from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from notes.models import Note, Category, Tag

from .helpers import mongo_user_for, reset_mongo_test_data

User = get_user_model()

class NoteViewSetTest(APITestCase):
    """笔记视图集测试类"""

    def setUp(self):
        """测试前准备"""
        reset_mongo_test_data()
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

        # mongoengine 文档引用的是镜像出的 MongoUser，不是 Django user
        self.mongo_user = mongo_user_for(self.user)
        self.other_mongo_user = mongo_user_for(self.other_user)

        # 创建分类
        self.category = Category.objects.create(
            name='测试分类',
            user=self.mongo_user
        )

        # 创建标签
        self.tag = Tag.objects.create(
            name='测试标签',
            user=self.mongo_user
        )

        # 创建笔记
        self.note = Note.objects.create(
            title='测试笔记',
            content='这是一个测试笔记的内容',
            user=self.mongo_user,
            category=self.category,
            tags=[self.tag]
        )

        # 创建公开笔记
        self.public_note = Note.objects.create(
            title='公开笔记',
            content='这是一个公开的笔记',
            user=self.mongo_user,
            is_public=True
        )

        # 创建其他用户的笔记
        self.other_note = Note.objects.create(
            title='其他用户的笔记',
            content='这是其他用户的笔记',
            user=self.other_mongo_user
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
        self.assertEqual(Note.objects.get(title='新笔记').user, self.mongo_user)

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

        response = self.client.put(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.note.reload()
        self.assertEqual(self.note.title, '更新的笔记')
        self.assertEqual(self.note.content, '这是更新后的内容')

    def test_delete_note(self):
        """测试删除笔记"""
        url = reverse('note-detail', args=[self.note.id])
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.note.reload()
        self.assertTrue(self.note.is_deleted)

    def test_toggle_favorite(self):
        """测试切换收藏状态（当前契约：收藏走 note-detail 的 update + is_favorite 字段）

        现状核实：notes/urls.py 把 notes 注册到 RealmNoteViewSet（basename='note'），
        该视图集只有 statistics 一个 action、没有 toggle_favorite，也未定义 partial_update，
        因此既没有 note-toggle-favorite 路由，PATCH 也不路由；收藏的真实路径是
        PUT（update）携带 is_favorite，并可用 ?is_favorite=true 过滤列表来观测结果。
        """
        url = reverse('note-detail', args=[self.note.id])
        list_url = reverse('note-list')
        base = {'title': '测试笔记', 'content': '这是一个测试笔记的内容'}

        # 收藏
        response = self.client.put(url, {**base, 'is_favorite': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_favorite'])
        self.note.reload()
        self.assertTrue(self.note.is_favorite)

        # 收藏状态的对外可观测行为：列表按 is_favorite=true 可过滤到该笔记
        filtered = self.client.get(list_url, {'is_favorite': 'true'})
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertIn('测试笔记', [item['title'] for item in filtered.data['results']])

        # 再次切换（取消收藏）
        response = self.client.put(url, {**base, 'is_favorite': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_favorite'])
        self.note.reload()
        self.assertFalse(self.note.is_favorite)

        # 取消后不再出现在收藏过滤结果中
        filtered = self.client.get(list_url, {'is_favorite': 'true'})
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertNotIn('测试笔记', [item['title'] for item in filtered.data['results']])

    def test_other_user_cannot_update_note(self):
        """测试其他用户不能更新他人笔记（私密笔记对外表现为 404，不泄露存在性）

        语义核实（有意设计，不是权限疏漏）：
        - RealmNoteViewSet.get_object() 先在可见性 queryset（自己的笔记 + 公开笔记）里查，
          查不到直接 Http404("笔记不存在或无权访问")；self.note 是他人私密笔记，
          因此对外统一表现为 404，避免通过状态码探测他人在意的笔记是否存在；
        - 对**可见但非本人**的笔记（例如他人的公开笔记），对象级权限 IsOwnerOrReadOnly
          仍会拒绝写操作，update() 捕获 PermissionDenied 返回 403（见下方对照断言）。
        """
        self.client.force_authenticate(user=self.other_user)
        url = reverse('note-detail', args=[self.note.id])
        data = {
            'title': '尝试更新',
            'content': '尝试更新内容'
        }

        response = self.client.put(url, data, format='json')

        # 私密笔记：不泄露存在性 → 404（而非 403）
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.note.reload()
        self.assertEqual(self.note.title, '测试笔记')  # 标题未变

        # 对照：他人的公开笔记可见，会走到对象级权限 → 403，说明 403 语义依然存在
        public_url = reverse('note-detail', args=[self.public_note.id])
        response = self.client.put(public_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.public_note.reload()
        self.assertEqual(self.public_note.title, '公开笔记')  # 标题未变

    def test_other_user_can_view_public_note(self):
        """测试其他用户可以查看公开笔记"""
        self.client.force_authenticate(user=self.other_user)
        url = reverse('note-detail', args=[self.public_note.id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], '公开笔记')
