import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field, field_validator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DB_PATH = os.getenv(
    "DB_PATH",
    os.path.join(BASE_DIR, "ratings.db")
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY or len(SECRET_KEY) < 64:
    raise RuntimeError(
        "Set a strong JWT_SECRET_KEY in your .env file"
    )

ALGORITHM = "HS256"
TOKEN_MINUTES = 30

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer()

router = APIRouter(tags=["Authentication"])


@contextmanager
def db_connection():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize_users_database():
    with db_connection() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


class RegisterInput(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_]+$"
    )
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value):
        return value.lower()


class LoginInput(BaseModel):
    email: EmailStr
    password: str


def public_user(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "created_at": row["created_at"]
    }


def create_access_token(user_id):
    expiry = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_MINUTES
    )

    return jwt.encode(
        {"sub": user_id, "exp": expiry},
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    )
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp"]}
        )
        user_id = payload["sub"]

        if not isinstance(user_id, str) or not user_id:
            raise ValueError("Invalid user identifier")


    except (InvalidTokenError, ValueError, KeyError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    with db_connection() as db:
        user = db.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Account not found"
        )

    return dict(user)


@router.post("/auth/register", status_code=201)
def register(data: RegisterInput):
    email = str(data.email).lower()

    user_id = "acct_" + uuid.uuid4().hex
    created_at = datetime.now(timezone.utc).isoformat()
    hashed_password = password_hash.hash(data.password)

    try:
        with db_connection() as db:
            db.execute("""
                INSERT INTO users
                    (id, username, email, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                user_id,
                data.username,
                email,
                hashed_password,
                created_at
            ))

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Username or email already registered"
        )

    return {
        "message": "Account created successfully",
        "user": {
            "id": user_id,
            "username": data.username,
            "email": email,
            "created_at": created_at
        }
    }


@router.post("/auth/login")
def login(data: LoginInput):
    email = str(data.email).lower()

    with db_connection() as db:
        user = db.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

    # Perform a hash verification even if the user
    # does not exist, reducing timing differences.
    if user is None:
        password_hash.verify(
            data.password,
            DUMMY_PASSWORD_HASH
        )
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    if not password_hash.verify(
        data.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    token = create_access_token(user["id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_MINUTES * 60,
        "user": public_user(user)
    }

class UpdateProfileInput(BaseModel):
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_]+$"
    )
    email: EmailStr | None = None

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value):
        return value.lower() if value is not None else value


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(
        min_length=8,
        max_length=128
    )

@router.get("/users/me")
def get_profile(
    current_user=Depends(get_current_user)
):
    return public_user(current_user)


# Used to make unknown-email authentication
# take a more similar amount of processing time.
DUMMY_PASSWORD_HASH = password_hash.hash(
    "dummy-password-for-timing-protection"
)

@router.patch("/users/me")
def update_profile(
    data: UpdateProfileInput,
    current_user=Depends(get_current_user)
):
    # Only update fields explicitly included
    # in the request.
    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one field to update"
        )

    if any(value is None for value in changes.values()):
        raise HTTPException(
            status_code=422,
            detail="Profile fields cannot be null"
        )

    username = changes.get(
        "username",
        current_user["username"]
    )

    email = changes.get(
        "email",
        current_user["email"]
    )

    email = str(email).lower()

    try:
        with db_connection() as db:
            db.execute("""
                UPDATE users
                SET username = ?, email = ?
                WHERE id = ?
            """, (
                username,
                email,
                current_user["id"]
            ))

            updated = db.execute(
                "SELECT * FROM users WHERE id = ?",
                (current_user["id"],)
            ).fetchone()

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Username or email already in use"
        )

    return {
        "message": "Profile updated successfully",
        "user": public_user(updated)
    }

@router.patch("/users/me/password")
def change_password(
    data: ChangePasswordInput,
    current_user=Depends(get_current_user)
):
    user_id = current_user["id"]

    with db_connection() as db:
        user = db.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Account not found"
            )

        if not password_hash.verify(
            data.current_password,
            user["password_hash"]
        ):
            raise HTTPException(
                status_code=400,
                detail="Current password is incorrect"
            )

        if data.current_password == data.new_password:
            raise HTTPException(
                status_code=400,
                detail="New password must be different"
            )

        new_hash = password_hash.hash(
            data.new_password
        )

        db.execute("""
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
        """, (
            new_hash,
            user_id
        ))

    return {
        "message": "Password changed successfully"
    }
