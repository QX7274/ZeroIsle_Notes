from types import SimpleNamespace
from unittest import mock

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from notification.views import NotificationViewSet


class NotificationViewSetMongoUserTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(
            id='django-user-1',
            username='notify-test',
            is_authenticated=True,
        )
        self.mongo_user = SimpleNamespace(id='mongo-user-1')

    def _build_view(self):
        view = NotificationViewSet()
        view.notification_service = mock.Mock()
        view.notification_service.mark_all_as_read.return_value = 3
        view.notification_service.get_unread_count.return_value = 5
        return view

    def test_mark_all_as_read_uses_request_mongo_user(self):
        request = self.factory.post('/api/v1/notifications/mark_all_as_read/')
        request.user = self.user
        request.mongo_user = self.mongo_user

        view = self._build_view()
        response = view.mark_all_as_read(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 3)
        view.notification_service.mark_all_as_read.assert_called_once_with(self.mongo_user)

    def test_unread_count_requires_mongo_user_mapping(self):
        request = self.factory.get('/api/v1/notifications/unread_count/')
        request.user = self.user
        request.mongo_user = None

        view = self._build_view()
        response = view.unread_count(request)

        self.assertEqual(response.status_code, 400)
        view.notification_service.get_unread_count.assert_not_called()
