from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.db.mongodb import get_database
from bson import ObjectId
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
import shutil

router = APIRouter(prefix="/api/student", tags=["student"])
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "assignments"))

# ==================== STUDENT CLASSES ====================

@router.get("/classes")
async def get_student_classes(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    
    cursor = db.classes.find({
        "$or": [
            {"student_ids": {"$in": [st_obj, st_id]}},
            {"student_ids": st_obj},
            {"student_ids": st_id}
        ]
    })
    classes = await cursor.to_list(length=100)
    return [serialize_doc(c) for c in classes]

@router.get("/faculty")
async def get_student_assigned_faculty(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.messages import get_allowed_contacts
    contacts = await get_allowed_contacts(current_user)
    return [c for c in contacts if c.get("role") == "faculty"]

# ==================== STUDENT ASSIGNMENTS ====================

@router.get("/assignments")
async def list_student_assignments(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.assignments import list_assignments
    return await list_assignments(current_user=current_user)

@router.get("/assignments/{assignment_id}")
async def get_student_assignment_detail(assignment_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.assignments import get_assignment_details
    return await get_assignment_details(assignment_id, current_user)

@router.post("/assignments/{assignment_id}/submit")
@router.put("/assignments/{assignment_id}/submission")
async def submit_student_assignment(
    assignment_id: str,
    notes: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    from app.routes.assignments import submit_assignment
    return await submit_assignment(assignment_id, notes, file, current_user)

@router.get("/assignments/{assignment_id}/submission")
async def get_student_submission_status(assignment_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    sub = await db.assignment_submissions.find_one({
        "assignment_id": ObjectId(assignment_id),
        "$or": [{"student_id": st_obj}, {"student_id": st_id}]
    })
    return serialize_doc(sub) if sub else None

# ==================== STUDENT ANNOUNCEMENTS ====================

@router.get("/announcements")
async def list_student_announcements(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    
    cls_cursor = db.classes.find({"student_ids": {"$in": [st_obj, st_id]}})
    classes = await cls_cursor.to_list(length=100)
    class_ids = [c["_id"] for c in classes]
    
    cursor = db.announcements.find({
        "$or": [
            {"class_id": {"$in": class_ids}},
            {"class_id": None}
        ]
    }).sort("created_at", -1)
    
    announcements = await cursor.to_list(length=100)
    return [serialize_doc(a) for a in announcements]

# ==================== STUDENT QUIZZES ====================

@router.get("/quizzes")
async def list_student_quizzes(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.quiz import list_student_assigned_quizzes
    return await list_student_assigned_quizzes(current_user=current_user)

@router.get("/quizzes/{quiz_id}")
async def get_student_quiz_detail(quiz_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return serialize_doc(q)

@router.post("/quizzes/{quiz_id}/attempt")
@router.put("/quizzes/{quiz_id}/attempt")
@router.post("/quizzes/{quiz_id}/submit")
async def submit_student_quiz(quiz_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.quiz import submit_faculty_quiz_attempt
    return await submit_faculty_quiz_attempt(quiz_id, payload, current_user)

@router.get("/quizzes/{quiz_id}/result")
async def get_student_quiz_result_endpoint(quiz_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.quiz import get_student_quiz_result
    return await get_student_quiz_result(quiz_id, current_user)

# ==================== STUDENT MATERIALS ====================

@router.get("/materials")
async def list_student_materials(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    
    cls_cursor = db.classes.find({"student_ids": {"$in": [st_obj, st_id]}})
    classes = await cls_cursor.to_list(length=100)
    class_ids = [c["_id"] for c in classes]
    
    cursor = db.materials.find({
        "$or": [
            {"class_id": {"$in": class_ids}},
            {"class_id": None}
        ]
    }).sort("uploaded_at", -1)
    
    materials = await cursor.to_list(length=100)
    return [serialize_doc(m) for m in materials]

@router.get("/materials/{material_id}")
async def get_student_material(material_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    if not ObjectId.is_valid(material_id):
        raise HTTPException(status_code=400, detail="Invalid material ID format")
    m = await db.materials.find_one({"_id": ObjectId(material_id)})
    if not m:
        raise HTTPException(status_code=404, detail="Material not found")
    return serialize_doc(m)

# ==================== STUDENT STUDY PLANS ====================

@router.get("/study-plans")
async def list_student_plans(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.study_plans import list_student_study_plans
    return await list_student_study_plans(current_user)

@router.post("/study-plans")
async def create_student_plan(payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.study_plans import create_student_study_plan
    return await create_student_study_plan(payload, current_user)

@router.post("/study-plans/generate")
async def generate_student_plan_endpoint(req: Any, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.study_plans import generate_study_plan
    return await generate_study_plan(req, current_user)

@router.put("/study-plans/{plan_id}")
async def update_student_plan(plan_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.study_plans import update_student_study_plan
    return await update_student_study_plan(plan_id, payload, current_user)

@router.delete("/study-plans/{plan_id}")
async def delete_student_plan(plan_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    from app.routes.study_plans import delete_study_plan
    return await delete_study_plan(plan_id, current_user)

# ==================== STUDENT DASHBOARD & ANALYTICS ====================

@router.get("/dashboard")
@router.get("/analytics")
@router.get("/progress")
async def get_student_dashboard_overview(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    
    classes = await get_student_classes(current_user)
    assignments = await list_student_assignments(current_user)
    announcements = await list_student_announcements(current_user)
    quizzes = await list_student_quizzes(current_user)
    materials = await list_student_materials(current_user)
    
    q_results = await db.quiz_results.find({"$or": [{"user_id": st_obj}, {"user_id": str(st_id)}]}).to_list(length=100)
    subs = await db.assignment_submissions.find({"$or": [{"student_id": st_obj}, {"student_id": str(st_id)}]}).to_list(length=100)
    
    avg_quiz = round(sum(r.get("percentage", 0) for r in q_results) / len(q_results), 1) if q_results else 0.0
    graded_subs = [s for s in subs if s.get("marks_obtained") is not None]
    avg_asg = round(sum(s.get("marks_obtained", 0) for s in graded_subs) / len(graded_subs), 1) if graded_subs else 0.0
    
    return {
        "classes": classes,
        "assignments": assignments,
        "announcements": announcements,
        "quizzes": quizzes,
        "materials": materials,
        "quiz_results": [serialize_doc(r) for r in q_results],
        "submissions": [serialize_doc(s) for s in subs],
        "average_quiz_score": avg_quiz,
        "average_assignment_score": avg_asg,
        "completed_assignments": len(subs),
        "total_quizzes_attempted": len(q_results)
    }
