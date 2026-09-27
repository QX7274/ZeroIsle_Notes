from common.middleware.dev_auth_middleware import get_dev_user_password


def test_developer_password_is_only_read_from_environment(monkeypatch):
    monkeypatch.delenv('ZEROISLE_DEV_USER_PASSWORD', raising=False)
    assert get_dev_user_password() == ''

    monkeypatch.setenv('ZEROISLE_DEV_USER_PASSWORD', 'test-only-password')
    assert get_dev_user_password() == 'test-only-password'
