"""Authentication, JWT tokens, and Role-Based Access Control (RBAC)."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from config import settings
from schemas import User

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer security scheme
security = HTTPBearer(auto_error=False)

# Seeded users in-memory from environment variables
SEED_USERS = {
    settings.PLATFORM_ADMIN_USER: {
        "username": settings.PLATFORM_ADMIN_USER,
        "password": settings.PLATFORM_ADMIN_PASSWORD,
        "role": "admin",
    },
    settings.PLATFORM_VIEWER_USER: {
        "username": settings.PLATFORM_VIEWER_USER,
        "password": settings.PLATFORM_VIEWER_PASSWORD,
        "role": "viewer",
    },
}


def verify_password(plain_password: str, stored_password: str) -> bool:
    """Compare plain password directly or through bcrypt."""
    if plain_password == stored_password:
        return True
    try:
        return pwd_context.verify(plain_password, stored_password)
    except Exception:
        return False


def authenticate_user(username: str, password: str) -> Optional[User]:
    """Authenticate username and password against seeded platform users."""
    user_record = SEED_USERS.get(username)
    if not user_record:
        return None
    if not verify_password(password, user_record["password"]):
        return None
    return User(username=user_record["username"], role=user_record["role"])


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    """Dependency: Extract and validate JWT Bearer token.
    Raises 401 if missing or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de autenticación no proporcionadas o inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials or not credentials.credentials:
        raise credentials_exception

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        return User(username=username, role=role)
    except JWTError:
        raise credentials_exception


def require_viewer_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allows either viewer or admin roles."""
    if current_user.role not in ["viewer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado para este rol",
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allows ONLY admin role. Rejects viewer with 403 Forbidden."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado: Esta acción requiere rol de Administrador",
        )
    return current_user
