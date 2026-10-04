"""ADMIN_ALLOWLIST_IPS 中间件测试。

锁定的缺陷：.env.example 里声明了 ADMIN_ALLOWLIST_IPS，
但全仓库无任何代码读取它 —— 是死配置。本中间件让它真正生效。
"""

import pytest
from django.test import RequestFactory

from common.middleware.admin_ip_allowlist import (
    AdminIPAllowlistMiddleware,
    _client_ip,
    _parse_allowlist,
)


def _mw(monkeypatch, value=None, trusted=None):
    """按给定环境变量构造中间件。"""
    if value is None:
        monkeypatch.delenv('ADMIN_ALLOWLIST_IPS', raising=False)
    else:
        monkeypatch.setenv('ADMIN_ALLOWLIST_IPS', value)
    if trusted is not None:
        monkeypatch.setenv('ADMIN_TRUSTED_PROXY_COUNT', str(trusted))
    else:
        monkeypatch.delenv('ADMIN_TRUSTED_PROXY_COUNT', raising=False)

    called = {'n': 0}

    def get_response(request):
        called['n'] += 1
        from django.http import JsonResponse

        return JsonResponse({'ok': True})

    return AdminIPAllowlistMiddleware(get_response), called


# ---------- 解析 ----------

def test_parse_single_ip():
    nets = _parse_allowlist('127.0.0.1')
    assert len(nets) == 1
    assert str(nets[0]) == '127.0.0.1/32'


def test_parse_cidr():
    nets = _parse_allowlist('10.0.0.0/8')
    assert str(nets[0]) == '10.0.0.0/8'


def test_parse_wildcard_last_octet():
    nets = _parse_allowlist('192.168.1.*')
    assert any(str(n) == '192.168.1.0/24' for n in nets)


def test_parse_multiple_and_ignores_bad_entry():
    """一个写错的条目不应让整条白名单失效。"""
    nets = _parse_allowlist('127.0.0.1, not-an-ip ,10.0.0.0/8')
    assert len(nets) == 2


# ---------- 未配置：不拦截 ----------

def test_unconfigured_allows_all(monkeypatch):
    mw, called = _mw(monkeypatch, value=None)
    assert mw.enabled is False
    req = RequestFactory().get('/api/users/profiles/', REMOTE_ADDR='203.0.113.9')
    resp = mw(req)
    assert resp.status_code == 200
    assert called['n'] == 1


# ---------- 已配置：拦截 ----------

def test_allowed_ip_passes(monkeypatch):
    mw, called = _mw(monkeypatch, value='127.0.0.1')
    req = RequestFactory().get('/api/users/profiles/', REMOTE_ADDR='127.0.0.1')
    assert mw(req).status_code == 200
    assert called['n'] == 1


def test_disallowed_ip_is_denied_403(monkeypatch):
    mw, called = _mw(monkeypatch, value='127.0.0.1')
    req = RequestFactory().get('/api/users/profiles/', REMOTE_ADDR='203.0.113.9')
    resp = mw(req)
    assert resp.status_code == 403
    assert called['n'] == 0, '被拒请求不应进入后续处理'


def test_cidr_range_allows_member(monkeypatch):
    mw, _ = _mw(monkeypatch, value='10.0.0.0/8')
    req = RequestFactory().get('/api/x/', REMOTE_ADDR='10.1.2.3')
    assert mw(req).status_code == 200


def test_cidr_range_rejects_non_member(monkeypatch):
    mw, _ = _mw(monkeypatch, value='10.0.0.0/8')
    req = RequestFactory().get('/api/x/', REMOTE_ADDR='11.1.2.3')
    assert mw(req).status_code == 403


def test_health_check_is_exempt(monkeypatch):
    """探针不应被白名单挡住，否则会被误判为宕机。"""
    mw, called = _mw(monkeypatch, value='127.0.0.1')
    req = RequestFactory().get('/health/', REMOTE_ADDR='203.0.113.9')
    assert mw(req).status_code == 200
    assert called['n'] == 1


