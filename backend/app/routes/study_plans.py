from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import get_current_user, serialize_doc
from app.db.mongodb import get_database
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
from bson import ObjectId

router = APIRouter(prefix="/api/study-plans", tags=["study-plans"])

class PlanGenerateRequest(BaseModel):
    subjects: List[str]
    topics: List[str]
    exam_date: str
    available_hours_per_day: float = 2.0
    preferred_session_duration: Optional[int] = None
    session_duration_minutes: Optional[int] = None
    priority: str = "medium"
    study_time: Optional[str] = "9:00 PM"

class TaskCompleteRequest(BaseModel):
    duration_minutes: int

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_study_plan(
    req: PlanGenerateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    student_id = current_user["id"]
    sess_duration = req.session_duration_minutes or req.preferred_session_duration or 45
    
    # 1. Fetch user analytics to personalize
    cursor = db.quiz_results.find({"user_id": ObjectId(student_id)})
    quiz_results = await cursor.to_list(length=100)
    
    # Identify unmastered/weak topics
    weak_topics = []
    topic_scores = {}
    for r in quiz_results:
        t_id = str(r.get("topic_id", ""))
        score = r.get("score", 0)
        if t_id:
            topic_scores[t_id] = min(topic_scores.get(t_id, 5), score)
        
    for t_id, score in topic_scores.items():
        if score < 4 and ObjectId.is_valid(t_id):
            topic = await db.topics.find_one({"_id": ObjectId(t_id)})
            if topic:
                weak_topics.append(topic["name"])
                
    # 2. Formulate tasks dynamically based on selected subjects/topics and weak areas
    tasks = []
    
    # Revision tasks
    for sub in req.subjects[:3]:  # Limit to top 3 subjects
        for topic_name in req.topics:
            topic = await db.topics.find_one({"name": topic_name})
            if topic:
                subject = await db.subjects.find_one({"_id": topic["subject_id"]})
                if subject and subject["name"].lower() == sub.lower():
                    is_weak = topic_name in weak_topics
                    allocated = sess_duration
                    tasks.append({
                        "task_id": str(uuid.uuid4()),
                        "subject": sub,
                        "topic": topic_name,
                        "description": f"{'Revise weak area:' if is_weak else 'Study core concepts of'} {topic_name}",
                        "duration_minutes": allocated,
                        "completed": False,
                        "is_weak": is_weak
                    })
                    
    # Quiz checking tasks
    for sub in req.subjects[:2]:
        for topic_name in req.topics:
            topic = await db.topics.find_one({"name": topic_name})
            if topic:
                subject = await db.subjects.find_one({"_id": topic["subject_id"]})
                if subject and subject["name"].lower() == sub.lower():
                    tasks.append({
                        "task_id": str(uuid.uuid4()),
                        "subject": sub,
                        "topic": topic_name,
                        "description": f"Take a practice quiz on {topic_name} subtopics",
                        "duration_minutes": 15,
                        "completed": False,
                        "is_weak": False
                    })
                    break  # limit quiz task to 1 per subject
                    
    # Default fallback task if no tasks were generated
    if not tasks:
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "subject": req.subjects[0] if req.subjects else "General",
            "topic": req.topics[0] if req.topics else "Overview",
            "description": "Read through curriculum outlines and introductory syllabus notes",
            "duration_minutes": 30,
            "completed": False,
            "is_weak": False
        })
        
    # 3. Save new plan to MongoDB (archive previous plan)
    st_obj_id = ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id
    await db.study_plans.update_many(
        {"$or": [{"student_id": st_obj_id}, {"student_id": str(student_id)}], "status": "active"},
        {"$set": {"status": "archived"}}
    )
    
    plan_doc = {
        "student_id": st_obj_id,
        "subjects": req.subjects,
        "topics": req.topics,
        "exam_date": req.exam_date,
        "study_time": req.study_time or "9:00 PM",
        "available_hours_per_day": req.available_hours_per_day,
        "preferred_session_duration": sess_duration,
        "session_duration_minutes": sess_duration,
        "priority": req.priority,
        "tasks": tasks,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "completed_at": None,
        "daily_study_time_seconds": 0
    }
    
    result = await db.study_plans.insert_one(plan_doc)
    plan_doc["_id"] = result.inserted_id

    # Create real MongoDB study reminder notification
    from app.routes.notifications import create_notification
    first_subject = req.subjects[0] if req.subjects else "CSE Subject"
    first_topic = req.topics[0] if req.topics else "Normalization"
    time_str = req.study_time or "9:00 PM"
    
    await create_notification(
        user_id=student_id,
        title=f"Study Reminder: {first_subject}",
        message=f"Study {first_subject} – {first_topic} at {time_str}.",
        notif_type="planner",
        link="/planner"
    )
    
    return serialize_doc(plan_doc)

