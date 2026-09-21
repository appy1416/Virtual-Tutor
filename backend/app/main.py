import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from app.routes import auth, subjects, ai_tutor, quiz, study_tasks, courses, study, reference_materials, study_plans, classes, assignments, messages, notifications, faculty, admin, student, announcements
from app.routes.notifications import create_notification
from app.config import settings

async def study_plan_reminder_bg_loop():
    while True:
        try:
            await asyncio.sleep(60)
            db = get_database()
            if db is not None:
                # Find active study plans
                cursor = db.study_plans.find({"status": "active"})
                plans = await cursor.to_list(length=100)
                now_str = datetime.now().strftime("%Y-%m-%d")
                for p in plans:
                    st_id = p.get("student_id")
                    if st_id:
                        # Check if notification was already sent today for this plan
                        existing = await db.notifications.find_one({
                            "user_id": st_id,
                            "type": "planner",
                            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
                        })
                        if not existing:
                            subs = p.get("subjects", ["CSE Subject"])
                            sub_name = subs[0] if subs else "CSE Subject"
                            await create_notification(
                                user_id=st_id,
                                title=f"Study Session Reminder: {sub_name}",
                                message=f"Don't forget your scheduled study session for {sub_name} today ({p.get('study_time', '9:00 PM')}).",
                                notif_type="planner",
                                link="/planner"
                            )
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in study plan reminder loop: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    try:
        await subjects.seed_subjects_db()
    except Exception as e:
        print(f"Error seeding database: {e}")
        
    bg_task = asyncio.create_task(study_plan_reminder_bg_loop())
    yield
    bg_task.cancel()
    await close_mongo_connection()

app = FastAPI(
    title="Virtual AI Tutor API",
    description="Intelligent Personalized Learning Platform backend APIs with Student, Faculty, and Admin support",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS — allow all localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(subjects.router)
app.include_router(courses.router)
app.include_router(study.router)
app.include_router(ai_tutor.router)
app.include_router(quiz.router)
app.include_router(study_tasks.router)
app.include_router(reference_materials.router)
app.include_router(study_plans.router)
app.include_router(classes.router)
app.include_router(assignments.router)
app.include_router(messages.router)
app.include_router(notifications.router)
app.include_router(notifications.student_notif_router)
app.include_router(faculty.router)
app.include_router(admin.router)
app.include_router(student.router)
app.include_router(announcements.router)
app.include_router(announcements.faculty_announcements_router)
app.include_router(announcements.student_announcements_router)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Virtual AI Tutor"}

