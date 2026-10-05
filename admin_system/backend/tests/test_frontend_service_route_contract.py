"""前端服务层路径与后端路由一致性守护。

锁定的缺陷类别（本轮共修复 3 个服务层 + 2 个统计接口，全部实测确认）：
  - categoryService 全部函数指向 /categories，后端在 /content/categories/；
    CategoryManagement 是已挂载页面 -> 分类管理实际不可用；
  - tagService 指向 /tags，且 getTags/getTagStats **直接返回 mock 假数据**；
  - noteService 整份是 mock，路径指向 /notes（后端在 /content/notes/），
    且 /notes/{id}/versions 后端此前没有；
  - statsService 的 /users/stats、/notes/stats、/tags/stats、/categories/stats 均不存在；
  - authService 的 /auth/me 不存在（真实端点是 /auth/check/）；
  - logService 的 /logs/backup/* 四个能力后端完全没有。

这一类问题的共同特征：**构建通过、lint 通过、后端测试全绿**，
因为前端调用的路径压根没有对应的后端路由，谁都不会在编译期发现，
只有真人在页面上点才会暴露。因此必须靠"路径 ↔ 路由"的静态比对来守。

做法：
  1. 用 Django 的 resolver 枚举全部后端路由并归一化（pk -> :id，去掉 ^ $）；
  2. 扫描 frontend/src/services/*.js 中的 api.<verb>(<path>) 调用；
  3. 逐个比对；不在白名单里的不匹配项即失败。

白名单只收录"已明确判定为死代码或有意未实现"的项，且必须写明理由。
"""

import os
import re

import mongoengine
import mongomock
import pytest


# --- 白名单：{ (METHOD, 归一化路径): 理由 } ---
#
# 收紧原则：能不进白名单就不进。这里每一项都已人工核实过页面是否可达。
ALLOWED_MISSING = {
    # contentService 的热门/最新内容：**没有任何页面调用**（已 grep 全量 pages/components 确认），
    # 属历史遗留死代码。保留是为了不扩大本轮改动面；不应新增调用。
    ("GET", "/content/hot"): "无调用方（死代码）",
    ("GET", "/content/latest"): "无调用方（死代码）",
    # settingsService（复数版）里那几个旧备份函数：与 settingService（单数版）重复，
    # 实际页面 BackupManagement 用的是单数版（路径正确）。这组是重复死代码。
    ("GET", "/settings/backup/"): "重复死代码（真实实现见 settingService.js）",
    ("POST", "/settings/backup"): "重复死代码（真实实现见 settingService.js）",
    ("DELETE", "/settings/backup/:id"): "重复死代码（真实实现见 settingService.js）",
    ("POST", "/settings/backup/:id/restore"): "重复死代码（真实实现见 settingService.js）",
}


@pytest.fixture(scope="module")
def routes():
    """枚举并归一化后端全部 /api 路由。"""
    sys_path_hint = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if sys_path_hint not in os.sys.path:
        os.sys.path.insert(0, sys_path_hint)

    _orig = mongoengine.connect
    mongoengine.connect = lambda *a, **kw: _orig(
        *a, **{**kw, "mongo_client_class": mongomock.MongoClient}
    )
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "admin_backend.settings")
    import django

    django.setup()
    from django.urls import get_resolver

    def walk(res, prefix=""):
        for p in res.url_patterns:
            pat = prefix + str(p.pattern)
            if hasattr(p, "url_patterns"):
                yield from walk(p, pat)
            else:
                yield pat

    pk = re.compile(r"\(\?P<pk>\[[^\]]*\]\+\)")
    out = set()
    for raw in walk(get_resolver()):
        if not raw.startswith("api/"):
            continue
        c = raw.replace("^", "").replace("$", "")
        c = pk.sub(":id", c)
        if not c.startswith("/"):
            c = "/" + c
        out.add(c.rstrip("/") + "/")
    return out


