"""Execute Asset HTTP calls with proper auth handling (token-based / basic)."""
import httpx
from typing import Any, Dict, Optional
from crypto_util import decrypt


def _build_auth_headers_and_auth(asset: Dict) -> (Dict[str, str], Optional[tuple]):
    """
    Returns (headers, basic_auth_tuple_or_None).
    asset has: auth_type, auth_config (decrypted values expected here)
    """
    auth_type = asset.get("auth_type", "none")
    cfg = asset.get("auth_config", {}) or {}
    headers: Dict[str, str] = {}
    basic = None
    if auth_type == "basic":
        username = cfg.get("username", "")
        password = cfg.get("password", "")
        basic = (username, password)
    elif auth_type == "api_key":
        header_name = cfg.get("header_name") or "Authorization"
        header_prefix = cfg.get("header_prefix", "")
        api_key = cfg.get("api_key", "")
        headers[header_name] = f"{header_prefix}{api_key}" if header_prefix else api_key
    # token handled separately via _acquire_token
    return headers, basic


async def _acquire_token(asset: Dict, client: httpx.AsyncClient) -> Optional[str]:
    """
    For token-based auth:
      auth_config = {
        login_path, login_method (POST default),
        username, password,
        username_field, password_field,  (defaults: 'username' / 'password')
        token_path (dot path in response, default 'token' or 'access_token'),
        token_header (default 'Authorization'),
        token_prefix (default 'Bearer '),
      }
    """
    cfg = asset.get("auth_config", {}) or {}
    login_path = cfg.get("login_path") or "/login"
    method = (cfg.get("login_method") or "POST").upper()
    username_field = cfg.get("username_field") or "username"
    password_field = cfg.get("password_field") or "password"
    body = {
        username_field: cfg.get("username", ""),
        password_field: cfg.get("password", ""),
    }
    base_url = asset["base_url"].rstrip("/")
    url = base_url + ("/" + login_path.lstrip("/"))
    try:
        if method == "GET":
            resp = await client.get(url, params=body, timeout=30)
        else:
            resp = await client.post(url, json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"Token login failed: {e}")

    # Try specified token_path (dot notation) else common fields
    token_path = cfg.get("token_path")
    token: Optional[str] = None
    if token_path:
        cur = data
        for part in token_path.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                cur = None
                break
        if isinstance(cur, str):
            token = cur
    if not token:
        for k in ("token", "access_token", "accessToken", "jwt", "id_token"):
            if isinstance(data.get(k), str):
                token = data[k]
                break
    if not token:
        raise RuntimeError(f"Could not extract token from login response: {data}")
    return token


async def test_asset_connection(asset: Dict) -> Dict:
    """Attempt auth or a simple base_url GET. Returns {ok, detail}."""
    asset = _decrypt_asset(asset)
    async with httpx.AsyncClient(verify=False) as client:
        auth_type = asset.get("auth_type", "none")
        try:
            if auth_type == "token":
                token = await _acquire_token(asset, client)
                return {"ok": True, "detail": f"Token acquired ({token[:12]}...)"}
            # basic / api_key / none: do a simple GET to base_url
            headers, basic = _build_auth_headers_and_auth(asset)
            resp = await client.get(asset["base_url"], headers=headers, auth=basic, timeout=20)
            return {"ok": True, "detail": f"HTTP {resp.status_code}"}
        except Exception as e:
            return {"ok": False, "detail": str(e)}


def _decrypt_asset(asset: Dict) -> Dict:
    """Return asset with decrypted auth_config values."""
    a = dict(asset)
    cfg = dict(a.get("auth_config") or {})
    for k in ("password", "api_key"):
        if k in cfg and cfg[k]:
            cfg[k] = decrypt(cfg[k])
    a["auth_config"] = cfg
    return a


async def call_asset_endpoint(
    asset: Dict,
    endpoint: Dict,
    path_params: Optional[Dict[str, Any]] = None,
    query_params: Optional[Dict[str, Any]] = None,
    body: Optional[Any] = None,
) -> Dict:
    """
    Execute the endpoint; returns {status_code, headers, body}.
    """
    asset = _decrypt_asset(asset)
    base_url = asset["base_url"].rstrip("/")
    method = (endpoint.get("method") or "GET").upper()
    path = endpoint.get("path") or "/"
    # substitute path params {name}
    if path_params:
        for k, v in path_params.items():
            path = path.replace("{" + k + "}", str(v))
    url = base_url + "/" + path.lstrip("/")

    async with httpx.AsyncClient(verify=False) as client:
        headers, basic = _build_auth_headers_and_auth(asset)
        if asset.get("auth_type") == "token":
            token = await _acquire_token(asset, client)
            cfg = asset.get("auth_config") or {}
            header_name = cfg.get("token_header") or "Authorization"
            header_prefix = cfg.get("token_prefix")
            if header_prefix is None:
                header_prefix = "Bearer "
            headers[header_name] = f"{header_prefix}{token}"

        req_kwargs = {"headers": headers, "auth": basic, "timeout": 60, "params": query_params or None}
        if method in ("POST", "PUT", "PATCH", "DELETE") and body is not None:
            req_kwargs["json"] = body

        try:
            resp = await client.request(method, url, **req_kwargs)
            try:
                body_out = resp.json()
            except Exception:
                body_out = resp.text
            return {
                "ok": 200 <= resp.status_code < 400,
                "status_code": resp.status_code,
                "url": url,
                "method": method,
                "body": body_out,
            }
        except Exception as e:
            return {"ok": False, "status_code": 0, "url": url, "method": method, "body": f"Request error: {e}"}


def endpoint_to_tool_schema(asset: Dict, endpoint: Dict) -> Dict:
    """
    Build a tool schema (OpenAI function-calling compatible) for one endpoint.
    """
    # sanitize names
    safe_asset = "".join(c if c.isalnum() or c == "_" else "_" for c in asset["name"]).lower()
    safe_ep = "".join(c if c.isalnum() or c == "_" else "_" for c in endpoint["name"]).lower()
    name = f"{safe_asset}__{safe_ep}"[:60]

    props: Dict[str, Any] = {}
    required = []

    # path params: detected from {xxx} in path
    import re
    path = endpoint.get("path") or ""
    for m in re.findall(r"{(\w+)}", path):
        props[f"path_{m}"] = {"type": "string", "description": f"Path parameter {m}"}
        required.append(f"path_{m}")

    # query params (user-defined as list of {name, description, required})
    for q in endpoint.get("query_params") or []:
        qn = q.get("name")
        if not qn:
            continue
        props[f"query_{qn}"] = {"type": "string", "description": q.get("description", f"Query param {qn}")}
        if q.get("required"):
            required.append(f"query_{qn}")

    # body: free-form object for POST/PUT/PATCH
    method = (endpoint.get("method") or "GET").upper()
    if method in ("POST", "PUT", "PATCH"):
        props["body"] = {"type": "object", "description": "JSON body to send", "additionalProperties": True}

    schema = {
        "type": "object",
        "properties": props,
        "required": required,
        "additionalProperties": False,
    }
    return {
        "name": name,
        "description": f"{method} {endpoint.get('path','')} on {asset['name']} ({asset.get('vendor','')}). {endpoint.get('description','')}",
        "parameters": schema,
        "_asset_id": asset["id"],
        "_endpoint_id": endpoint["id"],
    }
