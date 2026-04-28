import pytest
import os
import mongomock
from django.conf import settings

def pytest_configure():
    # 确保在测试环境中
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.testing')
    
    # 设置内存数据库
    # 确保在测试环境中
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.testing')

@pytest.fixture(scope='function')
def mock_mongo(monkeypatch):
    """Mocks mongoengine.connect to use mongomock."""
    mock_client = mongomock.MongoClient()
    def mock_connect(*args, **kwargs):
        return mock_client

    monkeypatch.setattr("mongoengine.connect", mock_connect)
    # Also patch the client used for native operations if it's separate
    try:
        monkeypatch.setattr("backend.settings.base.MONGO_CLIENT", mock_client)
    except Exception:
        pass

    # Ensure a clean state for each test
    yield mock_client
    
    db_name = getattr(settings, 'MONGO_DB_NAME', 'test_db')
    mock_client.drop_database(db_name)

@pytest.fixture
def test_user(db, mock_mongo):
    """
    创建一个用于测试的用户并返回。
    """
    from users.mongodb_models import User
    user = User.objects(username='testuser').first()
    if not user:
        user = User(
            username='testuser',
            email='testuser@example.com',
            is_active=True,
            is_staff=False
        )
        user.set_password('testpassword')
        user.save()
    return user

@pytest.fixture
def api_client():
    """提供一个未认证的 DRF APIClient 实例。"""
    from rest_framework.test import APIClient
    return APIClient()

@pytest.fixture
def authenticated_client(api_client, test_user):
    """
    提供一个已通过 force_authenticate 认证的 APIClient。
    """
    api_client.force_authenticate(user=test_user)
    return api_client
