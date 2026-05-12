from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework import status
from rest_framework.request import Request
from rest_framework.parsers import JSONParser
from rest_framework.test import APIRequestFactory

from groups.views import SharedScreenViewSet


class SharedScreenViewSetContractTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.mongo_user = SimpleNamespace(id='mongo-user-1', username='group-user', is_authenticated=True)
        self.user = SimpleNamespace(
            id='django-user-1',
            username='group-user',
            email='group@example.com',
            is_authenticated=True,
            is_anonymous=False,
        )

    def _build_request(self, payload):
        request = self.factory.post('/api/v1/groups/shared-screens/', payload, format='json')
        request.user = self.user
        request.mongo_user = self.mongo_user
        drf_request = Request(request, parsers=[JSONParser()])
        drf_request.user = self.user
        drf_request.mongo_user = self.mongo_user
        return drf_request

    def test_perform_create_requires_group_id(self):
        request = self._build_request({'title': 'screen'})

        view = SharedScreenViewSet()
        view.request = request
        serializer = mock.Mock()

        with self.assertRaises(ValidationError):
            view.perform_create(serializer)

        serializer.save.assert_not_called()

    @mock.patch('groups.views.Group.objects')
    def test_perform_create_raises_not_found_for_missing_group(self, group_objects):
        request = self._build_request({'title': 'screen', 'group_id': 'missing-group'})

        from groups.views import Group

        group_objects.get.side_effect = Group.DoesNotExist

        view = SharedScreenViewSet()
        view.request = request
        serializer = mock.Mock()

        with self.assertRaises(NotFound):
            view.perform_create(serializer)

        serializer.save.assert_not_called()

    @mock.patch('groups.views.IsGroupMember')
    @mock.patch('groups.views.Group.objects')
    def test_perform_create_rejects_non_member(self, group_objects, is_group_member_class):
        request = self._build_request({'title': 'screen', 'group_id': 'group-1'})

        group = mock.Mock()
        group_objects.get.return_value = group
        is_group_member_class.return_value.has_object_permission.return_value = False

        view = SharedScreenViewSet()
        view.request = request
        serializer = mock.Mock()

        with self.assertRaises(PermissionDenied):
            view.perform_create(serializer)

        serializer.save.assert_not_called()

    @mock.patch('groups.views.IsGroupMember')
    def test_join_rejects_paused_share(self, is_group_member_class):
        request = self.factory.get('/api/v1/groups/shared-screens/share-1/join/')
        request.user = self.user
        request.mongo_user = self.mongo_user

        paused_share = SimpleNamespace(status='paused', group=mock.Mock())
        is_group_member_class.return_value.has_object_permission.return_value = True

        view = SharedScreenViewSet()
        view.request = request
        view.get_object = mock.Mock(return_value=paused_share)

        response = view.join(request, pk='share-1')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], '共享已暂停，请等待共享者恢复后再加入')