def test_unparseable_ip_is_denied(monkeypatch):
    mw, called = _mw(monkeypatch, value='127.0.0.1')
    req = RequestFactory().get('/api/x/', REMOTE_ADDR='garbage')
    assert mw(req).status_code == 403
    assert called['n'] == 0


# ---------- 代理头 ----------

def test_xff_first_hop_used(monkeypatch):
    """X-Forwarded-For 只有一个地址时，它就是客户端。"""
    mw, _ = _mw(monkeypatch, value='203.0.113.5')
    req = RequestFactory().get(
        '/api/x/', REMOTE_ADDR='10.0.0.1', HTTP_X_FORWARDED_FOR='203.0.113.5'
    )
    assert mw(req).status_code == 200


def test_spoofed_xff_leftmost_is_not_trusted(monkeypatch):
    """核心安全用例：攻击者在 XFF 左侧伪造白名单 IP，不应被放行。

    配置 trusted_proxy_count=1 时，真实客户端取 XFF 右侧第 1 段（即最后一个），
    因此左侧伪造的 "127.0.0.1" 不生效，右侧的真实地址 203.0.113.9 会被拒。
    """
    mw, called = _mw(monkeypatch, value='127.0.0.1', trusted=1)
    req = RequestFactory().get(
        '/api/x/',
        REMOTE_ADDR='10.0.0.1',
        HTTP_X_FORWARDED_FOR='127.0.0.1, 203.0.113.9',
    )
    resp = mw(req)
    assert resp.status_code == 403, '左侧伪造的 XFF 不应被信任'
    assert called['n'] == 0


def test_x_real_ip_fallback(monkeypatch):
    mw, _ = _mw(monkeypatch, value='198.51.100.7')
    req = RequestFactory().get('/api/x/', REMOTE_ADDR='10.0.0.1', HTTP_X_REAL_IP='198.51.100.7')
    assert mw(req).status_code == 200


def test_client_ip_prefers_xff(monkeypatch):
    req = RequestFactory().get(
        '/api/x/', REMOTE_ADDR='10.0.0.1', HTTP_X_FORWARDED_FOR='203.0.113.5'
    )
    assert _client_ip(req, 1) == '203.0.113.5'


# ---------- 配置可达性 ----------

def test_middleware_is_registered_in_settings():
    """中间件必须真的挂在 MIDDLEWARE 里，否则白名单仍然不生效。"""
    from django.conf import settings

    assert 'common.middleware.admin_ip_allowlist.AdminIPAllowlistMiddleware' in settings.MIDDLEWARE


def test_cors_not_wide_open_by_default():
    """默认不应对所有来源放开 CORS。

    注意：这里不能用 importlib.reload(settings) 来测“默认值” ——
    settings 在导入时就会调用 mongoengine.connect，重载会因
    “a different connection with alias default was already registered”
    而失败（与 CORS 无关）。因此直接断言已加载的 settings 实例：
    本测试进程未设置 ADMIN_CORS_ALLOW_ALL，故应处于收紧状态。
    """
    from django.conf import settings

    assert getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False) is False, (
        "默认不应放开所有来源；如需开发期放开须显式设 ADMIN_CORS_ALLOW_ALL=1"
    )
    assert getattr(settings, 'CORS_ALLOWED_ORIGINS', None), '应给出显式允许来源'


def test_cors_allow_all_requires_explicit_env():
    """放开所有来源必须由环境变量显式开启（源码级守护）。"""
    import inspect

    import admin_backend.settings as s

    src = inspect.getsource(s)
    assert 'ADMIN_CORS_ALLOW_ALL' in src, '放开 CORS 应由显式开关控制'
    # 不应存在“无条件置 True”的写法
    assert 'CORS_ALLOW_ALL_ORIGINS = True  # 开发环境下允许所有来源' not in src
