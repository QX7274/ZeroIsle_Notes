from types import SimpleNamespace
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APIRequestFactory

from common.authentication import DevOrJWTAuthentication
from users.jwt_auth import CustomJWTAuthentication


def test_development_token_authenticates_sync_requests_when_dev_auth_is_enabled():
    request = APIRequestFactory().get(
        '/api/v1/sync/notes/',
        HTTP_AUTHORIZATION='Bearer dev-token-tablet',
    )
    developer = SimpleNamespace(id='dev-user-001', is_authenticated=True)

    with override_settings(DEBUG=True, DEV_AUTH_ENABLED=True), patch(
        'common.authentication.get_dev_user', return_value=developer,
    ) as get_dev_user:
        result = DevOrJWTAuthentication().authenticate(request)

    assert result == (developer, 'dev-token-tablet')
    get_dev_user.assert_called_once_with(request)


def test_non_development_tokens_keep_the_standard_jwt_authentication_path():
    request = APIRequestFactory().get(
        '/api/v1/sync/notes/',
        HTTP_AUTHORIZATION='Bearer dev-token-tablet',
    )

    with override_settings(DEBUG=True, DEV_AUTH_ENABLED=False), patch.object(
        CustomJWTAuthentication,
        'authenticate',
        return_value=None,
    ) as jwt_authenticate:
        result = DevOrJWTAuthentication().authenticate(request)

    assert result is None
    jwt_authenticate.assert_called_once_with(request)
