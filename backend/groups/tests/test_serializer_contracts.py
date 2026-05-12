from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase

from groups.serializers import GroupDetailSerializer


class GroupDetailSerializerMongoContractTests(SimpleTestCase):
    def setUp(self):
        self.mongo_user = SimpleNamespace(id='mongo-user-1', is_authenticated=True)
        self.request_user = SimpleNamespace(
            id='django-user-1',
            username='django-user',
            email='django@example.com',
            is_authenticated=True,
            is_anonymous=False,
        )
        self.request = SimpleNamespace(user=self.request_user, mongo_user=self.mongo_user)

    @mock.patch('groups.serializers.GroupMember.objects')
    def test_join_code_uses_request_mongo_user_for_admin_check(self, group_member_objects):
        group = SimpleNamespace(
            creator=SimpleNamespace(id='creator-2'),
            join_code='1234',
            join_code_expires_at='2026-05-12T12:00:00',
            is_join_code_valid=lambda: True,
        )
        group_member_objects.filter.return_value.first.return_value = True

        serializer = GroupDetailSerializer(group, context={'request': self.request})

        self.assertEqual(serializer.get_join_code(group), '1234')
        self.assertTrue(serializer.get_can_invite(group))
        self.assertTrue(serializer.get_can_generate_join_code(group))
        group_member_objects.filter.assert_called_with(
            group=group,
            user=self.mongo_user,
            role='admin',
            is_active=True,
        )

    def test_join_code_is_visible_when_request_mongo_user_is_creator(self):
        group = SimpleNamespace(
            creator=SimpleNamespace(id='mongo-user-1'),
            join_code='5678',
            join_code_expires_at='2026-05-12T13:00:00',
            is_join_code_valid=lambda: True,
        )

        serializer = GroupDetailSerializer(group, context={'request': self.request})

        self.assertEqual(serializer.get_join_code(group), '5678')
        self.assertEqual(serializer.get_join_code_expires_at(group), '2026-05-12T13:00:00')
        self.assertTrue(serializer.get_can_invite(group))
        self.assertTrue(serializer.get_can_generate_join_code(group))

    @mock.patch('groups.serializers.GroupMember.objects')
    def test_management_capabilities_are_hidden_for_non_admin_member(self, group_member_objects):
        group = SimpleNamespace(
            creator=SimpleNamespace(id='creator-1'),
            join_code='9999',
            join_code_expires_at='2026-05-12T14:00:00',
            is_join_code_valid=lambda: True,
        )
        group_member_objects.filter.return_value.first.return_value = None

        serializer = GroupDetailSerializer(group, context={'request': self.request})

        self.assertFalse(serializer.get_can_invite(group))
        self.assertFalse(serializer.get_can_generate_join_code(group))
        self.assertIsNone(serializer.get_join_code(group))