@pytest.fixture(scope="module")
def service_calls():
    """收集前端 services 里所有 api.<verb>(<path>) 调用。

    需要处理两种写法（修复后的服务多用后者）：
      1. 直接字面量：api.get("/content/tags/")
      2. 常量拼接：  const BASE = "/content/tags/"; api.get(`${BASE}${id}/`)
    因此先解析文件内的 `const X = "..."` 常量，再在解析调用时展开它们；
    未识别的模板变量统一归一成 :id。
    """
    services_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend",
        "src",
        "services",
    )
    calls = []
    call_re = re.compile(
        r"api\.(get|post|put|patch|delete)\(\s*[`\x27\"]([^`\x27\"]+)"
    )
    const_re = re.compile(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*[`\x27\"]([^`\x27\"]+)[`\x27\"]")

    for fname in sorted(os.listdir(services_dir)):
        if not fname.endswith(".js"):
            continue
        text = open(os.path.join(services_dir, fname), encoding="utf-8").read()

        # 先收集本文件里的常量（限字面量字符串，避免误解析）
        consts = {name: value for name, value in const_re.findall(text)}

        for m in call_re.finditer(text):
            verb, raw = m.group(1).upper(), m.group(2)
            path = raw
            # 展开 ${CONST} 形式
            for cname, cval in consts.items():
                path = path.replace("${" + cname + "}", cval)
            # 其余模板变量（如 ${id}）归一成 :id
            path = re.sub(r"\$\{[^}]+\}", ":id", path)
            if not path.startswith("/"):
                continue
            path = re.sub(r"\$\{[^}]+\}", ":id", path)
            calls.append((fname, verb, path))
    return calls


def _normalize(path):
    """把前端路径归一化成与后端路由同形：统一尾斜杠、/api 前缀由后端侧带。"""
    return ("/api" + path).rstrip("/") + "/"


def test_no_missing_backend_routes(routes, service_calls):
    """前端服务层引用的每个路径都应存在于后端路由（除白名单）。"""
    missing = []
    for fname, verb, path in service_calls:
        full = _normalize(path)
        if full in routes:
            continue
        # 带 :id 的按前缀宽松匹配（后端可能有嵌套动作）
        if (verb, path) in ALLOWED_MISSING:
            continue
        missing.append((verb, path, fname))

    # 去重后报错，便于定位
    unique = sorted(set(missing))
    assert unique == [], (
        "以下前端调用在后端没有对应路由（新增调用前请先确认后端已实现，",
        "或在本文件 ALLOWED_MISSING 里写明理由）：\n"
        + "\n".join(f"  {v:6s} {p:44s} <- {f}" for v, p, f in unique)
    )


def test_whitelist_is_still_needed(routes, service_calls):
    """白名单里已不存在的条目应被清理，避免白名单腐化。"""
    live = set()
    for _, verb, path in service_calls:
        if _normalize(path) in routes:
            continue
        live.add((verb, path))

    stale = [k for k in ALLOWED_MISSING if k not in live]
    assert stale == [], (
        "白名单中存在已失效条目（对应调用已被修复或删除），请从 ALLOWED_MISSING 移除：\n"
        + "\n".join(f"  {v:6s} {p}" for v, p in stale)
    )


def test_three_fixed_services_point_to_real_content_paths(service_calls):
    """回归锁定：三个被修复的服务必须使用 /content/ 前缀。"""
    for fname in ("categoryService.js", "tagService.js", "noteService.js"):
        paths = [p for f, _, p in service_calls if f == fname]
        assert paths, f"{fname} 未解析到任何调用（文件被删或改写？）"
        for p in paths:
            assert p.startswith("/content/"), (
                f"{fname} 存在非 /content/ 前缀的调用: {p}；"
                "这三个服务的后端前缀就是 /content/，回退即为回归"
            )


def test_no_mock_returns_in_fixed_services():
    """回归锁定：三个已修复的服务不得再有"直接 return mock*"的假数据。"""
    services_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend",
        "src",
        "services",
    )
    offenders = []
    for fname in ("categoryService.js", "tagService.js", "noteService.js"):
        text = open(os.path.join(services_dir, fname), encoding="utf-8").read()
        # 去掉注释行后再找"return mock"
        code = "\n".join(
            line for line in text.split("\n") if not line.strip().startswith("//")
        )
        if re.search(r"return\s+mock[A-Za-z]*\(", code):
            offenders.append(fname)
    assert offenders == [], (
        f"以下服务仍在返回 mock 假数据，会让页面展示虚构内容: {offenders}"
    )
