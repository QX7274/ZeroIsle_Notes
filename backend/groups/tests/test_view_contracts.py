from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.parsers import JSONParser
from rest_framework.test import APIRequestFactory

from groups.views import SharedScreenViewSet


class SharedScreenViewSetContractTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(id='mongo-user-1', username='group-user', is_authenticated=True)

    def _build_request(self, payload):
        request = self.factory.post('/api/v1/groups/shared-screens/', payload, format='json')
        request.user = self.user
        drf_request = Request(request, parsers=[JSONParser()])
        drf_request.user = self.user
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
