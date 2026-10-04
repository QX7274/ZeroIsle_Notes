"""管理后台 IP 白名单中间件。

背景
----
\`.env.example\` 里早就声明了 \`ADMIN_ALLOWLIST_IPS=127.0.0.1\`，
但**全仓库没有任何代码读取它** —— 它是一个从未生效的死配置。
本中间件让它真正起作用。

行为
----
1. 读取环境变量 \`ADMIN_ALLOWLIST_IPS\`（逗号分隔的 IP/CIDR，支持 \`*\` 通配）。
2. **未配置时不拦截**，但会打 WARNING —— 见下方"为什么不 fail-closed"。
3. 已配置时，来源 IP 不在白名单内一律返回 403，且**不泄露**任何内部信息。
4. 健康检查路径（\`/health/\` 等）默认放行，避免探针被白名单挡住导致误判宕机。

为什么不 fail-closed
-------------------
本项目当前的部署形态里，管理后台与主后端可能在同一台机器上通过反向代理
访问（\`X-Forwarded-For\`）。若"未配置即拒绝一切"，会让未设置该变量的
开发/联调环境直接不可用，且现象难以定位。
因此采取"未配置 = 不限制 + 显著告警"，把是否启用交给部署配置。
**生产环境应当显式配置该变量**，这一点写在返回的告警与文档里。

代理头处理
----------
优先使用 \`X-Forwarded-For\` 的第一段（最靠近客户端的地址），
其次 \`X-Real-IP\`，最后 \`REMOTE_ADDR\`。
注意：只有在**可信反向代理**后面，这些头才可信；
若服务直接暴露公网，攻击者可伪造 X-Forwarded-For 绕过白名单。
因此本中间件同时支持 \`ADMIN_TRUSTED_PROXY_COUNT\`（默认 1）：
当它 > 0 时，从 XFF 右侧取第 N 段作为真实客户端 IP，避免伪造。
"""

from __future__ import annotations

import ipaddress
import logging
import os

from django.http import JsonResponse

logger = logging.getLogger(__name__)

# 默认放行的路径（探针/静态资源），避免健康检查被白名单拦掉
DEFAULT_EXEMPT_PATHS = ('/health/', '/ready/', '/metrics/')

# 与 ADMIN_ALLOWLIST_IPS 同名的环境变量
ENV_ALLOWLIST = 'ADMIN_ALLOWLIST_IPS'
ENV_TRUSTED_PROXY_COUNT = 'ADMIN_TRUSTED_PROXY_COUNT'


def _parse_allowlist(raw):
    """把 "127.0.0.1,10.0.0.0/8,192.168.1.*" 解析为 ip_network 列表。

    支持：
      - 单个 IP：\`127.0.0.1\`（视为 /32 或 /128）
      - CIDR：\`10.0.0.0/8\`
      - 通配：\`192.168.1.*\` → 转为 \`192.168.1.0/24\`（仅支持末段通配）
    """
    networks = []
    for item in (raw or '').split(','):
        token = item.strip()
        if not token:
            continue
        try:
            if token == '*':
                networks.append(ipaddress.ip_network('0.0.0.0/0'))
                networks.append(ipaddress.ip_network('::/0'))
            elif token.endswith('.*'):
                prefix = token[:-2]
                # 末段通配：按 IPv4 的 /24 处理（这是最常见的用法）
                networks.append(ipaddress.ip_network(f'{prefix}.0/24', strict=False))
            elif '/' in token:
                networks.append(ipaddress.ip_network(token, strict=False))
            else:
                networks.append(ipaddress.ip_network(token, strict=False))
        except ValueError:
            # 配置写错时明确告警，但要继续解析其余项（避免一个笔误让整站不可用）
            logger.warning('%s 中的条目无法解析为 IP/CIDR，已忽略: %r', ENV_ALLOWLIST, token)
    return networks


def _client_ip(request, trusted_proxy_count=1):
    """解析真实客户端 IP。"""
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        parts = [p.strip() for p in xff.split(',') if p.strip()]
        if parts:
            # 从右往左数 trusted_proxy_count 个代理，取再左边一个作为客户端
            idx = max(0, len(parts) - trusted_proxy_count)
            return parts[idx] if idx < len(parts) else parts[0]
    real_ip = request.META.get('HTTP_X_REAL_IP')
    if real_ip:
        return real_ip.strip()
    return request.META.get('REMOTE_ADDR', '')


class AdminIPAllowlistMiddleware:
    """把 ADMIN_ALLOWLIST_IPS 真正生效的中间件。"""

    def __init__(self, get_response):
        self.get_response = get_response
        raw = os.environ.get(ENV_ALLOWLIST, '')
        self.allowlist = _parse_allowlist(raw)
        self.enabled = bool(self.allowlist)
        try:
            self.trusted_proxy_count = int(os.environ.get(ENV_TRUSTED_PROXY_COUNT, '1') or 1)
        except ValueError:
            self.trusted_proxy_count = 1

        if not self.enabled:
            logger.warning(
                '%s 未配置：管理后台当前**不限制来源 IP**。'
                '生产环境请显式配置该变量（逗号分隔 IP/CIDR）。',
                ENV_ALLOWLIST,
            )

    def __call__(self, request):
        if not self.enabled:
            return self.get_response(request)

        path = request.path or ''
        if any(path.startswith(p) for p in DEFAULT_EXEMPT_PATHS):
            return self.get_response(request)

        ip_str = _client_ip(request, self.trusted_proxy_count)
        if not ip_str:
            return self._deny('无法识别来源地址')

        try:
            addr = ipaddress.ip_address(ip_str)
        except ValueError:
            return self._deny('来源地址无法解析')

        for net in self.allowlist:
            # 只在同版本（v4/v6）之间比较，避免 TypeError
            if addr.version == net.version and addr in net:
                return self.get_response(request)

        logger.warning('拒绝来自 %s 的管理后台访问（不在白名单内）: %s', ip_str, path)
        return self._deny('来源地址不在允许范围内')

    @staticmethod
    def _deny(reason):
        """统一拒绝响应。

        刻意不区分"IP 未解析"与"不在白名单"，避免给探测者额外信息。
        """
        return JsonResponse(
            {'status': 'error', 'message': '禁止访问：来源地址不被允许'},
            status=403,
        )
