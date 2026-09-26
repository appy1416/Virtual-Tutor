from fastapi import APIRouter, Depends, HTTPException, status
from app.models.user import UserCreate, UserLogin, UserOut, Token, GoogleAuthRequest
from app.services.auth_service import (
    hash_password_async, verify_password_async, create_access_token, serialize_doc, get_current_user
)
from app.db.mongodb import get_database
from app.config import settings
from datetime import datetime, timezone
from typing import Any, Dict
import re
import httpx

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate):
    db = get_database()
    clean_email = user_in.email.strip().lower()
    
    existing_user = await db.users.find_one({
        "$or": [
            {"email": clean_email},
            {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
        ]
    })

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
        
    hashed_pwd = await hash_password_async(user_in.password)
    
    user_dict = {
        "name": user_in.name.strip(),
        "email": clean_email,
        "password_hash": hashed_pwd,
        "role": user_in.role.value,
        "created_at": datetime.now(timezone.utc),
        "profile": {
            "avatar": "",
            "bio": "",
            "preferences": {
                "language": "en",
                "theme": "dark"
            }
        }
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    
    return serialize_doc(user_dict)

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    db = get_database()
    clean_email = credentials.email.strip().lower()
    
    user = await db.users.find_one({"email": clean_email})
    if not user:
        # Try case-insensitive lookup for legacy records
        user = await db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )

    stored_hash = user.get("password_hash", "")
    is_valid = await verify_password_async(credentials.password, stored_hash)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )

    # Auto-upgrade legacy plain text password hashes to bcrypt in MongoDB
    if stored_hash == credentials.password:
        try:
            new_hash = await hash_password_async(credentials.password)
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": new_hash}})
            print(f"Auto-upgraded legacy password hash to bcrypt for user {clean_email}")
        except Exception as ue:
            print(f"Could not auto-upgrade password hash: {ue}")
        
    # Generate token
    token_data = {
        "sub": user["email"],
        "role": user["role"],
        "name": user["name"]
    }
    
    access_token = create_access_token(data=token_data)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user["role"],
        name=user["name"]
    )

@router.post("/google", response_model=Token)
async def google_auth(auth_req: GoogleAuthRequest):
    db = get_database()
    credential = (auth_req.credential or "").strip()
    raw_access_token = (auth_req.access_token or "").strip()

    if not credential and not raw_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential or access token is required"
        )

    google_data = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if credential:
                # Verify ID token using Google tokeninfo endpoint
                verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
                resp = await client.get(verify_url)
                if resp.status_code == 200:
                    google_data = resp.json()
                elif raw_access_token:
                    userinfo_resp = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {raw_access_token}"}
                    )
                    if userinfo_resp.status_code == 200:
                        google_data = userinfo_resp.json()
            elif raw_access_token:
                userinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {raw_access_token}"}
                )
                if userinfo_resp.status_code == 200:
                    google_data = userinfo_resp.json()
    except Exception as exc:
        print(f"Error communicating with Google OAuth APIs: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unable to connect to Google OAuth service: {str(exc)}"
        )

    if not google_data or not google_data.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to verify Google account credentials. Please ensure your Google account is valid."
        )

    # If backend has GOOGLE_CLIENT_ID configured, verify audience for extra security
    if settings.GOOGLE_CLIENT_ID and credential:
        aud = google_data.get("aud") or google_data.get("azp")
        if aud and aud != settings.GOOGLE_CLIENT_ID:
            print(f"Warning: Google Client ID mismatch. Configured: {settings.GOOGLE_CLIENT_ID}, Received: {aud}")

    email = google_data.get("email", "").strip().lower()
    name = google_data.get("name") or google_data.get("given_name") or email.split("@")[0]
    picture = google_data.get("picture", "")

    user = await db.users.find_one({"email": email})
    if not user:
        user = await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})

    # If user exists, log them into their existing account & preserve their current role
    if user:
        # Optionally update profile picture if empty
        if picture and not user.get("profile", {}).get("avatar"):
            try:
                await db.users.update_one({"_id": user["_id"]}, {"$set": {"profile.avatar": picture}})
            except Exception:
                pass
    else:
        # Provision new user with default 'student' role (never admin)
        user_dict = {
            "name": name,
            "email": email,
            "password_hash": "oauth_google_account",
            "role": "student",
            "created_at": datetime.now(timezone.utc),
            "profile": {
                "avatar": picture,
                "bio": "Joined with Google",
                "preferences": {
                    "language": "en",
                    "theme": "dark"
                }
            }
        }
        result = await db.users.insert_one(user_dict)
        user_dict["_id"] = result.inserted_id
        user = user_dict

    token_data = {
        "sub": user["email"],
        "role": user["role"],
        "name": user["name"]
    }

    access_token = create_access_token(data=token_data)

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user["role"],
        name=user["name"]
    )

@router.get("/me", response_model=UserOut)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return current_user

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout():
    return {"message": "Logged out successfully"}
