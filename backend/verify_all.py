import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.db.mongodb import connect_to_mongo

client = TestClient(app)

async def run_tests():
    print("--- In-Process FastAPI Smoke Test ---")
    await connect_to_mongo()
    
    # 1. Health check
    res = client.get("/api/health")
    print("Health Check:", res.status_code, res.json())
    assert res.status_code == 200

    # 2. Register / Login Student
    student_email = "inproc_student@example.com"
    reg = client.post("/api/auth/register", json={
        "name": "InProc Student",
        "email": student_email,
        "password": "Password123!",
        "role": "student"
    })
    print("Student Register Status:", reg.status_code)

    login_res = client.post("/api/auth/login", json={
        "email": student_email,
        "password": "Password123!"
    })
    print("Student Login Status:", login_res.status_code)
    assert login_res.status_code == 200
    student_token = login_res.json()["access_token"]

    # 3. Register / Login Admin
    admin_email = "inproc_admin@example.com"
    client.post("/api/auth/register", json={
        "name": "InProc Admin",
        "email": admin_email,
        "password": "Password123!",
        "role": "admin"
    })
    login_admin = client.post("/api/auth/login", json={
        "email": admin_email,
        "password": "Password123!"
    })
    print("Admin Login Status:", login_admin.status_code)
    assert login_admin.status_code == 200
    admin_token = login_admin.json()["access_token"]

    # 4. Admin stats
    stats_res = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    print("Admin Stats Response:", stats_res.status_code, stats_res.json())
    assert stats_res.status_code == 200

    # 5. Student notifications
    notif_res = client.get("/api/notifications", headers={"Authorization": f"Bearer {student_token}"})
    print("Student Notifications Response:", notif_res.status_code, "Unread:", notif_res.json().get("unread_count"))
    assert notif_res.status_code == 200

    # 6. Google Auth Endpoint Validation Check
    empty_google = client.post("/api/auth/google", json={})
    print("Google Auth Empty Request:", empty_google.status_code)
    assert empty_google.status_code == 400

    invalid_google = client.post("/api/auth/google", json={"credential": "invalid_mock_token"})
    print("Google Auth Invalid Credential Request:", invalid_google.status_code)
    assert invalid_google.status_code == 401

    # 7. Clean up temporary test users so live database remains clean
    from app.db.mongodb import get_database
    db = get_database()
    await db.users.delete_one({"email": student_email})
    await db.users.delete_one({"email": admin_email})

    print("\n[OK] All In-Process Verification Tests Passed & Cleaned Up Cleanly!")

if __name__ == "__main__":
    asyncio.run(run_tests())
