from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import get_current_user, serialize_doc
from app.db.mongodb import get_database
from pydantic import BaseModel
from typing import Dict, Any, List
from bson import ObjectId

router = APIRouter(prefix="/api/study-tasks", tags=["study-tasks"])

class TaskCreateRequest(BaseModel):
    task: str
    subject: str
    date: str

@router.get("")
async def get_study_tasks(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    student_id = current_user["id"]
    cursor = db.study_tasks.find({"user_id": ObjectId(student_id)})
    tasks = await cursor.to_list(length=100)
    return [serialize_doc(t) for t in tasks]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_study_task(
    req: TaskCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    student_id = current_user["id"]
    
    if not req.task.strip() or not req.subject.strip():
        raise HTTPException(status_code=400, detail="Task and Subject cannot be empty")
        
    task_doc = {
        "user_id": ObjectId(student_id),
        "task": req.task.strip(),
        "subject": req.subject.strip(),
        "date": req.date.strip(),
        "completed": False
    }
    
    result = await db.study_tasks.insert_one(task_doc)
    task_doc["_id"] = result.inserted_id
    
    return serialize_doc(task_doc)

@router.put("/{task_id}/complete")
async def toggle_task_complete(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    student_id = current_user["id"]
    
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID format")
        
    task = await db.study_tasks.find_one({"_id": ObjectId(task_id), "user_id": ObjectId(student_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Toggle completed flag
    new_status = not task.get("completed", False)
    await db.study_tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"completed": new_status}}
    )
    
    return {"message": "Task status updated successfully", "completed": new_status}

@router.delete("/{task_id}")
async def delete_study_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    student_id = current_user["id"]
    
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID format")
        
    res = await db.study_tasks.delete_one({"_id": ObjectId(task_id), "user_id": ObjectId(student_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
        
    return {"message": "Task deleted successfully"}