@router.get("/active")
async def get_active_study_plan(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    student_id = current_user["id"]
    
    # Fetch active plan
    plan = await db.study_plans.find_one({
        "student_id": ObjectId(student_id),
        "status": "active"
    })
    
    if not plan:
        # Fallback to search latest created plan
        plans = await db.study_plans.find(
            {"student_id": ObjectId(student_id)}
        ).sort("created_at", -1).to_list(length=1)
        plan = plans[0] if plans else None
        if plan:
            # Set to active
            await db.study_plans.update_one({"_id": plan["_id"]}, {"$set": {"status": "active"}})
            
    if not plan:
        return None
        
    return serialize_doc(plan)

@router.post("/{plan_id}/tasks/{task_id}/complete")
async def complete_study_plan_task(
    plan_id: str,
    task_id: str,
    req: TaskCompleteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    student_id = current_user["id"]
    
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(status_code=400, detail="Invalid plan ID format")
        
    plan = await db.study_plans.find_one({"_id": ObjectId(plan_id), "student_id": ObjectId(student_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
        
    tasks = plan.get("tasks", [])
    task_found = False
    
    for task in tasks:
        if task["task_id"] == task_id:
            task["completed"] = True
            task_found = True
            break
            
    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found in study plan")
        
    added_seconds = req.duration_minutes * 60
    all_completed = all(t.get("completed", False) for t in tasks)
    
    update_fields = {"tasks": tasks}
    if all_completed:
        update_fields["completed_at"] = datetime.now(timezone.utc)
        
    await db.study_plans.update_one(
        {"_id": plan["_id"]},
        {
            "$set": update_fields,
            "$inc": {"daily_study_time_seconds": added_seconds}
        }
    )
    
    # Log analytics event to update streaks and charts
    await db.analytics_events.insert_one({
        "user_id": ObjectId(student_id),
        "event_type": "study_session",
        "metadata": {
            "plan_id": plan_id,
            "task_id": task_id,
            "duration_seconds": added_seconds
        },
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {
        "message": "Task marked complete",
        "completed": True,
        "all_tasks_completed": all_completed
    }

@router.delete("/{plan_id}")
async def delete_study_plan(plan_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    student_id = current_user["id"]
    st_obj = ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id
    
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(status_code=400, detail="Invalid plan ID format")
        
    res = await db.study_plans.delete_one({"_id": ObjectId(plan_id), "$or": [{"student_id": st_obj}, {"student_id": str(student_id)}]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Study plan not found")
        
    return {"message": "Study plan deleted successfully"}

# ==================== STUDENT STUDY PLAN ALIASES ====================

@router.get("", tags=["study-plans"])
@router.get("/student/list", tags=["study-plans"])
async def list_student_study_plans(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    plans = await db.study_plans.find({"$or": [{"student_id": st_obj}, {"student_id": str(st_id)}]}).sort("created_at", -1).to_list(length=100)
    return [serialize_doc(p) for p in plans]

@router.post("", status_code=status.HTTP_201_CREATED, tags=["study-plans"])
async def create_student_study_plan(payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    
    doc = {
        "student_id": st_obj,
        "subjects": payload.get("subjects", []),
        "topics": payload.get("topics", []),
        "exam_date": payload.get("exam_date"),
        "study_time": payload.get("study_time", "9:00 PM"),
        "available_hours_per_day": payload.get("available_hours_per_day", 2.0),
        "preferred_session_duration": payload.get("preferred_session_duration", 45),
        "priority": payload.get("priority", "balanced"),
        "tasks": payload.get("tasks", []),
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "completed_at": None,
        "daily_study_time_seconds": 0
    }
    res = await db.study_plans.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    from app.routes.notifications import create_notification
    first_sub = payload.get("subjects", ["CSE"])[0] if payload.get("subjects") else "Subject"
    await create_notification(
        user_id=st_id,
        title=f"Study Reminder: {first_sub}",
        message=f"Scheduled session for {first_sub} at {payload.get('study_time', '9:00 PM')}.",
        notif_type="planner",
        link="/planner"
    )
    return serialize_doc(doc)

@router.put("/{plan_id}", tags=["study-plans"])
async def update_student_study_plan(plan_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(status_code=400, detail="Invalid plan ID format")
    await db.study_plans.update_one({"_id": ObjectId(plan_id)}, {"$set": payload})
    updated = await db.study_plans.find_one({"_id": ObjectId(plan_id)})
    return serialize_doc(updated)

