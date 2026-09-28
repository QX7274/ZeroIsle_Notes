"""realm_tag / realm_category 的 MongoUser 解析回归（WS-Y，生产缺陷）。

背景：这两个视图集曾把 Django auth 的 request.user 直接传给 mongoengine ReferenceField，
创建必 500（InvalidDocument: cannot encode <users.models.user.User>），查询也拿不到正确结果。
本文件锁定三件事：
1. 创建 tag/category 时落库归属的是镜像出的 MongoUser（不再是 Django user）；
2. 列表/详情按用户隔离：A 用户看不到 B 用户的 tag/category；
3. 解析逻辑收敛到 common.mongo_user.get_mongo_user，被 realm_note / realm_tag / realm_category 三处复用。

注意：本文件刻意避开「反序列化 tag.user / category.user 属性」，那条路径受 RISK-BE-003
（UUIDField(binary=False) 主键与 DBRef 口径不一致）影响，属另一个任务，不在本文件断言范围内。
"""

import inspect

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from common import mongo_user as mongo_user_module
from notes.mongodb_models import Category, Tag
from notes.views import realm_category, realm_note, realm_tag

from .helpers import mongo_user_for, reset_mongo_test_data

User = get_user_model()

NOTES_API = '/api/v1/notes/'


class RealmTagCategoryMongoUserTests(TestCase):
    def setUp(self):
        reset_mongo_test_data()
        # email 在 users.User 上是唯一的，必须给不同的值
        self.user_a = User.objects.create_user(
            username='user-a', email='user-a@example.com', password='p'
        )
        self.user_b = User.objects.create_user(
            username='user-b', email='user-b@example.com', password='p'
        )
        self.mongo_a = mongo_user_for(self.user_a)
        self.mongo_b = mongo_user_for(self.user_b)

    def _client_for(self, django_user):
        client = APIClient()
        client.force_authenticate(user=django_user)
        return client

    def test_create_tag_owner_is_mongo_user(self):
        response = self._client_for(self.user_a).post(
            NOTES_API + 'tags/', {'name': '标签A', 'color': '#00FF00'}, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tag = Tag.objects.get(name='标签A')
        # 归属必须是 MongoUser（而不是 Django user），否则会再次出现 InvalidDocument
        self.assertEqual(Tag.objects.filter(id=tag.id, user=self.mongo_a).count(), 1)
        self.assertEqual(Tag.objects.filter(id=tag.id, user=self.mongo_b).count(), 0)
        # 引用指向 users 集合里的 MongoUser
        self.assertEqual(str(tag._data['user'].id), str(self.mongo_a.id))

    def test_create_category_owner_is_mongo_user(self):
        response = self._client_for(self.user_a).post(
            NOTES_API + 'categories/', {'name': '分类A', 'color': '#00FF00'}, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        category = Category.objects.get(name='分类A')
        self.assertEqual(Category.objects.filter(id=category.id, user=self.mongo_a).count(), 1)
        self.assertEqual(str(category._data['user'].id), str(self.mongo_a.id))

    def test_tag_and_category_are_isolated_per_user(self):
        client_a = self._client_for(self.user_a)
        self.assertEqual(
            client_a.post(NOTES_API + 'tags/', {'name': 'A标签'}, format='json').status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            client_a.post(NOTES_API + 'categories/', {'name': 'A分类'}, format='json').status_code,
            status.HTTP_201_CREATED,
        )

        client_b = self._client_for(self.user_b)
        # B 的列表里不能出现 A 的数据（空列表不触发序列化，避开 RISK-BE-003）
        self.assertEqual(list(client_b.get(NOTES_API + 'tags/').data), [])
        self.assertEqual(list(client_b.get(NOTES_API + 'categories/').data), [])

        tag_a = Tag.objects.get(name='A标签')
        category_a = Category.objects.get(name='A分类')
        self.assertEqual(client_b.get(NOTES_API + 'tags/%s/' % tag_a.id).status_code, 404)
        self.assertEqual(client_b.get(NOTES_API + 'categories/%s/' % category_a.id).status_code, 404)

        # A 自己按 ORM 仍能查到自己的数据（隔离不是把数据写丢）
        self.assertEqual(Tag.objects.filter(user=self.mongo_a).count(), 1)
        self.assertEqual(Category.objects.filter(user=self.mongo_a).count(), 1)

    def test_mongo_user_helper_is_shared_by_three_viewsets(self):
        self.assertIs(realm_note.get_mongo_user, mongo_user_module.get_mongo_user)
        self.assertIs(realm_tag.get_mongo_user, mongo_user_module.get_mongo_user)
        self.assertIs(realm_category.get_mongo_user, mongo_user_module.get_mongo_user)

        # realm_note 的实例方法委托给同一实现，行为保持不变（优先 request.mongo_user）
        viewset = realm_note.RealmNoteViewSet()
        request = type('StubRequest', (), {'user': self.user_a, 'mongo_user': self.mongo_a})()
        self.assertEqual(viewset._get_mongo_user(request), self.mongo_a)

        # 没有 mongo_user 注入时按 username 解析到同一个记录
        request_without_injection = type('StubRequest', (), {'user': self.user_a})()
        self.assertEqual(viewset._get_mongo_user(request_without_injection).id, self.mongo_a.id)

    def test_tag_and_category_views_never_pass_request_user_to_mongoengine(self):
        for module in (realm_tag, realm_category):
            source = inspect.getsource(module)
            self.assertNotIn(
                'request.user',
                source,
                '%s 不应再把 Django request.user 传给 mongoengine' % module.__name__,
            )
