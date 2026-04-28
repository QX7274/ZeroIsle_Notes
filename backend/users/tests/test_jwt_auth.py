import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from datetime import timedelta
import uuid
from django.contrib.auth.hashers import make_password

from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

from users.jwt_auth import CustomJWTAuthentication
from users.mongodb_models import User, TokenBlacklist as BlacklistedToken
from users.services.token_service import TokenBlacklistService
from rest_framework_simplejwt.tokens import AccessToken

# No longer using django_db, will use mock_mongo instead

@pytest.fixture
def test_user_jwt(mock_mongo): # Use the mock_mongo fixture
    """Fixture to create a user for JWT tests in the mocked DB."""
    user = User.objects(username='jwtuser').first()
    if not user:
        user = User(username='jwtuser', email='jwt@test.com')
    user.password = make_password('testpassword')
    user.is_active = True  # Ensure user is active for each test
    user.save()
    return user

@pytest.fixture
def api_request_factory():
    """Fixture for APIRequestFactory."""
    return APIRequestFactory()

@pytest.fixture
def auth_service():
    """Fixture for CustomJWTAuthentication instance."""
    return CustomJWTAuthentication()

class TestCustomJWTAuthentication:

    def test_authenticate_success(self, auth_service, test_user_jwt, api_request_factory):
        """Test successful authentication with a valid token."""
        token = AccessToken.for_user(test_user_jwt)
        request = api_request_factory.get('/some-path/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {str(token)}'

        user, validated_token = auth_service.authenticate(request)

        assert user == test_user_jwt
        assert validated_token['user_id'] == str(test_user_jwt.id)

    def test_authenticate_no_header(self, auth_service, api_request_factory):
        """Test authentication with no Authorization header."""
        request = api_request_factory.get('/some-path/')
        result = auth_service.authenticate(request)
        assert result is None

    def test_authenticate_invalid_token(self, auth_service, api_request_factory):
        """Test authentication with an invalid/malformed token."""
        request = api_request_factory.get('/some-path/')
        request.META['HTTP_AUTHORIZATION'] = 'Bearer invalidtokenstring'

        with pytest.raises(AuthenticationFailed) as excinfo:
            auth_service.authenticate(request)
            assert '令牌无效或已过期' in str(excinfo.value)

    def test_authenticate_blacklisted_token(self, auth_service, test_user_jwt, api_request_factory):
        """Test authentication with a token that has been blacklisted."""
        token = AccessToken.for_user(test_user_jwt)

        TokenBlacklistService.add_to_blacklist(token)

        request = api_request_factory.get('/some-path/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {str(token)}'

        with pytest.raises(AuthenticationFailed) as excinfo:
            auth_service.authenticate(request)
        assert 'Token validation error' in str(excinfo.value)

        # Clean up blacklist for other tests
        BlacklistedToken.objects(jti=token['jti']).delete()


    def test_authenticate_user_not_found(self, auth_service, api_request_factory):
        """Test authentication where the user ID in the token does not exist."""
        non_existent_user_id = uuid.uuid4()
        token = AccessToken()
        token['user_id'] = str(non_existent_user_id)
        token.set_exp(from_time=timezone.now(), lifetime=timedelta(minutes=5))

        request = api_request_factory.get('/some-path/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {str(token)}'

        with pytest.raises(AuthenticationFailed) as excinfo:
            auth_service.authenticate(request)
            assert '未找到该用户' in str(excinfo.value)

    def test_authenticate_inactive_user(self, auth_service, test_user_jwt, api_request_factory):
        """Test authentication with a token for an inactive user."""
        test_user_jwt.is_active = False
        test_user_jwt.save()

        token = AccessToken.for_user(test_user_jwt)
        request = api_request_factory.get('/some-path/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {str(token)}'

        with pytest.raises(AuthenticationFailed) as excinfo:
            auth_service.authenticate(request)
        assert '该用户已禁用' in str(excinfo.value)

        # cleanup
        test_user_jwt.is_active = True
        test_user_jwt.save()

class TestTokenBlacklistService:

    def test_blacklist_and_is_blacklisted(self, test_user_jwt):
        """Test adding a token to the blacklist and checking it."""
        token = AccessToken.for_user(test_user_jwt)
        jti = token['jti']

        assert not TokenBlacklistService.is_blacklisted(token)

        TokenBlacklistService.add_to_blacklist(token)

        assert TokenBlacklistService.is_blacklisted(token)

        BlacklistedToken.objects(jti=jti).delete()
