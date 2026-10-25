import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import sys
from pathlib import Path

_dir = Path(__file__).resolve().parent
if str(_dir) not in sys.path:
    sys.path.insert(0, str(_dir))

from database import get_db
import models

# Секретный ключ для подписи JWT
JWT_SECRET = os.getenv("JWT_SECRET", "spacemap_secret_jwt_key_ttk_2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 дней

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Хеширует пароль через PBKDF2-HMAC-SHA256 с солью."""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${pw_hash.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль против хеша."""
    try:
        if "$" not in hashed_password:
            return False
        salt, expected_hash = hashed_password.split("$", 1)
        actual_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return secrets.compare_digest(actual_hash.hex(), expected_hash)
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    """Создаёт JWT токен доступа."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Декодирует и проверяет JWT токен."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None


def get_current_user_optional(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """Возвращает пользователя, если передан валидный Bearer токен, либо None."""
    if not creds:
        return None
    token = creds.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user_id = payload["sub"]
    user = db.query(models.User).filter(models.User.id == user_id, models.User.is_active.is_(True)).first()
    return user


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    """Требует авторизацию. Выбрасывает 401, если токен отсутствует или невалиден."""
    user = get_current_user_optional(creds, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходима авторизация (передайте Bearer токен)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
