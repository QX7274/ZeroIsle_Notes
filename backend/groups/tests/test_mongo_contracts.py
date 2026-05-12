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
        group_objects.filter.return_value = filtered_queryset

        view = GroupViewSet()
        view.request = self.request

        result = view.get_queryset()

        self.assertIs(result, filtered_queryset)
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
        group_queryset = [visible_group]
        group_objects.filter.return_value = group_queryset

        shared_screen_queryset = mock.Mock()
        shared_screen_queryset.distinct.return_value = 'shared-screen-queryset'
        shared_screen_objects.filter.return_value = shared_screen_queryset

        view = SharedScreenViewSet()
        view.request = self.request

        result = view.get_queryset()

        self.assertIs(result, shared_screen_queryset)
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
        serializer.save.return_value = SimpleNamespace(id='group-1')
        view = GroupViewSet()
        view.request = self.request

        with mock.patch('groups.views.GroupMember.objects') as group_member_objects:
            view.perform_create(serializer)

        serializer.save.assert_called_once_with(creator=self.mongo_user)
        group_member_objects.create.assert_called_once_with(
            group=serializer.save.return_value,
            user=self.mongo_user,
            role='admin',
        )

    @mock.patch('groups.views.GroupInvitation.objects')
    def test_group_invitation_queryset_uses_request_mongo_user(self, invitation_objects):
        invitation_objects.filter.return_value = 'invitation-queryset'

        view = GroupInvitationViewSet()
        view.request = self.request

        result = view.get_queryset()

        self.assertEqual(result, 'invitation-queryset')
        invitation_objects.filter.assert_called_once()
        self.assertIs(invitation_objects.filter.call_args.kwargs['invitee'], self.mongo_user)

    @mock.patch('groups.views.GroupInviteCandidateSerializer')
    @mock.patch('groups.views.GroupInvitation.objects')
    @mock.patch('groups.views.GroupMember.objects')
    @mock.patch('groups.views.IsGroupCreatorOrAdmin')
    @mock.patch('users.mongodb_models.User.objects')
    def test_invite_candidates_uses_group_scoped_search_and_filters_membership_state(
        self,
        user_objects,
        permission_class,
        group_member_objects,
        invitation_objects,
        candidate_serializer,
    ):
        group = SimpleNamespace(id='group-1')
        self.request.query_params = {'keyword': 'al'}
        permission_class.return_value.has_object_permission.return_value = True
        group_member_objects.filter.return_value = [
            SimpleNamespace(user=SimpleNamespace(id='member-1'))
        ]
        invitation_objects.filter.return_value = [
            SimpleNamespace(invitee=SimpleNamespace(id='pending-1'))
        ]
        user_queryset = mock.Mock()
        user_queryset.filter.return_value = ['candidate-a', 'candidate-b']
        user_objects.return_value = user_queryset
        candidate_serializer.return_value.data = [{'id': 'candidate-a'}]

        view = GroupViewSet()
        view.request = self.request
        view.get_object = mock.Mock(return_value=group)

        response = view.invite_candidates(self.request, pk='group-1')

        self.assertEqual(response.status_code, 200)
        user_objects.assert_called_once()
        user_queryset.filter.assert_called_once_with(is_active=True)
        candidate_serializer.assert_called_once_with(
            ['candidate-a', 'candidate-b'],
            many=True,
            context={
                'request_mongo_user_id': 'mongo-user-1',
                'member_user_ids': {'member-1'},
                'pending_invitee_ids': {'pending-1'},
            }
        )

    @mock.patch('groups.views.IsGroupCreatorOrAdmin')
    def test_invite_candidates_rejects_non_admin_member(self, permission_class):
        self.request.query_params = {'keyword': 'al'}
        permission_class.return_value.has_object_permission.return_value = False

        view = GroupViewSet()
        view.request = self.request
        view.get_object = mock.Mock(return_value=SimpleNamespace(id='group-1'))

        response = view.invite_candidates(self.request, pk='group-1')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['detail'], '您没有权限邀请用户')

    def test_invite_candidates_requires_keyword_with_minimum_length(self):
        self.request.query_params = {'keyword': 'a'}

        view = GroupViewSet()
        view.request = self.request
        view.get_object = mock.Mock(return_value=SimpleNamespace(id='group-1'))

        with mock.patch('groups.views.IsGroupCreatorOrAdmin') as permission_class:
            permission_class.return_value.has_object_permission.return_value = True
            response = view.invite_candidates(self.request, pk='group-1')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], '搜索关键词至少需要 2 个字符')
