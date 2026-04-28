import unittest
from unittest.mock import patch

from django.conf import settings
import django

if not settings.configured:
    settings.configure(
        SECRET_KEY='test-key',
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'rest_framework',
        ],
        REST_FRAMEWORK={},
        USE_TZ=True,
    )
    django.setup()

from sync.views import _parse_limit_param, SyncNotesView, SyncDataView


class DummyUser:
    def __init__(self, user_id='u-1'):
        self.id = user_id


class DummyRequest:
    def __init__(self, query_params=None, user=None):
        self.query_params = query_params or {}
        self.user = user or DummyUser()


class SyncViewsLimitParamTests(unittest.TestCase):
    """Sync 视图层 limit 参数校验测试。"""

    def test_parse_limit_default_value(self):
        limit, error = _parse_limit_param({})
        self.assertEqual(limit, 100)
        self.assertIsNone(error)

    def test_parse_limit_valid_integer_string(self):
        limit, error = _parse_limit_param({'limit': '200'})
        self.assertEqual(limit, 200)
        self.assertIsNone(error)

    def test_parse_limit_invalid_non_integer(self):
        limit, error = _parse_limit_param({'limit': 'abc'})
        self.assertIsNone(limit)
        self.assertEqual(error, 'limit 必须是整数')

    def test_parse_limit_out_of_range_low(self):
        limit, error = _parse_limit_param({'limit': '0'})
        self.assertIsNone(limit)
        self.assertEqual(error, 'limit 必须在 1 到 500 之间')

    def test_parse_limit_out_of_range_high(self):
        limit, error = _parse_limit_param({'limit': '501'})
        self.assertIsNone(limit)
        self.assertEqual(error, 'limit 必须在 1 到 500 之间')

    def test_sync_notes_get_invalid_limit_returns_error_and_errors(self):
        request = DummyRequest(query_params={'limit': 'abc'})

        response = SyncNotesView().get(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)
        self.assertIn('errors', response.data)
        self.assertEqual(response.data['error']['code'], 'SYNC_400_INVALID_LIMIT')
        self.assertEqual(len(response.data['errors']), 1)
        self.assertEqual(response.data['errors'][0]['code'], 'SYNC_400_INVALID_LIMIT')

    @patch('sync.views.SyncService.pull_notes', side_effect=Exception('boom'))
    def test_sync_notes_get_exception_returns_error_and_errors(self, _mock_pull_notes):
        request = DummyRequest(query_params={'limit': '100'})

        response = SyncNotesView().get(request)

        self.assertEqual(response.status_code, 500)
        self.assertIn('error', response.data)
        self.assertIn('errors', response.data)
        self.assertEqual(response.data['error']['code'], 'SYNC_500_INTERNAL_SERVER_ERROR')
        self.assertEqual(len(response.data['errors']), 1)
        self.assertEqual(response.data['errors'][0]['code'], 'SYNC_500_INTERNAL_SERVER_ERROR')


    @patch('sync.views.SyncService.pull_notes', side_effect=Exception('boom'))
    def test_sync_data_get_exception_returns_error_and_errors(self, _mock_pull_notes):
        request = DummyRequest(query_params={'limit': '100'})

        response = SyncDataView().get(request)

        self.assertEqual(response.status_code, 500)
        self.assertIn('error', response.data)
        self.assertIn('errors', response.data)
        self.assertEqual(response.data['error']['code'], 'SYNC_500_INTERNAL_SERVER_ERROR')
        self.assertEqual(len(response.data['errors']), 1)
        self.assertEqual(response.data['errors'][0]['code'], 'SYNC_500_INTERNAL_SERVER_ERROR')


if __name__ == '__main__':
    unittest.main()

