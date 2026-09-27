"""Authentication helpers shared by development-only API integrations."""

from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import get_authorization_header

from users.jwt_auth import CustomJWTAuthentication
from common.middleware.dev_auth_middleware import get_dev_user


_DEV_TOKEN_PREFIXES = ('dev-token', 'simple-auth')


def _development_token(request):
    """Return a development bearer token, or ``None`` for normal JWT flow."""
    header = get_authorization_header(request)
    if not header:
        return None

    try:
        scheme, raw_token = header.split(maxsplit=1)
    except ValueError:
        return None

    if scheme.lower() != b'bearer':
        return None

    token = raw_token.decode('utf-8', errors='ignore')
    if token.startswith(_DEV_TOKEN_PREFIXES):
        return token
    return None


class DevOrJWTAuthentication(CustomJWTAuthentication):
    """Accept the existing dev token only in the explicit development profile."""

    def authenticate(self, request):
        token = _development_token(request)
        if token and getattr(settings, 'DEV_AUTH_ENABLED', False) and settings.DEBUG:
            user = get_dev_user(request)
            if not getattr(user, 'is_authenticated', False):
                raise exceptions.AuthenticationFailed('Invalid development token')
            return user, token

        return super().authenticate(request)
