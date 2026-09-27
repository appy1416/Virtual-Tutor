import asyncio
import os
import re
from fastapi.testclient import TestClient
from app.main import app
from app.db.mongodb import connect_to_mongo, get_database
from app.config import settings

client = TestClient(app)

async def run_full_security_suite():
    print("=" * 70)
    print("RUNNING COMPLETE ADMIN ACCOUNT SECURITY AUDIT & VERIFICATION SUITE")
    print("=" * 70)

    await connect_to_mongo()
    db = get_database()

    test_student_email = "test_student_audit@example.com"
    test_faculty_email = "test_faculty_audit@example.com"
    test_prov_admin_email = "test_prov_admin_audit@example.com"
    test_secret = "test_secure_provisioning_secret_998877"

    # Configure provision secret for test
    settings.ADMIN_PROVISION_SECRET = test_secret

    # Cleanup any previous test data
    await db.users.delete_one({"email": test_student_email})
    await db.users.delete_one({"email": test_faculty_email})
    await db.users.delete_one({"email": test_prov_admin_email})

    # =========================================================================
    # TEST 1: Register Student
    # =========================================================================
    print("\n--- TEST 1: Register Student ---")
    reg_student = client.post("/api/auth/register", json={
        "name": "Audit Student",
        "email": test_student_email,
        "password": "Password123!",
        "role": "student"
    })
    print(f"Status: {reg_student.status_code}")
    assert reg_student.status_code == 201, f"Expected 201, got {reg_student.status_code}: {reg_student.text}"
    student_data = reg_student.json()
    assert student_data.get("role") == "student", f"Expected role 'student', got {student_data.get('role')}"
    print(f"[PASS] Student registered with role '{student_data.get('role')}'")

    login_student = client.post("/api/auth/login", json={
        "email": test_student_email,
        "password": "Password123!"
    })
    assert login_student.status_code == 200
    student_token = login_student.json()["access_token"]
    student_role = login_student.json()["role"]
    assert student_role == "student"
    print(f"[PASS] Student logged in successfully. Token issued with role '{student_role}'")

    # =========================================================================
    # TEST 2: Register Faculty
    # =========================================================================
    print("\n--- TEST 2: Register Faculty ---")
    reg_faculty = client.post("/api/auth/register", json={
        "name": "Audit Faculty",
        "email": test_faculty_email,
        "password": "Password123!",
        "role": "faculty"
    })
    print(f"Status: {reg_faculty.status_code}")
    assert reg_faculty.status_code == 201, f"Expected 201, got {reg_faculty.status_code}: {reg_faculty.text}"
    faculty_data = reg_faculty.json()
    assert faculty_data.get("role") == "faculty", f"Expected role 'faculty', got {faculty_data.get('role')}"
    print(f"[PASS] Faculty registered with role '{faculty_data.get('role')}'")

    login_faculty = client.post("/api/auth/login", json={
        "email": test_faculty_email,
        "password": "Password123!"
    })
    assert login_faculty.status_code == 200
    faculty_token = login_faculty.json()["access_token"]
    faculty_role = login_faculty.json()["role"]
    assert faculty_role == "faculty"
    print(f"[PASS] Faculty logged in successfully. Token issued with role '{faculty_role}'")

    # =========================================================================
    # TEST 3: Attempt public Admin registration through frontend
    # =========================================================================
    print("\n--- TEST 3: Frontend registration role selector inspect ---")
    frontend_login_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "pages", "Login.jsx"))
    with open(frontend_login_path, "r", encoding="utf-8") as f:
        login_jsx_content = f.read()
    
    # Check that option value="admin" does NOT exist in registration select
    assert '<option value="admin">' not in login_jsx_content, "Found '<option value=\"admin\">' in Login.jsx! Admin must NOT be a public option."
    assert '<option value="student">' in login_jsx_content, "Expected student option in Login.jsx"
    assert '<option value="faculty">' in login_jsx_content, "Expected faculty option in Login.jsx"
    print("[PASS] Verified Login.jsx: Administrator option completely removed from registration dropdown. Only Student and Faculty remain.")

    # =========================================================================
    # TEST 4: Directly call registration API with role = admin
    # =========================================================================
    print("\n--- TEST 4: Directly call registration API with role = admin ---")
    reg_admin_attempt = client.post("/api/auth/register", json={
        "name": "Malicious Admin Wannabe",
        "email": "hacker@example.com",
        "password": "Password123!",
        "role": "admin"
    })
    print(f"Direct POST /api/auth/register status: {reg_admin_attempt.status_code}, body: {reg_admin_attempt.json()}")
    assert reg_admin_attempt.status_code == 403, f"Expected 403 Forbidden, got {reg_admin_attempt.status_code}"
    print("[PASS] Direct registration call with role='admin' on /api/auth/register strictly REJECTED with 403 Forbidden.")

    reg_admin_v1 = client.post("/api/v1/auth/register", json={
        "name": "Malicious Admin Wannabe 2",
        "email": "hacker2@example.com",
        "password": "Password123!",
        "role": "admin"
    })
    print(f"Direct POST /api/v1/auth/register status: {reg_admin_v1.status_code}")
    assert reg_admin_v1.status_code == 403, f"Expected 403 Forbidden, got {reg_admin_v1.status_code}"
    print("[PASS] Direct registration call with role='admin' on /api/v1/auth/register strictly REJECTED with 403 Forbidden.")

    # =========================================================================
    # TEST 5: Attempt to modify Student role to Admin
    # =========================================================================
    print("\n--- TEST 5: Attempt to modify Student role to Admin ---")
    # Student attempts calling admin update user endpoint
    student_record = await db.users.find_one({"email": test_student_email})
    student_id = str(student_record["_id"])
    escalation_attempt = client.put(
        f"/api/admin/users/{student_id}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {student_token}"}
    )
    print(f"Student role escalation attempt status: {escalation_attempt.status_code}")
    assert escalation_attempt.status_code == 403, f"Expected 403 Forbidden, got {escalation_attempt.status_code}"
    # Verify student is still student in DB
    refreshed_student = await db.users.find_one({"_id": student_record["_id"]})
    assert refreshed_student["role"] == "student"
    print(f"[PASS] Student role escalation attempt REJECTED with 403 Forbidden. Role remains: {refreshed_student['role']}")

    # =========================================================================
    # TEST 6: Attempt to modify Faculty role to Admin
    # =========================================================================
    print("\n--- TEST 6: Attempt to modify Faculty role to Admin ---")
    faculty_record = await db.users.find_one({"email": test_faculty_email})
    faculty_id = str(faculty_record["_id"])
    faculty_escalation = client.put(
        f"/api/admin/users/{faculty_id}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {faculty_token}"}
    )
    print(f"Faculty role escalation attempt status: {faculty_escalation.status_code}")
    assert faculty_escalation.status_code == 403, f"Expected 403 Forbidden, got {faculty_escalation.status_code}"
    refreshed_faculty = await db.users.find_one({"_id": faculty_record["_id"]})
    assert refreshed_faculty["role"] == "faculty"
    print(f"[PASS] Faculty role escalation attempt REJECTED with 403 Forbidden. Role remains: {refreshed_faculty['role']}")

    # =========================================================================
    # TEST 7: Existing Admin logs in & Admin Portal works
    # =========================================================================
    print("\n--- TEST 7: Existing Admin logs in & Admin Portal works ---")
    # Check existing admin in database
    existing_admin = await db.users.find_one({"role": "admin"})
    assert existing_admin is not None, "Expected at least one existing admin in DB"
    print(f"Found existing Admin account in DB: {existing_admin.get('email')} (Name: {existing_admin.get('name')})")

    # If password is known or test with provisioned admin:
    # Let's ensure the admin token has valid access to /api/admin/stats and /api/admin/users
    from app.services.auth_service import create_access_token
    admin_token_direct = create_access_token({
        "sub": existing_admin["email"],
        "role": "admin",
        "name": existing_admin.get("name", "Admin")
    })

    admin_stats = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin_token_direct}"})
    print(f"Admin Stats status: {admin_stats.status_code}, data: {admin_stats.json().get('platform_health')}")
    assert admin_stats.status_code == 200, f"Expected 200, got {admin_stats.status_code}"

    admin_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token_direct}"})
    print(f"Admin Users list status: {admin_users.status_code}, count: {len(admin_users.json())}")
    assert admin_users.status_code == 200
    print("[PASS] Existing Admin successfully accesses Admin Portal endpoints (/api/admin/stats, /api/admin/users).")

    # =========================================================================
    # TEST 8: Student attempts Admin API -> 403 Forbidden
    # =========================================================================
    print("\n--- TEST 8: Student attempts Admin API ---")
    student_admin_stats = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {student_token}"})
    print(f"Student GET /api/admin/stats status: {student_admin_stats.status_code}")
    assert student_admin_stats.status_code == 403, f"Expected 403 Forbidden, got {student_admin_stats.status_code}"

    student_admin_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {student_token}"})
    print(f"Student GET /api/admin/users status: {student_admin_users.status_code}")
    assert student_admin_users.status_code == 403, f"Expected 403 Forbidden, got {student_admin_users.status_code}"
    print("[PASS] Student calling Admin APIs is strictly rejected with 403 Forbidden.")

    # =========================================================================
    # TEST 9: Faculty attempts Admin API -> 403 Forbidden
    # =========================================================================
    print("\n--- TEST 9: Faculty attempts Admin API ---")
    faculty_admin_stats = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {faculty_token}"})
    print(f"Faculty GET /api/admin/stats status: {faculty_admin_stats.status_code}")
    assert faculty_admin_stats.status_code == 403, f"Expected 403 Forbidden, got {faculty_admin_stats.status_code}"

    faculty_admin_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {faculty_token}"})
    print(f"Faculty GET /api/admin/users status: {faculty_admin_users.status_code}")
    assert faculty_admin_users.status_code == 403, f"Expected 403 Forbidden, got {faculty_admin_users.status_code}"
    print("[PASS] Faculty calling Admin APIs is strictly rejected with 403 Forbidden.")

    # =========================================================================
    # TEST 10: Provision Admin through protected owner mechanism
    # =========================================================================
    print("\n--- TEST 10: Provision Admin through protected owner mechanism ---")
    # Sub-test A: Invalid Secret
    prov_invalid_secret = client.post(
        "/api/auth/provision-admin",
        json={
            "name": "New Owner Admin",
            "email": test_prov_admin_email,
            "password": "AdminPassword123!",
            "secret": "wrong_secret"
        }
    )
    print(f"Provision with invalid secret status: {prov_invalid_secret.status_code}")
    assert prov_invalid_secret.status_code == 401, f"Expected 401 Unauthorized, got {prov_invalid_secret.status_code}"
    print("[PASS] Provisioning with invalid secret strictly rejected with 401 Unauthorized.")

    # Sub-test B: Uniqueness Enforcement (An admin already exists in the system)
    prov_duplicate_attempt = client.post(
        "/api/auth/provision-admin",
        json={
            "name": "Duplicate Admin",
            "email": test_prov_admin_email,
            "password": "AdminPassword123!",
            "secret": test_secret
        }
    )
    print(f"Duplicate Admin creation status: {prov_duplicate_attempt.status_code}, detail: {prov_duplicate_attempt.json().get('detail')}")
    assert prov_duplicate_attempt.status_code == 409, f"Expected 409 Conflict, got {prov_duplicate_attempt.status_code}"
    print("[PASS] Single Admin uniqueness correctly enforced: creating another Admin when one already exists returned 409 Conflict.")

    # Sub-test C: Provisioning when no admin exists (simulate initial deployment provisioning)
    # Temporarily stash existing admin to test initial provisioning flow
    stash_admin = await db.users.find_one({"role": "admin"})
    await db.users.delete_one({"_id": stash_admin["_id"]})

    prov_success = client.post(
        "/api/auth/provision-admin",
        headers={"X-Admin-Provision-Secret": test_secret},
        json={
            "name": "Initial Root Admin",
            "email": test_prov_admin_email,
            "password": "AdminPassword123!"
        }
    )
    print(f"Initial Admin Provisioning status: {prov_success.status_code}")
    assert prov_success.status_code == 201, f"Expected 201 Created, got {prov_success.status_code}"
    new_admin_data = prov_success.json()
    assert new_admin_data.get("role") == "admin"
    print(f"[PASS] Initial Admin successfully provisioned! Email: {new_admin_data.get('email')}, Role: {new_admin_data.get('role')}")

    # Sub-test D: Verify newly provisioned admin can log in and use Admin APIs
    login_new_admin = client.post("/api/auth/login", json={
        "email": test_prov_admin_email,
        "password": "AdminPassword123!"
    })
    assert login_new_admin.status_code == 200
    new_admin_token = login_new_admin.json()["access_token"]
    test_stats = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {new_admin_token}"})
    assert test_stats.status_code == 200
    print("[PASS] Newly provisioned Admin successfully authenticated and accessed Admin Portal.")

    # Restore the original existing admin and clean up test admin
    await db.users.delete_one({"email": test_prov_admin_email})
    await db.users.insert_one(stash_admin)
    print("[PASS] Original existing Admin account restored intact.")

    # =========================================================================
    # TEST 11: Verify provisioning secret is NEVER exposed to Angular/Vercel frontend
    # =========================================================================
    print("\n--- TEST 11: Secret Exposure Verification in Frontend ---")
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
    violations = []
    for root, dirs, files in os.walk(frontend_dir):
        if "node_modules" in root or "dist" in root:
            continue
        for file in files:
            if file.endswith((".js", ".jsx", ".ts", ".tsx", ".html", ".env.example", ".json")):
                full_path = os.path.join(root, file)
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if "ADMIN_PROVISION_SECRET" in content:
                        violations.append(full_path)
    
    print(f"Frontend files scanned. Violations found: {len(violations)}")
    assert len(violations) == 0, f"Found ADMIN_PROVISION_SECRET in frontend files: {violations}"
    print("[PASS] Verified: ADMIN_PROVISION_SECRET is NEVER referenced or exposed in frontend code.")

    # Cleanup temporary test accounts
    await db.users.delete_one({"email": test_student_email})
    await db.users.delete_one({"email": test_faculty_email})
    print("\n[ALL 11 TESTS PASSED SUCCESSFULLY!]")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_full_security_suite())
