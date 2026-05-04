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

    # Build login body: use custom login_body_fields if provided,
    # else fall back to username_field/password_field
    # login_body_fields values can use {username} and {password} as placeholders
    login_body_fields = cfg.get("login_body_fields")
    if login_body_fields and isinstance(login_body_fields, dict):
        body = {}
        for k, v in login_body_fields.items():
            if isinstance(v, str):
                v = v.replace("{username}", cfg.get("username", ""))
                v = v.replace("{password}", cfg.get("password", ""))
            body[k] = v
    else:
        username_field = cfg.get("username_field") or "username"
        password_field = cfg.get("password_field") or "password"
        body = {
            username_field: cfg.get("username", ""),
            password_field: cfg.get("password", ""),
        }

    # Extra headers for the login request (e.g. Commvault needs Authorization: Basic Og==)
    login_headers = cfg.get("login_headers")
    extra_headers = dict(login_headers) if login_headers and isinstance(login_headers, dict) else {}
    extra_headers.setdefault("Content-Type", "application/json")
    extra_headers.setdefault("Accept", "application/json")

    base_url = asset["base_url"].rstrip("/")
    url = base_url + ("/" + login_path.lstrip("/"))
    try:
        if method == "GET":
            resp = await client.get(url, params=body, headers=extra_headers, timeout=30)
        else:
            resp = await client.post(url, json=body, headers=extra_headers, timeout=30)
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


async def test_asset_connection(asset: Dict, endpoints: list | None = None) -> Dict:
    """Attempt auth or a simple base_url GET. Returns {ok, detail}.
    If a bare base_url GET returns 401/403, retry with the first endpoint path
    (some APIs like ServiceNow reject unauthenticated root requests).
    """
    asset = _decrypt_asset(asset)
    async with httpx.AsyncClient(verify=False) as client:
        auth_type = asset.get("auth_type", "none")
        try:
            if auth_type == "token":
                token = await _acquire_token(asset, client)
                return {"ok": True, "detail": f"Token acquired ({token[:12]}...)"}
            # basic / api_key / none: do a simple GET to base_url
            headers, basic = _build_auth_headers_and_auth(asset)
            base_url = asset["base_url"].rstrip("/")
            resp = await client.get(base_url, headers=headers, auth=basic, timeout=20)
            if resp.status_code in (401, 403) and endpoints:
                # Retry with the first endpoint path — some APIs need a real path
                first_path = (endpoints[0].get("path") or "").lstrip("/")
                if first_path:
                    url = base_url + "/" + first_path
                    # Add query params to limit the response size
                    params = {"sysparm_limit": "1"} if "sysparm" in first_path or "service-now" in base_url.lower() or "servicenow" in base_url.lower() else {}
                    resp = await client.get(url, headers=headers, auth=basic, timeout=20, params=params or None)
            if 200 <= resp.status_code < 400:
                return {"ok": True, "detail": f"HTTP {resp.status_code}"}
            else:
                return {"ok": False, "detail": f"HTTP {resp.status_code}"}
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

        # Filter out None values from query params (LLM may pass null)
        clean_params = {k: v for k, v in (query_params or {}).items() if v is not None} or None
        # Fall back to endpoint's default_body for GraphQL / POST endpoints
        if body is None and method in ("POST", "PUT", "PATCH"):
            body = endpoint.get("default_body")
        # Always set Accept and Content-Type for JSON APIs
        headers.setdefault("Accept", "application/json")
        if method in ("POST", "PUT", "PATCH"):
            headers.setdefault("Content-Type", "application/json")
        req_kwargs = {"headers": headers, "auth": basic, "timeout": 60, "params": clean_params}
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
    # sanitize names — keep them short for small LLMs
    safe_vendor = "".join(c if c.isalnum() else "" for c in (asset.get("vendor") or asset["name"]))[:12].lower()
    safe_ep = "".join(c if c.isalnum() or c == "_" else "_" for c in endpoint["name"]).strip("_").lower()
    name = f"{safe_vendor}_{safe_ep}"[:60]

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
    # Build concise description for LLM — strip examples, keep purpose
    ep_desc = endpoint.get("description", "")
    # Remove "Send a GraphQL..." and "Example: ..." noise for small LLMs
    import re as _re
    ep_desc = _re.split(r'\.\s*(?:Send |Example)', ep_desc)[0].strip().rstrip(".")
    description = f"[{asset.get('vendor','')}] {ep_desc}"

    return {
        "name": name,
        "description": description,
        "parameters": schema,
        "_asset_id": asset["id"],
        "_endpoint_id": endpoint["id"],
    }
