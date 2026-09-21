from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.services.rag_service import query_rag_doubt
from app.services.ocr_service import OCRService
from app.services.voice_service import VoiceService
from app.db.mongodb import get_database
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
import uuid
from bson import ObjectId

router = APIRouter(prefix="/api/study", tags=["study"])

# Request models
class DoubtRequest(BaseModel):
    query: str
    subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    subtopic: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    course_id: Optional[str] = None

class TaskCompleteRequest(BaseModel):
    duration_minutes: int

@router.post("/doubt")
async def solve_doubt(
    req: DoubtRequest,
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    student_id = current_user["id"]
    target_id = req.subject_id or req.topic_id or req.course_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Must provide subject_id, topic_id, or course_id")
        
    db = get_database()
    subject_name = req.subject
    topic_name = req.topic
    
    if req.subject_id:
        if ObjectId.is_valid(req.subject_id):
            sub_doc = await db.subjects.find_one({"_id": ObjectId(req.subject_id)})
            if sub_doc:
                subject_name = sub_doc.get("name", subject_name)
        if not subject_name:
            sub_doc = await db.subjects.find_one({"$or": [{"name": req.subject_id}, {"code": req.subject_id}]})
            if sub_doc:
                subject_name = sub_doc.get("name")
                
    if req.topic_id:
        if ObjectId.is_valid(req.topic_id):
            top_doc = await db.topics.find_one({"_id": ObjectId(req.topic_id)})
            if top_doc:
                topic_name = top_doc.get("name", topic_name)
        if not topic_name:
            top_doc = await db.topics.find_one({"name": req.topic_id})
            if top_doc:
                topic_name = top_doc.get("name")
                
    result = await query_rag_doubt(
        student_id=student_id, 
        course_id=target_id, 
        query=req.query,
        subject_name=subject_name,
        topic_name=topic_name,
        subtopic=req.subtopic
    )
    return result

@router.post("/ocr")
async def solve_ocr(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    # Verify image mime type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")
        
    image_bytes = await file.read()
    result = await OCRService.extract_and_solve(image_bytes, file.content_type)
    return result

@router.post("/voice-doubt")
async def solve_voice_doubt(
    course_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    # Verify audio file
    if not file.content_type.startswith("audio/") and not file.filename.endswith((".wav", ".mp3", ".webm", ".ogg", ".m4a")):
        raise HTTPException(status_code=400, detail="Uploaded file must be an audio file")
        
    audio_bytes = await file.read()
    
    # 1. Speech-to-Text: transcribe query
    query_text = await VoiceService.speech_to_text(audio_bytes, file.content_type)
    print(f"Transcribed Student Audio Query: {query_text}")
    
    if query_text.startswith("[Error") or not query_text.strip():
        raise HTTPException(status_code=400, detail=f"Speech transcription failed: {query_text}")
        
    # 2. RAG Doubt Solving
    student_id = current_user["id"]
    rag_result = await query_rag_doubt(student_id, course_id, query_text)
    response_text = rag_result["response"]
    
    # 3. Text-to-Speech: synthesize voice answer
    audio_url = VoiceService.text_to_speech(response_text)
    
    return {
        "query_text": query_text,
        "response_text": response_text,
        "audio_url": audio_url,
        "citations": rag_result["citations"]
    }

@router.get("/planner")
async def get_or_create_daily_planner(
    course_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    """
    Returns the student's study plan for today.
    If none exists, it generates it based on unmastered concepts and course materials.
    """
    db = get_database()
    student_id = current_user["id"]
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Try fetching existing plan
    plan = await db.study_plans.find_one({
        "student_id": ObjectId(student_id),
        "course_id": ObjectId(course_id),
        "date": today_str
    })
    
    if plan:
        return serialize_doc(plan)
        
    # Generate new plan
    print(f"Generating study plan for student {student_id} on {today_str}")
    
    # 1. Fetch student progress
    progress = await db.user_progress.find_one({
        "student_id": ObjectId(student_id),
        "course_id": ObjectId(course_id)
    })
    
    # 2. Fetch course materials to recommend
    cursor = db.materials.find({"course_id": course_id})
    materials = await cursor.to_list(length=10)
    
    tasks = []
    
    # Simple rule-based planner:
    # Look for weak topics in user progress
    weak_topics = []
    if progress and "topics" in progress:
        for topic_name, topic_data in progress["topics"].items():
            if topic_data.get("mastery_probability", 0.0) < 0.75:
                weak_topics.append(topic_name)
                
    if weak_topics:
        # Assign revision task for a weak topic
        weak_topic = weak_topics[0]
        recommended_mat = None
        for m in materials:
            # Match material title with topic if possible
            if weak_topic.lower() in m.get("title", "").lower():
                recommended_mat = str(m["_id"])
                break
        if not recommended_mat and materials:
            recommended_mat = str(materials[0]["_id"])
            
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "description": f"Revise unmastered topic: {weak_topic}",
            "topic": weak_topic,
            "allocated_minutes": 30,
            "completed": False,
            "recommended_material": recommended_mat
        })
    else:
        # No weak topics, assign general study task or progress to next lesson
        recommended_mat = str(materials[0]["_id"]) if materials else None
        tasks.append({
            "task_id": str(uuid.uuid4()),
            "description": "Read introductory course notes and summaries",
            "topic": "Introduction",
            "allocated_minutes": 20,
            "completed": False,
            "recommended_material": recommended_mat
        })
        
    # Add a quiz task
    tasks.append({
        "task_id": str(uuid.uuid4()),
        "description": "Take a practice quiz to verify topic mastery",
        "topic": tasks[0]["topic"],
        "allocated_minutes": 15,
        "completed": False,
        "recommended_material": None
    })
    
    new_plan = {
        "student_id": ObjectId(student_id),
        "course_id": ObjectId(course_id),
        "date": today_str,
        "tasks": tasks,
        "daily_study_time_seconds": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.study_plans.insert_one(new_plan)
    new_plan["_id"] = result.inserted_id
    
    return serialize_doc(new_plan)

@router.post("/planner/task/{task_id}/complete")
async def complete_planner_task(
    course_id: str,
    task_id: str,
    req: TaskCompleteRequest,
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    db = get_database()
    student_id = current_user["id"]
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    plan = await db.study_plans.find_one({
        "student_id": ObjectId(student_id),
        "course_id": ObjectId(course_id),
        "date": today_str
    })
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan for today not found")
        
    tasks = plan.get("tasks", [])
    task_found = False
    
    for task in tasks:
        if task["task_id"] == task_id:
            task["completed"] = True
            task_found = True
            break
            
    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found in daily plan")
        
    added_seconds = req.duration_minutes * 60
    
    await db.study_plans.update_one(
        {"_id": plan["_id"]},
        {
            "$set": {"tasks": tasks},
            "$inc": {"daily_study_time_seconds": added_seconds}
        }
    )
    
    # Log analytics event for study session
    await db.analytics_events.insert_one({
        "user_id": ObjectId(student_id),
        "event_type": "study_session",
        "metadata": {
            "course_id": course_id,
            "duration_seconds": added_seconds,
            "task_id": task_id
        },
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"message": "Task marked as completed", "total_study_time_seconds": plan.get("daily_study_time_seconds", 0) + added_seconds}
