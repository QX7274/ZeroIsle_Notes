#!/usr/bin/env python
"""
共享链最小 API 联调脚本

用途：
- 在本地后端启动后，快速验证“注册 -> 登录 -> 建群 -> 生成加入码 -> 创建共享 -> 列表/加入共享”最小链路
- 默认优先配合 testing 环境使用，避免把真机前联调建立在真实远端依赖上

说明：
- 本脚本只验证 HTTP API 最小契约，不等同于 WebRTC 端到端联调完成
- 本脚本不等同于 Android 专用 MCP 真机可视化验证完成
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from typing import Any, Dict

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="共享链最小 API 联调脚本")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8001/api/v1",
        help="API 根地址，默认 http://127.0.0.1:8001/api/v1",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="单次请求超时时间（秒），默认 20",
    )
    return parser.parse_args()


def dump_response(name: str, response: requests.Response) -> None:
    body = response.text
    if len(body) > 400:
        body = body[:400] + "..."
    print(f"[{name}] status={response.status_code}")
    print(f"[{name}] body={body}")


def ensure_ok(name: str, response: requests.Response, expected_status: int) -> Dict[str, Any]:
    dump_response(name, response)
    if response.status_code != expected_status:
        raise RuntimeError(f"{name} 失败，期望 {expected_status}，实际 {response.status_code}")
    return response.json()


def main() -> int:
    args = parse_args()
    base = args.base_url.rstrip("/")
    timeout = args.timeout

    print("== 共享链最小 API 联调开始 ==")
    print(f"base_url={base}")

    username = "share_" + uuid.uuid4().hex[:8]
    password = "Z!9mQ@7rLp"
    group_name = "共享联调群-" + uuid.uuid4().hex[:6]
    share_title = "本地共享联调-" + uuid.uuid4().hex[:6]

    register_payload = {
        "username": username,
        "password": password,
    }
    register = requests.post(
        f"{base}/auth/register/username/",
        json=register_payload,
        timeout=timeout,
    )
    register_data = ensure_ok("register", register, 201)
    access = register_data["access"]
    user_id = register_data["user"]["id"]

    login = requests.post(
        f"{base}/auth/login/",
        json={"username": username, "password": password},
        timeout=timeout,
    )
    login_data = ensure_ok("login", login, 200)

    headers = {
        "Authorization": f"Bearer {login_data['access']}",
        "Content-Type": "application/json",
    }

    group_create = requests.post(
        f"{base}/groups/",
        headers=headers,
        json={"name": group_name, "description": "批次05共享链最小联调群"},
        timeout=timeout,
    )
    group_data = ensure_ok("group_create", group_create, 201)
    group_id = group_data["id"]

    join_code_resp = requests.post(
        f"{base}/groups/{group_id}/generate-join-code/",
        headers=headers,
        json={"expires_in": 30},
        timeout=timeout,
    )
    join_code_data = ensure_ok("generate_join_code", join_code_resp, 200)

    shared_create = requests.post(
        f"{base}/groups/shared-screens/",
        headers=headers,
        json={"group_id": group_id, "title": share_title},
        timeout=timeout,
    )
    shared_data = ensure_ok("shared_create", shared_create, 201)
    shared_id = shared_data["id"]

    shared_list = requests.get(
        f"{base}/groups/shared-screens/",
        headers=headers,
        timeout=timeout,
    )
    shared_list_data = ensure_ok("shared_list", shared_list, 200)

    shared_join = requests.get(
        f"{base}/groups/shared-screens/{shared_id}/join/",
        headers=headers,
        timeout=timeout,
    )
    shared_join_data = ensure_ok("shared_join", shared_join, 200)

    summary = {
        "username": username,
        "user_id": user_id,
        "group_id": group_id,
        "join_code": join_code_data.get("join_code"),
        "shared_id": shared_id,
        "webrtc_room_id": shared_join_data.get("webrtc_room_id"),
        "shared_count": len(shared_list_data) if isinstance(shared_list_data, list) else "unknown",
        "timestamp": int(time.time()),
    }

    print("== 共享链最小 API 联调成功 ==")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("说明：以上结果仅证明共享 HTTP 契约最小链路可达，不等同于 WebRTC 端到端联调或 Android 真机验证完成。")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"共享链最小 API 联调失败: {exc}", file=sys.stderr)
        raise
