"""AgentForge backend regression tests.

Covers: auth, llm-configs, assets, endpoints, workspaces, documents,
conversations, stats, and cross-user authorization.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback read from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

assert BASE_URL, "REACT_APP_BACKEND_URL is required"

API = f"{BASE_URL}/api"
PRIMARY = {"email": "test@demo.com", "password": "test1234"}


def _register_or_login(email, password, name="Tester"):
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name}, timeout=20)
    if r.status_code == 200:
        return r.json()["access_token"]
    # if exists, login
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login fallback failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def primary_token():
    return _register_or_login(PRIMARY["email"], PRIMARY["password"])


@pytest.fixture(scope="session")
def secondary_token():
    email = f"test_sec_{uuid.uuid4().hex[:8]}@demo.com"
    return _register_or_login(email, "test1234", "Secondary")


@pytest.fixture
def H(primary_token):
    return {"Authorization": f"Bearer {primary_token}"}


@pytest.fixture
def H2(secondary_token):
    return {"Authorization": f"Bearer {secondary_token}"}


# ---------------- Health ----------------
def test_health_root():
    r = requests.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_register_new_user(self):
        email = f"test_newreg_{uuid.uuid4().hex[:8]}@demo.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "NR"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == email
        assert d["access_token"]
        assert d["name"] == "NR"

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={"email": PRIMARY["email"], "password": "test1234"}, timeout=20)
        assert r.status_code == 400

    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json=PRIMARY, timeout=20)
        assert r.status_code == 200
        assert r.json()["access_token"]

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": PRIMARY["email"], "password": "WRONG"}, timeout=20)
        assert r.status_code == 401

    def test_me_with_token(self, H):
        r = requests.get(f"{API}/auth/me", headers=H, timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == PRIMARY["email"]

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_logout(self, H):
        r = requests.post(f"{API}/auth/logout", headers=H, timeout=20)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------------- LLM Configs ----------------
class TestLLMConfigs:
    @pytest.mark.parametrize("provider,model", [
        ("openai", "gpt-4o-mini"),
        ("anthropic", "claude-3-5-sonnet-latest"),
        ("gemini", "gemini-2.0-flash"),
        ("local", "llama3"),
    ])
    def test_create_all_providers(self, H, provider, model):
        payload = {
            "name": f"TEST_{provider}_{uuid.uuid4().hex[:6]}",
            "provider": provider,
            "api_key": "sk-test-123456789",
            "base_url": "http://localhost:11434/v1" if provider == "local" else "",
            "model": model,
        }
        r = requests.post(f"{API}/llm-configs", json=payload, headers=H, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] == provider
        assert d["model"] == model
        assert "api_key_masked" in d
        # Must not expose encrypted raw api_key
        assert "api_key" not in d
        # Masked should not equal raw
        assert d["api_key_masked"] != "sk-test-123456789"
        return d["id"]

    def test_invalid_provider(self, H):
        r = requests.post(f"{API}/llm-configs", json={
            "name": "TEST_bad", "provider": "nope", "api_key": "x", "model": "x"
        }, headers=H, timeout=20)
        assert r.status_code == 400

    def test_list_update_delete(self, H):
        created = requests.post(f"{API}/llm-configs", json={
            "name": "TEST_crud", "provider": "openai", "api_key": "sk-crud-abcdef",
            "base_url": "", "model": "gpt-4o-mini",
        }, headers=H, timeout=20).json()
        cid = created["id"]

        r = requests.get(f"{API}/llm-configs", headers=H, timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert any(i["id"] == cid for i in items)
        for it in items:
            assert "api_key" not in it
            assert "api_key_masked" in it

        r = requests.put(f"{API}/llm-configs/{cid}", json={
            "name": "TEST_crud_upd", "provider": "openai", "api_key": "",
            "base_url": "", "model": "gpt-4o",
        }, headers=H, timeout=20)
        assert r.status_code == 200

        r = requests.delete(f"{API}/llm-configs/{cid}", headers=H, timeout=20)
        assert r.status_code == 200


# ---------------- Assets & Endpoints ----------------
@pytest.fixture(scope="module")
def llm_cfg_id(primary_token):
    H = {"Authorization": f"Bearer {primary_token}"}
    r = requests.post(f"{API}/llm-configs", json={
        "name": "TEST_wsllm", "provider": "openai", "api_key": "sk-test-ws",
        "base_url": "", "model": "gpt-4o-mini",
    }, headers=H, timeout=20)
    assert r.status_code == 200
    return r.json()["id"]


class TestAssets:
    @pytest.mark.parametrize("auth_type,cfg", [
        ("token", {"login_path": "/auth/login", "username": "u", "password": "p", "token_path": "token"}),
        ("basic", {"username": "u", "password": "p"}),
        ("api_key", {"header_name": "X-API-Key", "api_key": "secret123"}),
        ("none", {}),
    ])
    def test_create_asset_all_auth(self, H, auth_type, cfg):
        payload = {
            "name": f"TEST_asset_{auth_type}",
            "vendor": "Commvault",
            "description": "d",
            "base_url": "https://httpbin.org",
            "auth_type": auth_type,
            "auth_config": cfg,
        }
        r = requests.post(f"{API}/assets", json=payload, headers=H, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["auth_type"] == auth_type
        ac = d["auth_config"]
        if auth_type == "basic":
            assert ac.get("password") == "••••••••"
        if auth_type == "api_key":
            assert ac.get("api_key") == "••••••••"

    def test_asset_crud_and_endpoints_and_tests(self, H):
        # Create asset
        r = requests.post(f"{API}/assets", json={
            "name": "TEST_main_asset", "vendor": "Rubrik", "base_url": "https://httpbin.org",
            "auth_type": "none", "auth_config": {},
        }, headers=H, timeout=20)
        assert r.status_code == 200
        asset = r.json()
        aid = asset["id"]

        # GET single
        r = requests.get(f"{API}/assets/{aid}", headers=H, timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == aid

        # List
        r = requests.get(f"{API}/assets", headers=H, timeout=20)
        assert r.status_code == 200
        assert any(a["id"] == aid for a in r.json())

        # Update (secrets preserved)
        r = requests.put(f"{API}/assets/{aid}", json={
            "name": "TEST_main_asset_upd", "vendor": "Rubrik",
            "base_url": "https://httpbin.org", "auth_type": "none", "auth_config": {},
        }, headers=H, timeout=20)
        assert r.status_code == 200

        # Test connection - should return 200 with {ok, detail}
        r = requests.post(f"{API}/assets/{aid}/test", headers=H, timeout=30)
        assert r.status_code == 200, r.text
        tr = r.json()
        assert "ok" in tr

        # Create endpoints with various methods
        eps = {}
        for method, path in [
            ("GET", "/get"), ("POST", "/post"), ("PUT", "/put"),
            ("PATCH", "/patch"), ("DELETE", "/delete"),
        ]:
            r = requests.post(f"{API}/assets/{aid}/endpoints", json={
                "name": f"ep_{method.lower()}", "description": f"{method} test",
                "method": method, "path": path, "query_params": [],
            }, headers=H, timeout=20)
            assert r.status_code == 200, f"{method} ep creation failed: {r.text}"
            eps[method] = r.json()["id"]

        # Invalid method
        r = requests.post(f"{API}/assets/{aid}/endpoints", json={
            "name": "bad", "method": "OPTIONS", "path": "/x",
        }, headers=H, timeout=20)
        assert r.status_code == 400

        # List endpoints
        r = requests.get(f"{API}/assets/{aid}/endpoints", headers=H, timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 5

        # Update endpoint
        ep_id = eps["GET"]
        r = requests.put(f"{API}/assets/{aid}/endpoints/{ep_id}", json={
            "name": "ep_get_upd", "method": "GET", "path": "/get", "query_params": [],
        }, headers=H, timeout=20)
        assert r.status_code == 200

        # Test endpoint run (fake asset - should still return structured result)
        r = requests.post(
            f"{API}/assets/{aid}/endpoints/{ep_id}/test",
            json={"path_params": {}, "query_params": {}, "body": None},
            headers=H, timeout=30,
        )
        assert r.status_code == 200, r.text
        result = r.json()
        # Should be a dict with some fields (status/body/error etc)
        assert isinstance(result, dict)

        # Delete endpoint
        r = requests.delete(f"{API}/assets/{aid}/endpoints/{ep_id}", headers=H, timeout=20)
        assert r.status_code == 200

        # Delete asset cascades
        r = requests.delete(f"{API}/assets/{aid}", headers=H, timeout=20)
        assert r.status_code == 200
        r = requests.get(f"{API}/assets/{aid}", headers=H, timeout=20)
        assert r.status_code == 404
        # Endpoints gone
        r = requests.get(f"{API}/assets/{aid}/endpoints", headers=H, timeout=20)
        assert r.status_code == 200
        assert r.json() == []


# ---------------- Workspaces ----------------
class TestWorkspaces:
    def test_workspace_crud_cascades(self, H, llm_cfg_id):
        # Create asset to attach
        asset = requests.post(f"{API}/assets", json={
            "name": "TEST_ws_asset", "vendor": "NetApp",
            "base_url": "https://httpbin.org", "auth_type": "none", "auth_config": {},
        }, headers=H, timeout=20).json()

        r = requests.post(f"{API}/workspaces", json={
            "name": "TEST_ws", "description": "d",
            "llm_config_id": llm_cfg_id, "asset_ids": [asset["id"]],
            "system_prompt": "hello",
        }, headers=H, timeout=20)
        assert r.status_code == 200
        ws = r.json()
        ws_id = ws["id"]

        r = requests.get(f"{API}/workspaces", headers=H, timeout=20)
        assert r.status_code == 200
        assert any(w["id"] == ws_id for w in r.json())

        r = requests.get(f"{API}/workspaces/{ws_id}", headers=H, timeout=20)
        assert r.status_code == 200
        assert r.json()["system_prompt"] == "hello"

        r = requests.put(f"{API}/workspaces/{ws_id}", json={
            "name": "TEST_ws_upd", "llm_config_id": llm_cfg_id,
            "asset_ids": [], "system_prompt": "new",
        }, headers=H, timeout=20)
        assert r.status_code == 200

        # Upload document
        files = {"file": ("note.txt", b"AgentForge is a platform. Rubrik is a vendor.", "text/plain")}
        r = requests.post(f"{API}/workspaces/{ws_id}/documents", files=files, headers=H, timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["filename"] == "note.txt"
        assert isinstance(doc["chunks"], int)

        r = requests.get(f"{API}/workspaces/{ws_id}/documents", headers=H, timeout=20)
        assert r.status_code == 200
        docs_list = r.json()
        assert any(d["id"] == doc["id"] for d in docs_list)
        for d in docs_list:
            assert "chunks" not in d  # hidden in list

        # Conversation CRUD
        r = requests.post(f"{API}/workspaces/{ws_id}/conversations",
                          json={"title": "chat1"}, headers=H, timeout=20)
        assert r.status_code == 200
        conv = r.json()

        r = requests.get(f"{API}/workspaces/{ws_id}/conversations", headers=H, timeout=20)
        assert r.status_code == 200 and len(r.json()) >= 1

        r = requests.get(f"{API}/conversations/{conv['id']}/messages", headers=H, timeout=20)
        assert r.status_code == 200
        assert r.json() == []

        # Delete workspace cascades
        r = requests.delete(f"{API}/workspaces/{ws_id}", headers=H, timeout=20)
        assert r.status_code == 200
        r = requests.get(f"{API}/workspaces/{ws_id}", headers=H, timeout=20)
        assert r.status_code == 404

        # Cleanup asset
        requests.delete(f"{API}/assets/{asset['id']}", headers=H, timeout=20)


# ---------------- Stats ----------------
def test_stats(H):
    r = requests.get(f"{API}/stats", headers=H, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ("assets", "llm_configs", "workspaces", "conversations", "messages"):
        assert k in d
        assert isinstance(d[k], int)


# ---------------- Cross-user authorization ----------------
class TestAuthorization:
    def test_cannot_access_other_users_resources(self, H, H2):
        # User1 creates an asset
        r = requests.post(f"{API}/assets", json={
            "name": "TEST_iso_asset", "vendor": "Dell",
            "base_url": "https://httpbin.org", "auth_type": "none", "auth_config": {},
        }, headers=H, timeout=20)
        assert r.status_code == 200
        aid = r.json()["id"]

        # User2 cannot get it
        r = requests.get(f"{API}/assets/{aid}", headers=H2, timeout=20)
        assert r.status_code == 404

        # User2 cannot list it
        r = requests.get(f"{API}/assets", headers=H2, timeout=20)
        assert all(a["id"] != aid for a in r.json())

        # User2 cannot delete it
        r = requests.delete(f"{API}/assets/{aid}", headers=H2, timeout=20)
        # Silent delete returns ok True but should not actually delete
        r2 = requests.get(f"{API}/assets/{aid}", headers=H, timeout=20)
        assert r2.status_code == 200, "User2 was able to delete User1's asset!"

        # Cleanup
        requests.delete(f"{API}/assets/{aid}", headers=H, timeout=20)
