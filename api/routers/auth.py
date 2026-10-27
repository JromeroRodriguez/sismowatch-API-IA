"""Authentication router."""

from fastapi import APIRouter, Depends, HTTPException, status
from auth import authenticate_user, create_access_token, get_current_user
from schemas import LoginRequest, Token, User

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=Token, summary="Iniciar sesión y obtener JWT")
def login(request: LoginRequest):
    """Autentica a un usuario (admin o viewer) y retorna un JSON Web Token (JWT)

    con el rol asignado.
    """
    user = authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
    )


@router.get("/me", response_model=User, summary="Obtener perfil del usuario autenticado")
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna información del usuario y rol correspondiente al token actual."""
    return current_user
