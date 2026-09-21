import asyncio
import httpx
import time

async def main():
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=30.0) as client:
        test_email = f"student_{int(time.time())}@example.com"
        reg_res = await client.post("/api/auth/register", json={
            "name": "Test Student",
            "email": test_email,
            "password": "Password123!",
            "role": "student"
        })
        
        login_res = await client.post("/api/auth/login", json={
            "email": test_email,
            "password": "Password123!"
        })
        
        if login_res.status_code != 200:
            print(f"Login failed: {login_res.status_code} - {login_res.text}")
            return

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get subjects
        subj_res = await client.get("/api/subjects", headers=headers)
        print(f"Subjects status: {subj_res.status_code}")
        subjects = subj_res.json()
        print(f"Loaded {len(subjects)} subjects.")
        if not subjects:
            print("No subjects returned!")
            return

        subj_id = subjects[0]["id"]
        subj_name = subjects[0]["name"]
        print(f"First subject: {subj_name} (ID: {subj_id})")

        # Get topics
        topic_res = await client.get(f"/api/subjects/{subj_id}/topics", headers=headers)
        print(f"Topics status: {topic_res.status_code}")
        topics = topic_res.json()
        print(f"Loaded {len(topics)} topics.")
        if not topics:
            print("No topics returned!")
            return

        topic_id = topics[0]["id"]
        topic_name = topics[0]["name"]
        print(f"First topic: {topic_name} (ID: {topic_id})")

        # Call quiz generate
        print("\nTesting POST /api/quiz/generate ...")
        gen_res = await client.post("/api/quiz/generate", json={
            "subject_id": subj_id,
            "topic_id": topic_id,
            "difficulty": "easy",
            "question_type": "MCQ",
            "count": 5
        }, headers=headers)

        print(f"Generate Quiz status code: {gen_res.status_code}")
        print(f"Generate Quiz response: {gen_res.text[:400]}")

if __name__ == "__main__":
    asyncio.run(main())
