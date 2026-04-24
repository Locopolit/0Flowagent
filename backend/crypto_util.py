"""Encrypt/decrypt API keys and credentials at rest."""
import os
from cryptography.fernet import Fernet


def _fernet() -> Fernet:
    key = os.environ["ENCRYPTION_KEY"].encode()
    return Fernet(key)


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except Exception:
        return ""


def mask(value: str, visible: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= visible:
        return "*" * len(value)
    return "*" * (len(value) - visible) + value[-visible:]
