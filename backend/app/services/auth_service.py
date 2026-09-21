import bcrypt
import jwt
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import settings
from app.db.mongodb import get_database
from bson import ObjectId

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not plain_password:
        return False
    # Fallback for legacy plain text passwords created in early database seeds
    if plain_password == hashed_password:
        return True
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        print(f"Warning: Bcrypt check error for hash ({e}). Checking plain text equality...")
        return plain_password == hashed_password

async def hash_password_async(password: str) -> str:
    return await asyncio.to_thread(hash_password, password)

async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    return await asyncio.to_thread(verify_password, plain_password, hashed_password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    serialized = {}
    for k, v in doc.items():
        if k == "_id":
            serialized["id"] = str(v)
        elif isinstance(v, ObjectId):
            serialized[k] = str(v)
        elif isinstance(v, list):
            serialized[k] = [str(item) if isinstance(item, ObjectId) else item for item in v]
        elif isinstance(v, dict):
            serialized[k] = serialize_doc(v)
        else:
            serialized[k] = v
    return serialized

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    db = get_database()
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
        
    return serialize_doc(user)

def require_role(allowed_roles: list):
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action forbidden for user role: {current_user.get('role')}"
            )
        return current_user
    return role_checker
