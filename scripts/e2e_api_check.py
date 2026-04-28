import argparse
import time
import uuid
import requests


def show(name, resp):
    ct = resp.headers.get("content-type", "")
    body = resp.text[:260].replace("\n", " ")
    print(f"{name}: status={resp.status_code} ct={ct} body={body}")


def parse_args():
    parser = argparse.ArgumentParser(description="Backend E2E API check")
    parser.add_argument("--base", default="http://127.0.0.1:8001", help="API base URL")
    parser.add_argument("--timeout", type=int, default=20, help="request timeout seconds")
    parser.add_argument("--register-retries", type=int, default=8, help="retries for register")
    return parser.parse_args()


def register_with_retry(session, base, username_prefix, password, timeout, retries):
    last_resp = None
    for i in range(retries):
        username = f"{username_prefix}_{uuid.uuid4().hex[:10]}"
        resp = session.post(
            base + "/api/v1/auth/register/username/",
            json={"username": username, "password": password},
            timeout=timeout,
        )
        show(f"register[{i}]", resp)
        last_resp = resp
        if resp.status_code in (200, 201):
            return username, resp
        time.sleep(0.2)
    raise SystemExit(f"register failed after retries, last_status={last_resp.status_code if last_resp else 'NA'}")


def main():
    args = parse_args()
    base = args.base.rstrip("/")
    timeout = args.timeout

    s = requests.Session()
    password = "Passw0rd!23"

    health = s.get(base + "/health/", timeout=timeout)
    show("health", health)

    username, reg = register_with_retry(s, base, "e2e", password, timeout, args.register_retries)
    token = reg.json().get("access")

    login = s.post(
        base + "/api/v1/auth/login/",
        json={"identifier": username, "password": password},
        timeout=timeout,
    )
    show("login", login)
    if login.status_code == 200 and login.json().get("access"):
        token = login.json()["access"]
    if not token:
        raise SystemExit("no access token")

    headers = {"Authorization": f"Bearer {token}"}

    create = s.post(
        base + "/api/v1/notes/notes/",
        json={
            "title": "E2E " + username,
            "content": "hello",
            "is_public": False,
            "is_favorite": False,
        },
        headers=headers,
        timeout=timeout,
    )
    show("create", create)
    if create.status_code not in (200, 201):
        raise SystemExit("create failed")

    note_id = create.json().get("id")
    if not note_id:
        raise SystemExit("no note id")

    show("list", s.get(base + "/api/v1/notes/notes/?page=1&page_size=5", headers=headers, timeout=timeout))
    show("retrieve", s.get(base + f"/api/v1/notes/notes/{note_id}/", headers=headers, timeout=timeout))

    update = s.put(
        base + f"/api/v1/notes/notes/{note_id}/",
        json={
            "title": "E2E updated " + username,
            "content": "updated",
            "is_public": True,
            "is_favorite": True,
        },
        headers=headers,
        timeout=timeout,
    )
    show("update", update)

    delete = s.delete(base + f"/api/v1/notes/notes/{note_id}/", headers=headers, timeout=timeout)
    show("delete", delete)

    after_delete = s.get(base + f"/api/v1/notes/notes/{note_id}/", headers=headers, timeout=timeout)
    show("retrieve_after_delete", after_delete)

    if delete.status_code != 204 or after_delete.status_code not in (403, 404):
        raise SystemExit("delete verification failed")

    print("E2E_DONE", username, note_id)


if __name__ == "__main__":
    main()
