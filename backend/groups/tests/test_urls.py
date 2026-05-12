from django.test import SimpleTestCase
from django.urls import resolve

from groups.views import GroupInvitationViewSet, GroupViewSet, SharedScreenViewSet


class GroupUrlContractTests(SimpleTestCase):
    def test_group_router_is_mounted_at_api_v1_groups_root(self):
        match = resolve('/api/v1/groups/')
        self.assertIs(match.func.cls, GroupViewSet)

    def test_join_by_code_uses_hyphenated_path_under_groups_root(self):
        match = resolve('/api/v1/groups/join-by-code/')
        self.assertIs(match.func.cls, GroupViewSet)
        self.assertEqual(match.func.actions['post'], 'join_by_code')

    def test_generate_join_code_uses_hyphenated_path_for_group_detail_action(self):
        match = resolve('/api/v1/groups/demo-group/generate-join-code/')
        self.assertIs(match.func.cls, GroupViewSet)
        self.assertEqual(match.func.actions['post'], 'generate_join_code')

    def test_group_invitations_are_mounted_under_groups_prefix(self):
        match = resolve('/api/v1/groups/invitations/')
        self.assertIs(match.func.cls, GroupInvitationViewSet)

    def test_invite_candidates_route_is_mounted_under_group_detail(self):
        match = resolve('/api/v1/groups/demo-group/invite-candidates/')
        self.assertIs(match.func.cls, GroupViewSet)
        self.assertEqual(match.func.actions['get'], 'invite_candidates')

    def test_shared_screens_are_mounted_under_groups_prefix(self):
        match = resolve('/api/v1/groups/shared-screens/')
        self.assertIs(match.func.cls, SharedScreenViewSet)
