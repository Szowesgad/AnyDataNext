"""
Authentication utilities for the AnyDataNext backend.

This module provides JWT token handling, password hashing, and user management.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, Union

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

# Constants
JWT_SECRET = os.environ.get("JWT_SECRET", "extremely_insecure_default_secret")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
USERS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "users.json")

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def read_users() -> Dict:
    """
    Read users from the JSON file.

    Returns:
        Dict: Dictionary of users.
    """
    try:
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"users": []}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash.

    Args:
        plain_password: The password to verify.
        hashed_password: The hashed password to verify against.

    Returns:
        bool: True if the password matches, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password for storing.

    Args:
        password: The password to hash.

    Returns:
        str: The hashed password.
    """
    return pwd_context.hash(password)


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token.

    Args:
        data: Data to encode in the token.
        expires_delta: Optional token expiration time.

    Returns:
        str: The encoded JWT token.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def authenticate_user(username: str, password: str) -> Optional[Dict]:
    """
    Authenticate a user with username and password.

    Args:
        username: The username to authenticate.
        password: The password to authenticate.

    Returns:
        Optional[Dict]: The user dictionary if authentication is successful, None otherwise.
    """
    users = read_users()
    
    for user in users.get("users", []):
        if user["username"] == username and verify_password(password, user["hashed_password"]):
            # Return user without the hashed password
            user_data = user.copy()
            user_data.pop("hashed_password")
            return user_data
    
    return None


async def get_current_user(
    request: Request, 
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    Get the current user from the token.

    Args:
        request: The request object.
        credentials: The HTTP authorization credentials.

    Returns:
        Dict: The current user.

    Raises:
        HTTPException: If token validation fails.
    """
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        users = read_users()
        for user in users.get("users", []):
            if user["username"] == username:
                # Return user without the hashed password
                user_data = user.copy()
                user_data.pop("hashed_password")
                return user_data
                
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def create_user(username: str, password: str, is_admin: bool = False) -> Dict:
    """
    Create a new user and save to the users file.

    Args:
        username: The username of the new user.
        password: The password of the new user.
        is_admin: Whether the user is an admin.

    Returns:
        Dict: The created user.

    Raises:
        ValueError: If the username already exists.
    """
    users = read_users()
    
    # Check if user already exists
    for user in users.get("users", []):
        if user["username"] == username:
            raise ValueError(f"User {username} already exists")
    
    # Create new user
    new_user = {
        "username": username,
        "hashed_password": get_password_hash(password),
        "is_active": True,
        "is_admin": is_admin
    }
    
    # Add user to list
    if "users" not in users:
        users["users"] = []
    users["users"].append(new_user)
    
    # Save users
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)
    
    # Return user without the hashed password
    user_data = new_user.copy()
    user_data.pop("hashed_password")
    return user_data