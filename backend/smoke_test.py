import os
import sys
import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from bson import ObjectId

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ["JWT_SECRET"] = "test_secret_key_12345"
os.environ["MONGODB_DB_NAME"] = "test_tutor_db"
os.environ["GEMINI_API_KEY"] = "dummy_key"
os.environ["LLM_PROVIDER"] = "gemini"

class AsyncCursor:
    def __init__(self, data_list):
        self.data_list = data_list
    def sort(self, key, direction=1):
        try:
            self.data_list.sort(key=lambda x: x.get(key) or "")
        except Exception:
            pass
        return self
    async def to_list(self, length):
        return self.data_list

class MockCollection:
    def __init__(self):
        self.store = []
        
    async def find_one(self, query, projection=None):
        for item in self.store:
            match = True
            for k, v in query.items():
                item_val = item.get(k)
                if isinstance(item_val, ObjectId):
                    item_val = str(item_val)
                if isinstance(v, ObjectId):
                    v = str(v)
                if isinstance(v, dict) and "$in" in v:
                    if item_val not in v["$in"]:
                        match = False
                        break
                elif item_val != v:
                    match = False
                    break
            if match:
                return item.copy()
        return None

    async def count_documents(self, query):
        count = 0
        for item in self.store:
            match = True
            for k, v in query.items():
                item_val = item.get(k)
                if isinstance(item_val, ObjectId):
                    item_val = str(item_val)
                if isinstance(v, ObjectId):
                    v = str(v)
                if item_val != v:
                    match = False
                    break
            if match:
                count += 1
        return count

    async def insert_one(self, doc):
        doc = doc.copy()
        if "_id" not in doc:
            doc["_id"] = ObjectId()
        self.store.append(doc)
        class InsertResult:
            inserted_id = doc["_id"]
        return InsertResult()
        
    async def update_one(self, query, update, upsert=False):
        doc = None
        for item in self.store:
            match = True
            for k, v in query.items():
                item_val = item.get(k)
                if isinstance(item_val, ObjectId):
                    item_val = str(item_val)
                if isinstance(v, ObjectId):
                    v = str(v)
                if item_val != v:
                    match = False
                    break
            if match:
                doc = item
                break
                
        if not doc and upsert:
            doc = query.copy()
            doc["_id"] = ObjectId()
            self.store.append(doc)
            
        if doc:
            if "$push" in update:
                for k, v in update["$push"].items():
                    if k not in doc or not isinstance(doc[k], list):
                        doc[k] = []
                    doc[k].append(v)
            if "$set" in update:
                for k, v in update["$set"].items():
                    doc[k] = v
            if "$inc" in update:
                for k, v in update["$inc"].items():
                    doc[k] = doc.get(k, 0) + v
                    
        class UpdateResult:
            matched_count = 1 if doc else 0
            modified_count = 1 if doc else 0
        return UpdateResult()
        
    def find(self, query=None):
        if not query:
            return AsyncCursor([d.copy() for d in self.store])
        results = []
        for item in self.store:
            match = True
            if "$or" in query:
                or_match = False
                for cond in query["$or"]:
                    cond_match = True
                    for k, v in cond.items():
                        item_val = item.get(k)
                        if isinstance(item_val, ObjectId): item_val = str(item_val)
                        if isinstance(v, ObjectId): v = str(v)
                        if isinstance(item_val, list):
                            item_str_list = [str(x) for x in item_val]
                            if v not in item_str_list and str(v) not in item_str_list:
                                cond_match = False
                                break
                        elif item_val != v:
                            cond_match = False
                            break
                    if cond_match:
                        or_match = True
                        break
                if not or_match:
                    match = False
            else:
                for k, v in query.items():
                    item_val = item.get(k)
                    if isinstance(item_val, ObjectId):
                        item_val = str(item_val)
                    if isinstance(v, ObjectId):
                        v = str(v)
                    if isinstance(v, dict) and "$in" in v:
                        in_vals = [str(x) for x in v["$in"]]
                        if isinstance(item_val, list):
                            if not any(str(x) in in_vals for x in item_val):
                                match = False
                                break
                        elif item_val not in in_vals:
                            match = False
                            break
                    elif item_val != v:
                        match = False
                        break
            if match:
                results.append(item.copy())
        return AsyncCursor(results)


class MockDatabase:
    def __init__(self):
        self.collections = {}
    def __getattr__(self, name):
        if name not in self.collections:
            self.collections[name] = MockCollection()
        return self.collections[name]

from app.main import app
from app.db.mongodb import db_instance

class ExtendedBackendSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_db = MockDatabase()
        db_instance.client = AsyncMock()
        db_instance.db = cls.mock_db
        cls.client = TestClient(app)

    def test_01_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)

    def test_02_rbac_and_full_institutional_workflow(self):
        # 1. Register Admin, Faculty, Student
        admin_res = self.client.post("/api/auth/register", json={
            "name": "Super Admin", "email": "admin@platform.edu", "password": "adminpassword", "role": "admin"
        })
        fac_res = self.client.post("/api/auth/register", json={
            "name": "Prof. Alan", "email": "alan@faculty.edu", "password": "facpassword", "role": "faculty"
        })
        stud_res = self.client.post("/api/auth/register", json={
            "name": "Alice Student", "email": "alice@student.edu", "password": "studpassword", "role": "student"
        })
        self.assertEqual(admin_res.status_code, 201)
        self.assertEqual(fac_res.status_code, 201)
        self.assertEqual(stud_res.status_code, 201)

        admin_id = admin_res.json()["id"]
        fac_id = fac_res.json()["id"]
        stud_id = stud_res.json()["id"]

        # Login tokens
        admin_token = self.client.post("/api/auth/login", json={"email": "admin@platform.edu", "password": "adminpassword"}).json()["access_token"]
        fac_token = self.client.post("/api/auth/login", json={"email": "alan@faculty.edu", "password": "facpassword"}).json()["access_token"]
        stud_token = self.client.post("/api/auth/login", json={"email": "alice@student.edu", "password": "studpassword"}).json()["access_token"]

        # 2. Test RBAC: Student cannot access Admin API
        forbidden_res = self.client.get("/api/admin/stats", headers={"Authorization": f"Bearer {stud_token}"})
        self.assertEqual(forbidden_res.status_code, 403)

        # Admin creates class section
        class_res = self.client.post(
            "/api/classes",
            json={"name": "CSE 301 - Databases", "code": "CSE301", "faculty_id": fac_id, "student_ids": [stud_id]},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(class_res.status_code, 201)
        class_id = class_res.json()["id"]

        # Faculty creates assignment
        asg_res = self.client.post(
            "/api/assignments",
            data={
                "title": "SQL Normalization Homework",
                "description": "Solve 3NF exercises",
                "subject_id": str(ObjectId()),
                "topic_id": str(ObjectId()),
                "class_id": class_id,
                "due_date": "2026-09-01",
                "total_marks": "100"
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        self.assertEqual(asg_res.status_code, 201)
        asg_id = asg_res.json()["id"]

        # Student checks assigned homework
        stud_asg = self.client.get("/api/assignments", headers={"Authorization": f"Bearer {stud_token}"})
        self.assertEqual(stud_asg.status_code, 200)

        # Student submits homework
        sub_res = self.client.post(
            f"/api/assignments/{asg_id}/submit",
            data={"notes": "Completed 3NF decomposition."},
            headers={"Authorization": f"Bearer {stud_token}"}
        )
        self.assertEqual(sub_res.status_code, 200)
        sub_id = sub_res.json()["id"]

        # Faculty grades submission
        grade_res = self.client.post(
            f"/api/assignments/submissions/{sub_id}/grade",
            data={"marks": "95.0", "feedback": "Excellent work!"},
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        self.assertEqual(grade_res.status_code, 200)
        self.assertEqual(grade_res.json()["marks_obtained"], 95.0)

        # Faculty creates manual quiz
        quiz_res = self.client.post(
            "/api/quiz/faculty/create",
            json={
                "title": "DBMS Quiz 1",
                "subject_id": str(ObjectId()),
                "topic_id": str(ObjectId()),
                "class_id": class_id,
                "duration_minutes": 20,
                "questions": [
                    {"id": "q1", "type": "mcq", "question_text": "What does 3NF stand for?", "options": ["3rd Normal Form", "3rd Network Function", "3", "None"], "correct_answer": "0", "marks": 10.0}
                ]
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        self.assertEqual(quiz_res.status_code, 201)

        # Messaging Student -> Faculty
        msg_res = self.client.post(
            "/api/messages/send",
            data={"receiver_id": fac_id, "message_text": "Hello Professor, I have a question on B-Trees."},
            headers={"Authorization": f"Bearer {stud_token}"}
        )
        self.assertEqual(msg_res.status_code, 200)

        # Notifications check for Faculty
        notif_res = self.client.get("/api/notifications", headers={"Authorization": f"Bearer {fac_token}"})
        self.assertEqual(notif_res.status_code, 200)

        # Admin stats overview
        stats_res = self.client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(stats_res.status_code, 200)

    @patch("app.services.llm_service.LLMService.generate_text")
    def test_03_ai_tutor_and_youtube_resources(self, mock_llm_text):
        stud_token = self.client.post("/api/auth/login", json={"email": "alice@student.edu", "password": "studpassword"}).json()["access_token"]

        mock_llm_text.return_value = '{"explanation": "B-Trees are balanced search trees.", "example": "B-Tree degree t=2", "important_points": ["Self-balancing", "Disk friendly"]}'

        ai_res = self.client.post(
            "/api/ai-tutor/ask",
            json={"question": "Explain B-Trees in Data Structures"},
            headers={"Authorization": f"Bearer {stud_token}"}
        )
        self.assertEqual(ai_res.status_code, 200)
        self.assertIn("youtube_resources", ai_res.json())
        self.assertTrue(len(ai_res.json()["youtube_resources"]) > 0)
        self.assertIn("https://www.youtube.com", ai_res.json()["youtube_resources"][0]["url"])

    def test_04_case_insensitive_and_legacy_login(self):
        res = self.client.post("/api/auth/login", json={"email": " ALICE@STUDENT.EDU  ", "password": "studpassword"})
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.json())

    def test_05_google_oauth_workflow(self):
        from unittest.mock import MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "email": "google_student@platform.edu",
            "name": "Google Student",
            "picture": "https://example.com/avatar.png"
        }
        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            res = self.client.post("/api/auth/google", json={"credential": "mock_google_id_token"})
            self.assertEqual(res.status_code, 200)
            self.assertIn("access_token", res.json())
            self.assertEqual(res.json()["role"], "student")

if __name__ == "__main__":
    unittest.main()
