"""管理后台鉴权端到端测试（方案 B）。

锁定的核心缺陷：此前管理后台用 Django ORM 的 authenticate() 登录，
而数据库引擎是 dummy，导致 authenticate() 抛 ImproperlyConfigured，
**管理员永远登录不进来**。

方案 B 改为：管理员 = MongoDB users 集合中 is_staff=True 的用户，
密码用 Django 哈希校验，令牌用 SimpleJWT 签发。
本文件验证这条链路真的能走通。
"""

import pytest
from django.contrib.auth.hashers import make_password
from rest_framework.test import APIClient

from auth_api.authentication import AdminJWTAuthentication, IsAdminStaff, authenticate_admin
from users.models import UserProfile


def _make_user(username='admin1', password='Passw0rd!23', **kwargs):
    """在 users 集合里造一个管理员。

    注意：admin 的 UserProfile 未声明 password 字段（该字段由主后端模型声明），
    因此这里用 update() 直接写入集合，模拟"主后端创建的管理员"。
    """
    user = UserProfile(username=username, email=f'{username}@example.com', **kwargs)
    if 'is_staff' not in kwargs:
        user.is_staff = True
    user.save()
    UserProfile.objects(id=user.id).update(password=make_password(password))
    # 重新取回，确保 password 字段被加载
    return UserProfile.objects(id=user.id).first()


# ---------- authenticate_admin ----------

def test_staff_user_with_correct_password_authenticates():
    user = _make_user('admin_ok')
    result = authenticate_admin('admin_ok', 'Passw0rd!23')
    assert result is not None
    assert result.username == 'admin_ok'


def test_wrong_password_is_rejected():
    _make_user('admin_wrongpw')
    assert authenticate_admin('admin_wrongpw', 'not-the-password') is None


def test_non_staff_user_is_rejected():
    """合法用户但不是 staff：不能进管理后台。"""
    _make_user('normal_user', is_staff=False)
    assert authenticate_admin('normal_user', 'Passw0rd!23') is None


def test_unknown_user_is_rejected():
    assert authenticate_admin('nobody', 'whatever') is None


def test_inactive_user_is_rejected():
    _make_user('admin_inactive', is_active=False)
    assert authenticate_admin('admin_inactive', 'Passw0rd!23') is None


def test_banned_user_is_rejected():
    _make_user('admin_banned', status='banned')
    assert authenticate_admin('admin_banned', 'Passw0rd!23') is None


def test_user_without_password_hash_is_rejected():
    """没有密码哈希的用户不能登录（且不应抛异常，避免账号枚举）。"""
    user = UserProfile(username='no_password', email='np@example.com')
    user.is_staff = True
    user.save()
    assert authenticate_admin('no_password', 'anything') is None


# ---------- 权限类 ----------

class _Req:
    def __init__(self, user):
        self.user = user


def test_is_admin_staff_allows_staff():
    user = _make_user('staff_perm')
    assert IsAdminStaff().has_permission(_Req(user), None) is True


def test_is_admin_staff_rejects_non_staff():
    user = _make_user('nonstaff_perm', is_staff=False)
    assert IsAdminStaff().has_permission(_Req(user), None) is False


def test_is_admin_staff_rejects_anonymous():
    class _Anon:
        is_authenticated = False
        is_staff = False

    assert IsAdminStaff().has_permission(_Req(_Anon()), None) is False


def test_userprofile_is_authenticated_property_exists():
    """DRF 的 IsAuthenticated 依赖该属性；缺失会导致所有接口 401。"""
    user = _make_user('auth_prop')
    assert user.is_authenticated is True
    assert user.is_anonymous is False


# ---------- HTTP 端到端 ----------

def test_login_endpoint_returns_tokens_for_staff():
    """关键回归：登录接口必须真的签发令牌（旧实现在此处抛 ImproperlyConfigured）。

    注意：这里**不能**用 @pytest.mark.django_db —— 管理后台的数据库引擎是
    dummy（本项目只用 MongoDB），该标记会去要一个不存在的 SQL 库并直接报错。
    被测代码路径也不碰 ORM，因此无需事务支持。
    """
    _make_user('http_admin')
    client = APIClient()
    resp = client.post(
        '/api/auth/login/',
        {'username': 'http_admin', 'password': 'Passw0rd!23'},
        format='json',
    )
    assert resp.status_code == 200, resp.data
    assert resp.data['status'] == 'success'
    assert 'access' in resp.data['data']
    assert 'refresh' in resp.data['data']


def test_login_endpoint_rejects_wrong_password():
    _make_user('http_admin2')
    client = APIClient()
    resp = client.post(
        '/api/auth/login/',
        {'username': 'http_admin2', 'password': 'bad'},
        format='json',
    )
    assert resp.status_code == 401


def test_check_endpoint_requires_token():
    """无令牌访问受保护接口必须被拒（方案 B 的完整链路回归）。"""
    client = APIClient()
    resp = client.get('/api/auth/check/')
    # DRF 在完全无凭据时可能返回 401 或 403，两者都属"拒绝"，故接受其一
    assert resp.status_code in (401, 403)


def test_login_then_access_with_token():
    """端到端：登录拿到令牌 -> 用令牌访问受保护接口成功。

    这是方案 B 的核心价值验证 —— 旧实现下 authenticate() 直接抛
    ImproperlyConfigured，这条链路根本走不通。
    """
    _make_user('e2e_token_admin')
    client = APIClient()
    login = client.post(
        '/api/auth/login/',
        {'username': 'e2e_token_admin', 'password': 'Passw0rd!23'},
        format='json',
    )
    assert login.status_code == 200, login.data
    access = login.data['data']['access']

    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    check = client.get('/api/auth/check/')
    assert check.status_code == 200, check.data
    assert check.data['data']['isAuthenticated'] is True
    assert check.data['data']['user']['username'] == 'e2e_token_admin'


def test_non_staff_cannot_access_protected_endpoint():
    """非 staff 用户即使拿到有效令牌，也不能访问管理接口。"""
    user = _make_user('normal_token_user', is_staff=False)
    from rest_framework_simplejwt.tokens import RefreshToken

    access = str(RefreshToken.for_user(user).access_token)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    resp = client.get('/api/auth/check/')
    assert resp.status_code in (401, 403)


def test_issue_and_verify_token_roundtrip():
    """令牌签发后，AdminJWTAuthentication 必须能解析回同一个用户。"""
    from rest_framework_simplejwt.tokens import RefreshToken

    user = _make_user('token_admin')
    token = RefreshToken.for_user(user)
    access = str(token.access_token)

    class _Header:
        def __init__(self, raw):
            self.raw = raw

    class _Request:
        def __init__(self, raw):
            self.META = {'HTTP_AUTHORIZATION': f'Bearer {raw}'}

    auth = AdminJWTAuthentication()
    result = auth.authenticate(_Request(access))
    assert result is not None
    resolved, _validated = result
    assert resolved.username == 'token_admin'
