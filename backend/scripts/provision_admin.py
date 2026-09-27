"""
Protected Server-Side Admin Account Provisioning Script
Run this script via terminal/shell on the server (e.g. Render Shell or local console) to provision the initial Administrator account.
This script is never exposed to the frontend.
"""

import sys
import os
import argparse
import getpass
import asyncio
from datetime import datetime, timezone

# Ensure backend root is on Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from app.services.auth_service import hash_password_async

async def provision_admin(name: str, email: str, password: str):
    await connect_to_mongo()
    db = get_database()

    clean_email = email.strip().lower()

    # 1. Enforce Admin uniqueness at database level
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        print("\n[ERROR] An administrator account already exists:")
        print(f"  Existing Admin: {existing_admin.get('email')} (Name: {existing_admin.get('name')})")
        print("  Only ONE administrator account is permitted per deployment.")
        await close_mongo_connection()
        sys.exit(1)

    # 2. Check for duplicate email
    existing_user = await db.users.find_one({"email": clean_email})
    if existing_user:
        print(f"\n[ERROR] A user with email '{clean_email}' already exists with role: {existing_user.get('role')}")
        await close_mongo_connection()
        sys.exit(1)

    # 3. Hash password and insert Admin
    hashed_pwd = await hash_password_async(password)
    admin_dict = {
        "name": name.strip(),
        "email": clean_email,
        "password_hash": hashed_pwd,
        "role": "admin",
        "created_at": datetime.now(timezone.utc),
        "profile": {
            "avatar": "",
            "bio": "System Administrator",
            "preferences": {
                "language": "en",
                "theme": "dark"
            }
        }
    }

    res = await db.users.insert_one(admin_dict)
    admin_id = str(res.inserted_id)

    print("\n[SUCCESS] Administrator account provisioned successfully!")
    print(f"  ID:    {admin_id}")
    print(f"  Name:  {name.strip()}")
    print(f"  Email: {clean_email}")
    print(f"  Role:  admin")
    print("  Status: Active & Verified")

    await close_mongo_connection()

def main():
    parser = argparse.ArgumentParser(description="Provision the initial administrator account.")
    parser.add_argument("--name", help="Full name of administrator")
    parser.add_argument("--email", help="Administrator email address")
    parser.add_argument("--password", help="Administrator password (optional, prompted if omitted)")
    args = parser.parse_args()

    name = args.name
    if not name:
        name = input("Enter Administrator Full Name: ").strip()
        if not name:
            print("Name cannot be empty.")
            sys.exit(1)

    email = args.email
    if not email:
        email = input("Enter Administrator Email: ").strip()
        if not email or "@" not in email:
            print("A valid email address is required.")
            sys.exit(1)

    password = args.password
    if not password:
        password = getpass.getpass("Enter Administrator Password: ")
        confirm_password = getpass.getpass("Confirm Administrator Password: ")
        if password != confirm_password:
            print("Passwords do not match.")
            sys.exit(1)
        if len(password) < 6:
            print("Password must be at least 6 characters long.")
            sys.exit(1)

    asyncio.run(provision_admin(name, email, password))

if __name__ == "__main__":
    main()
