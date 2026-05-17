import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import Groomer

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer(auto_error=False)

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(groomer_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": groomer_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


def get_current_groomer(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Groomer:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    groomer_id = _decode_token(credentials.credentials)
    if not groomer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    groomer = db.query(Groomer).filter(Groomer.id == groomer_id).first()
    if not groomer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Groomer not found")
    return groomer
