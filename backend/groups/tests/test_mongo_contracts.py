from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase

from groups.views import (
    GroupInvitationViewSet,
    GroupViewSet,
    IsGroupCreatorOrAdmin,
    IsGroupMember,
    SharedScreenViewSet,
)


class GroupsMongoContractTests(SimpleTestCase):
    def setUp(self):
        self.mongo_user = SimpleNamespace(
            id='mongo-user-1',
            username='mongo-user',
            is_authenticated=True,
        )
        self.request_user = SimpleNamespace(
            id='django-user-1',
            username='django-user',
            email='django@example.com',
            is_authenticated=True,
            is_anonymous=False,
        )
        self.request = SimpleNamespace(
            user=self.request_user,
            mongo_user=self.mongo_user,
            data={},
            query_params={},
        )

    @mock.patch('groups.views.GroupMember.objects')
    @mock.patch('groups.views.Group.objects')
    def test_group_queryset_uses_group_member_mapping_instead_of_reverse_members_lookup(
        self,
        group_objects,
        group_member_objects,
    ):
        member_group = SimpleNamespace(id='group-2')
        group_member_objects.filter.return_value = [
            SimpleNamespace(group=member_group),
            SimpleNamespace(group=member_group),
        ]

        filtered_queryset = mock.Mock()
        filtered_queryset.distinct.return_value = 'group-queryset'
        group_objects.filter.return_value = filtered_queryset

        view = GroupViewSet()
        view.request = self.request

        result = view.get_queryset()

        self.assertEqual(result, 'group-queryset')
        group_member_objects.filter.assert_called_once_with(user=self.mongo_user, is_active=True)
        group_objects.filter.assert_called_once()
        query = group_objects.filter.call_args.args[0]
        self.assertIn('mongo-user-1', str(query))
        self.assertEqual(group_objects.filter.call_args.kwargs['is_active'], True)

    @mock.patch('groups.views.GroupMember.objects')
    @mock.patch('groups.views.SharedScreen.objects')
    @mock.patch('groups.views.Group.objects')
    def test_shared_screen_queryset_uses_visible_group_list(
        self,
        group_objects,
        shared_screen_objects,
        group_member_objects,
    ):
        member_group = SimpleNamespace(id='group-2')
        visible_group = SimpleNamespace(id='group-2')
        group_member_objects.filter.return_value = [SimpleNamespace(group=member_group)]
        group_queryset = mock.Mock()
        group_queryset.distinct.return_value = [visible_group]
        group_objects.filter.return_value = group_queryset

        shared_screen_queryset = mock.Mock()
        shared_screen_queryset.distinct.return_value = 'shared-screen-queryset'
        shared_screen_objects.filter.return_value = shared_screen_queryset

        view = SharedScreenViewSet()
        view.request = self.request

        result = view.get_queryset()

        self.assertEqual(result, 'shared-screen-queryset')
        shared_screen_objects.filter.assert_called_once()
        query = shared_screen_objects.filter.call_args.args[0]
        self.assertIn('mongo-user-1', str(query))
        self.assertIn('group-2', str(query))

    @mock.patch('groups.views.GroupMember.objects')
    def test_group_member_permission_uses_request_mongo_user(self, group_member_objects):
        permission = IsGroupMember()
        group = SimpleNamespace(group=SimpleNamespace(creator=SimpleNamespace(id='another-user')))
        membership_queryset = mock.Mock()
        membership_queryset.exists.return_value = True
        group_member_objects.filter.return_value = membership_queryset

        allowed = permission.has_object_permission(self.request, None, group)

        self.assertTrue(allowed)
        group_member_objects.filter.assert_called_once_with(
            group=group.group,
            user=self.mongo_user,
            is_active=True,
        )

    @mock.patch('groups.views.GroupMember.objects')
    def test_group_admin_permission_uses_request_mongo_user(self, group_member_objects):
        permission = IsGroupCreatorOrAdmin()
        group = SimpleNamespace(group=SimpleNamespace(creator=SimpleNamespace(id='another-user')))
        membership_queryset = mock.Mock()
        membership_queryset.exists.return_value = True
        group_member_objects.filter.return_value = membership_queryset

        allowed = permission.has_object_permission(self.request, None, group)

        self.assertTrue(allowed)
        group_member_objects.filter.assert_called_once_with(
            group=group.group,
            user=self.mongo_user,
            role='admin',
            is_active=True,
        )

    def test_group_perform_create_uses_request_mongo_user(self):
        serializer = mock.Mock()
        view = GroupViewSet()
        view.request = self.request

        view.perform_create(serializer)

        serializer.save.assert_called_once_with(creator=self.mongo_user)

    @mock.patch('groups.views.GroupInvitation.objects')
    def test_group_invitation_queryset_uses_request_mongo_user(self, invitation_objects):
        invitation_objects.filter.return_value = 'invitation-queryset'

        view = GroupInvitationViewSet()
        view.request = self.request

        result = view.get_queryset()

        self.assertEqual(result, 'invitation-queryset')
        invitation_objects.filter.assert_called_once()
        self.assertIs(invitation_objects.filter.call_args.kwargs['invitee'], self.mongo_user)
