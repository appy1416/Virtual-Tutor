from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.routes.notifications import create_notification
from app.db.mongodb import get_database
from bson import ObjectId
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
import shutil

router = APIRouter(prefix="/api/faculty", tags=["faculty"])
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))

# Helper to get assigned classes query for current faculty
def get_faculty_class_query(current_user: Dict[str, Any]):
    fac_id = current_user["id"]
    fac_obj_id = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
    user_email = current_user.get("email", "")
    user_name = current_user.get("name", "")
    
    conds = [
        {"faculty_id": fac_obj_id},
        {"faculty_id": str(fac_id)},
        {"faculty_id": user_email},
        {"faculty_email": user_email}
    ]
    if user_name:
        conds.append({"faculty_name": user_name})
    return {"$or": conds}

# ==================== FACULTY CLASSES ====================

@router.get("/classes")
async def get_faculty_classes(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    from app.routes.classes import list_classes
    return await list_classes(current_user=current_user)


@router.get("/classes/{class_id}")
async def get_faculty_class_by_id(class_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    ser = serialize_doc(c)
    ser["student_count"] = len(ser.get("student_ids", []))
    return ser

@router.get("/classes/{class_id}/students")
async def get_faculty_class_students(class_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    
    students = []
    for sid in c.get("student_ids", []):
        sobj = ObjectId(sid) if ObjectId.is_valid(sid) else sid
        st = await db.users.find_one({"$or": [{"_id": sobj}, {"_id": str(sid)}]})
        if st:
            ser = serialize_doc(st)
            ser.pop("password_hash", None)
            students.append(ser)
    return students

# ==================== FACULTY DASHBOARD & ANALYTICS ====================

@router.get("/dashboard")
async def get_faculty_dashboard_stats(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    cls_cursor = db.classes.find(get_faculty_class_query(current_user))
    classes = await cls_cursor.to_list(length=100)
    class_ids = [c["_id"] for c in classes]
    
    student_id_set = set()
    for c in classes:
        for s_id in c.get("student_ids", []):
            student_id_set.add(str(s_id))
            
    total_students = len(student_id_set)
    total_classes = len(classes)
    
    asg_cursor = db.assignments.find({"class_id": {"$in": class_ids}}) if class_ids else db.assignments.find({"created_by": current_user["id"]})
    assignments = await asg_cursor.to_list(length=100)
    asg_ids = [a["_id"] for a in assignments]
    
    sub_cursor = db.assignment_submissions.find({"assignment_id": {"$in": asg_ids}}) if asg_ids else db.assignment_submissions.find()
    submissions = await sub_cursor.to_list(length=500)
    
    pending_submissions = sum(1 for s in submissions if s.get("status") == "Submitted" and s.get("marks_obtained") is None)
    graded_submissions = [s for s in submissions if s.get("marks_obtained") is not None]
    
    avg_score = round(sum(s.get("marks_obtained", 0) for s in graded_submissions) / len(graded_submissions), 1) if graded_submissions else 0.0
    
    quiz_cursor = db.quizzes.find({"$or": [{"created_by": ObjectId(current_user["id"])}, {"class_id": {"$in": class_ids}}]})
    quizzes = await quiz_cursor.to_list(length=100)
    
    students_needing_attention = []
    for s_id in list(student_id_set):
        st_obj_id = ObjectId(s_id) if ObjectId.is_valid(s_id) else s_id
        st = await db.users.find_one({"$or": [{"_id": st_obj_id}, {"_id": str(s_id)}]})
        if st:
            q_res_cursor = db.quiz_results.find({"$or": [{"user_id": st_obj_id}, {"user_id": str(s_id)}]})
            q_res = await q_res_cursor.to_list(length=20)
            low_scores = [r for r in q_res if r.get("percentage", 0) < 60.0]
            if low_scores or len(q_res) == 0:
                calc_avg = round(sum(r.get("percentage", 0) for r in q_res) / len(q_res), 1) if q_res else 0.0
                students_needing_attention.append({
                    "id": str(st["_id"]),
                    "name": st.get("name", "Student"),
                    "email": st.get("email", ""),
                    "issue": f"{len(low_scores)} weak quiz attempts" if low_scores else "No quiz activity yet",
                    "avg_score": calc_avg
                })

    return {
        "total_classes": total_classes,
        "total_students": total_students,
        "active_students": total_students,
        "total_assignments": len(assignments),
        "pending_submissions": pending_submissions,
        "completed_submissions": len(graded_submissions),
        "total_quizzes": len(quizzes),
        "average_class_score": avg_score,
        "students_needing_attention": students_needing_attention,
        "weak_topics": []
    }

@router.get("/analytics")
async def get_faculty_analytics(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    return await get_faculty_dashboard_stats(current_user)

@router.get("/classes/{class_id}/analytics")
async def get_class_analytics(class_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
        
    student_ids = c.get("student_ids", [])
    total_students = len(student_ids)
    
    # Assignments for this class
    asg_cursor = db.assignments.find({"class_id": ObjectId(class_id)})
    assignments = await asg_cursor.to_list(length=100)
    asg_ids = [a["_id"] for a in assignments]
    
    # Submissions
    sub_cursor = db.assignment_submissions.find({"assignment_id": {"$in": asg_ids}})
    subs = await sub_cursor.to_list(length=500)
    graded_subs = [s for s in subs if s.get("marks_obtained") is not None]
    avg_asg_score = round(sum(s.get("marks_obtained", 0) for s in graded_subs) / len(graded_subs), 1) if graded_subs else 0.0
    
    # Quizzes for this class
    quiz_cursor = db.quizzes.find({"class_id": ObjectId(class_id)})
    quizzes = await quiz_cursor.to_list(length=100)
    
    return {
        "class_id": class_id,
        "class_name": c.get("name"),
        "total_students": total_students,
        "total_assignments": len(assignments),
        "total_submissions": len(subs),
        "average_assignment_score": avg_asg_score,
        "total_quizzes": len(quizzes)
    }

# ==================== FACULTY STUDENTS & PROGRESS ====================

@router.get("/students")
async def list_faculty_students(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    cls_cursor = db.classes.find(get_faculty_class_query(current_user))
    classes = await cls_cursor.to_list(length=100)
    
    seen_ids = set()
    students = []
    for c in classes:
        for sid in c.get("student_ids", []):
            sobj = ObjectId(sid) if ObjectId.is_valid(sid) else sid
            if str(sobj) not in seen_ids:
                seen_ids.add(str(sobj))
                st = await db.users.find_one({"$or": [{"_id": sobj}, {"_id": str(sid)}]})
                if st:
                    ser = serialize_doc(st)
                    ser.pop("password_hash", None)
                    ser["class_name"] = c.get("name")
                    students.append(ser)
    return students

@router.get("/students/{student_id}/progress")
async def get_student_progress_detail(student_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    st_obj = ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id
    st = await db.users.find_one({"$or": [{"_id": st_obj}, {"_id": str(student_id)}]})
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")
        
    q_res = await db.quiz_results.find({"$or": [{"user_id": st_obj}, {"user_id": str(student_id)}]}).to_list(length=100)
    subs = await db.assignment_submissions.find({"$or": [{"student_id": st_obj}, {"student_id": str(student_id)}]}).to_list(length=100)
    
    avg_quiz = round(sum(r.get("percentage", 0) for r in q_res) / len(q_res), 1) if q_res else 0.0
    graded_subs = [s for s in subs if s.get("marks_obtained") is not None]
    avg_sub = round(sum(s.get("marks_obtained", 0) for s in graded_subs) / len(graded_subs), 1) if graded_subs else 0.0
    
    return {
        "student": {
            "id": str(st["_id"]),
            "name": st.get("name"),
            "email": st.get("email")
        },
        "average_quiz_score": avg_quiz,
        "quiz_count": len(q_res),
        "average_assignment_score": avg_sub,
        "submission_count": len(subs),
        "quiz_results": [serialize_doc(r) for r in q_res],
        "submissions": [serialize_doc(s) for s in subs]
    }

@router.get("/classes/{class_id}/progress")
async def get_class_students_progress(class_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
        
    results = []
    for sid in c.get("student_ids", []):
        sobj = ObjectId(sid) if ObjectId.is_valid(sid) else sid
        st = await db.users.find_one({"$or": [{"_id": sobj}, {"_id": str(sid)}]})
        if st:
            q_res = await db.quiz_results.find({"$or": [{"user_id": sobj}, {"user_id": str(sid)}]}).to_list(length=50)
            avg_q = round(sum(r.get("percentage", 0) for r in q_res) / len(q_res), 1) if q_res else 0.0
            results.append({
                "student_id": str(st["_id"]),
                "student_name": st.get("name"),
                "student_email": st.get("email"),
                "average_quiz_score": avg_q,
                "quiz_count": len(q_res)
            })
    return results

# ==================== FACULTY ASSIGNMENTS ====================

class FacultyAssignmentCreate(BaseModel):
    title: str
    description: str
    subject_id: str
    topic_id: str
    subtopic: Optional[str] = ""
    class_id: str
    due_date: str
    total_marks: float = 100.0

@router.get("/assignments")
async def list_faculty_assignments(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    fac_id = current_user["id"]
    fac_obj = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
    cursor = db.assignments.find({"$or": [{"created_by": fac_obj}, {"created_by": str(fac_id)}]}).sort("created_at", -1)
    asgs = await cursor.to_list(length=100)
    
    result = []
    for a in asgs:
        ser = serialize_doc(a)
        ser["submission_count"] = await db.assignment_submissions.count_documents({"assignment_id": ObjectId(ser["id"])})
        result.append(ser)
    return result

@router.post("/assignments", status_code=status.HTTP_201_CREATED)
async def create_faculty_assignment(
    assignment_in: FacultyAssignmentCreate,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    cls = await db.classes.find_one({"_id": ObjectId(assignment_in.class_id)}) if ObjectId.is_valid(assignment_in.class_id) else None
    if not cls:
        raise HTTPException(status_code=404, detail="Target class not found")
        
    doc = {
        "title": assignment_in.title,
        "description": assignment_in.description,
        "subject_id": ObjectId(assignment_in.subject_id) if ObjectId.is_valid(assignment_in.subject_id) else assignment_in.subject_id,
        "topic_id": ObjectId(assignment_in.topic_id) if ObjectId.is_valid(assignment_in.topic_id) else assignment_in.topic_id,
        "subtopic": assignment_in.subtopic or "",
        "class_id": ObjectId(assignment_in.class_id),
        "class_name": cls.get("name"),
        "created_by": ObjectId(current_user["id"]),
        "faculty_name": current_user.get("name"),
        "due_date": assignment_in.due_date,
        "total_marks": assignment_in.total_marks,
        "published": False,
        "created_at": datetime.now(timezone.utc)
    }
    res = await db.assignments.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)

@router.get("/assignments/{assignment_id}")
async def get_faculty_assignment(assignment_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
    a = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    ser = serialize_doc(a)
    ser["submission_count"] = await db.assignment_submissions.count_documents({"assignment_id": ObjectId(assignment_id)})
    return ser

@router.put("/assignments/{assignment_id}")
async def update_faculty_assignment(
    assignment_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
    await db.assignments.update_one({"_id": ObjectId(assignment_id)}, {"$set": payload})
    updated = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    return serialize_doc(updated)

@router.delete("/assignments/{assignment_id}")
async def delete_faculty_assignment(assignment_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
    await db.assignments.delete_one({"_id": ObjectId(assignment_id)})
    return {"message": "Assignment deleted successfully"}

@router.post("/assignments/{assignment_id}/publish")
async def publish_faculty_assignment(assignment_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
    a = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    await db.assignments.update_one({"_id": ObjectId(assignment_id)}, {"$set": {"published": True}})
    
    # Send notifications to students in the assigned class
    class_id = a.get("class_id")
    if class_id:
        cls = await db.classes.find_one({"_id": ObjectId(class_id) if ObjectId.is_valid(class_id) else class_id})
        if cls:
            for st_id in cls.get("student_ids", []):
                await create_notification(
                    user_id=st_id,
                    title=f"New Assignment: {a.get('title')}",
                    message=f"Faculty {current_user.get('name')} published an assignment for {cls.get('name')}. Due: {a.get('due_date')}",
                    notif_type="assignment",
                    link="/assignments"
                )
    return {"message": "Assignment published successfully"}

# ==================== FACULTY ANNOUNCEMENTS ====================

@router.post("/announcements")
async def post_announcement(
    title: str = Form(...),
    content: str = Form(...),
    class_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    doc = {
        "title": title,
        "content": content,
        "class_id": ObjectId(class_id) if class_id and ObjectId.is_valid(class_id) else None,
        "posted_by": ObjectId(current_user["id"]),
        "author_name": current_user.get("name"),
        "author_role": current_user.get("role"),
        "published": True,
        "created_at": datetime.now(timezone.utc)
    }
    res = await db.announcements.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    if class_id and ObjectId.is_valid(class_id):
        c = await db.classes.find_one({"_id": ObjectId(class_id)})
        if c:
            for s_id in c.get("student_ids", []):
                await create_notification(s_id, f"Announcement: {title}", content[:80], "announcement", "/announcements")
    else:
        st_cursor = db.users.find({"role": "student"})
        students = await st_cursor.to_list(length=200)
        for s in students:
            await create_notification(s["_id"], f"Platform Announcement: {title}", content[:80], "announcement", "/announcements")
            
    return serialize_doc(doc)

@router.get("/announcements")
async def list_announcements(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    cursor = db.announcements.find().sort("created_at", -1)
    announcements = await cursor.to_list(length=100)
    return [serialize_doc(a) for a in announcements]

@router.put("/announcements/{announcement_id}")
async def update_announcement(announcement_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(status_code=400, detail="Invalid announcement ID format")
    await db.announcements.update_one({"_id": ObjectId(announcement_id)}, {"$set": payload})
    updated = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
    return serialize_doc(updated)

@router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(status_code=400, detail="Invalid announcement ID format")
    await db.announcements.delete_one({"_id": ObjectId(announcement_id)})
    return {"message": "Announcement deleted successfully"}

@router.post("/announcements/{announcement_id}/publish")
async def publish_announcement(announcement_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(status_code=400, detail="Invalid announcement ID format")
    a = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    await db.announcements.update_one({"_id": ObjectId(announcement_id)}, {"$set": {"published": True}})
    
    class_id = a.get("class_id")
    if class_id:
        c = await db.classes.find_one({"_id": ObjectId(class_id) if ObjectId.is_valid(class_id) else class_id})
        if c:
            for s_id in c.get("student_ids", []):
                await create_notification(s_id, f"Announcement: {a.get('title')}", a.get("content", "")[:80], "announcement", "/announcements")
    return {"message": "Announcement published successfully"}

# ==================== FACULTY QUIZZES ====================

@router.get("/quizzes")
async def list_faculty_quizzes(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    fac_id = current_user["id"]
    fac_obj = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
    cursor = db.quizzes.find({"$or": [{"created_by": fac_obj}, {"created_by": str(fac_id)}]}).sort("created_at", -1)
    quizzes = await cursor.to_list(length=100)
    
    result = []
    for q in quizzes:
        ser = serialize_doc(q)
        ser["attempt_count"] = await db.quiz_attempts.count_documents({"quiz_id": ObjectId(ser["id"])})
        result.append(ser)
    return result

@router.get("/quizzes/{quiz_id}")
async def get_faculty_quiz(quiz_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    ser = serialize_doc(q)
    ser["attempt_count"] = await db.quiz_attempts.count_documents({"quiz_id": ObjectId(quiz_id)})
    return ser

@router.post("/quizzes", status_code=status.HTTP_201_CREATED)
async def create_faculty_quiz_endpoint(payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    doc = {
        "title": payload.get("title", "Untitled Quiz"),
        "subject_id": ObjectId(payload["subject_id"]) if payload.get("subject_id") and ObjectId.is_valid(payload["subject_id"]) else payload.get("subject_id"),
        "topic_id": ObjectId(payload["topic_id"]) if payload.get("topic_id") and ObjectId.is_valid(payload["topic_id"]) else payload.get("topic_id"),
        "subtopic": payload.get("subtopic", ""),
        "class_id": ObjectId(payload["class_id"]) if payload.get("class_id") and ObjectId.is_valid(payload["class_id"]) else payload.get("class_id"),
        "duration_minutes": payload.get("duration_minutes", 30),
        "start_date": payload.get("start_date"),
        "end_date": payload.get("end_date"),
        "created_by": ObjectId(current_user["id"]),
        "faculty_name": current_user.get("name"),
        "total_marks": payload.get("total_marks", 10.0),
        "questions": payload.get("questions", []),
        "published": False,
        "created_at": datetime.now(timezone.utc)
    }
    res = await db.quizzes.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)

@router.put("/quizzes/{quiz_id}")
async def update_faculty_quiz(quiz_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
    await db.quizzes.update_one({"_id": ObjectId(quiz_id)}, {"$set": payload})
    updated = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    return serialize_doc(updated)

@router.delete("/quizzes/{quiz_id}")
async def delete_faculty_quiz(quiz_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
    await db.quizzes.delete_one({"_id": ObjectId(quiz_id)})
    return {"message": "Quiz deleted successfully"}

@router.post("/quizzes/{quiz_id}/publish")
async def publish_faculty_quiz(quiz_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    await db.quizzes.update_one({"_id": ObjectId(quiz_id)}, {"$set": {"published": True}})
    
    class_id = q.get("class_id")
    if class_id:
        cls = await db.classes.find_one({"_id": ObjectId(class_id) if ObjectId.is_valid(class_id) else class_id})
        if cls:
            for st_id in cls.get("student_ids", []):
                await create_notification(
                    user_id=st_id,
                    title=f"New Quiz Available: {q.get('title')}",
                    message=f"Faculty {current_user.get('name')} published a quiz for {cls.get('name')}.",
                    notif_type="quiz",
                    link="/quizzes"
                )
    return {"message": "Quiz published successfully"}

# ==================== FACULTY LEARNING MATERIALS ====================

@router.get("/materials")
async def list_faculty_materials(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    fac_id = current_user["id"]
    fac_obj = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
    cursor = db.materials.find({"$or": [{"uploaded_by": fac_obj}, {"uploaded_by": str(fac_id)}]}).sort("uploaded_at", -1)
    materials = await cursor.to_list(length=100)
    return [serialize_doc(m) for m in materials]

@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def create_faculty_material(
    title: str = Form(...),
    type: str = Form(...),
    subject_id: str = Form(...),
    topic_id: str = Form(...),
    subtopic: Optional[str] = Form(""),
    class_id: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    file_url = None
    if file:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        safe_filename = "".join([c for c in file.filename if c.isalnum() or c in ['.', '_', '-']]).strip()
        filename = f"mat_{datetime.now().timestamp()}_{safe_filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_url = f"/uploads/{filename}"

    doc = {
        "title": title,
        "type": type,
        "subject_id": ObjectId(subject_id) if ObjectId.is_valid(subject_id) else subject_id,
        "topic_id": ObjectId(topic_id) if ObjectId.is_valid(topic_id) else topic_id,
        "subtopic": subtopic or "",
        "class_id": ObjectId(class_id) if class_id and ObjectId.is_valid(class_id) else class_id,
        "content": content or "",
        "file_url": file_url,
        "uploaded_by": ObjectId(current_user["id"]),
        "uploaded_at": datetime.now(timezone.utc)
    }
    res = await db.materials.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    # Send notification if bound to class
    if class_id:
        c = await db.classes.find_one({"_id": doc["class_id"]})
        if c:
            for s_id in c.get("student_ids", []):
                await create_notification(s_id, f"New Learning Material: {title}", f"Faculty {current_user.get('name')} uploaded study material.", "material", "/reference-materials")
                
    return serialize_doc(doc)

@router.get("/materials/{material_id}")
async def get_faculty_material(material_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(material_id):
        raise HTTPException(status_code=400, detail="Invalid material ID format")
    m = await db.materials.find_one({"_id": ObjectId(material_id)})
    if not m:
        raise HTTPException(status_code=404, detail="Material not found")
    return serialize_doc(m)

@router.put("/materials/{material_id}")
async def update_faculty_material(material_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(material_id):
        raise HTTPException(status_code=400, detail="Invalid material ID format")
    await db.materials.update_one({"_id": ObjectId(material_id)}, {"$set": payload})
    updated = await db.materials.find_one({"_id": ObjectId(material_id)})
    return serialize_doc(updated)

@router.delete("/materials/{material_id}")
async def delete_faculty_material(material_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(material_id):
        raise HTTPException(status_code=400, detail="Invalid material ID format")
    await db.materials.delete_one({"_id": ObjectId(material_id)})
    return {"message": "Material deleted successfully"}

# ==================== FACULTY SUBMISSIONS & GRADING ====================

@router.get("/submissions")
async def list_faculty_submissions(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    cls_cursor = db.classes.find(get_faculty_class_query(current_user))
    classes = await cls_cursor.to_list(length=100)
    class_ids = [c["_id"] for c in classes]
    
    asg_cursor = db.assignments.find({"class_id": {"$in": class_ids}}) if class_ids else db.assignments.find({"created_by": ObjectId(current_user["id"])})
    asgs = await asg_cursor.to_list(length=100)
    asg_ids = [a["_id"] for a in asgs]
    
    sub_cursor = db.assignment_submissions.find({"assignment_id": {"$in": asg_ids}}).sort("submitted_at", -1)
    subs = await sub_cursor.to_list(length=500)
    return [serialize_doc(s) for s in subs]

@router.get("/submissions/{submission_id}")
async def get_faculty_submission(submission_id: str, current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID format")
    s = await db.assignment_submissions.find_one({"_id": ObjectId(submission_id)})
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")
    return serialize_doc(s)

@router.post("/submissions/{submission_id}/grade")
@router.put("/submissions/{submission_id}/grade")
async def grade_faculty_submission(
    submission_id: str,
    marks: float = Form(...),
    feedback: Optional[str] = Form(""),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID format")
        
    sub = await db.assignment_submissions.find_one({"_id": ObjectId(submission_id)})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    await db.assignment_submissions.update_one(
        {"_id": ObjectId(submission_id)},
        {"$set": {
            "marks_obtained": marks,
            "feedback": feedback or "",
            "status": "Graded",
            "graded_at": datetime.now(timezone.utc),
            "graded_by": current_user.get("name")
        }}
    )
    
    a = await db.assignments.find_one({"_id": sub["assignment_id"]})
    a_title = a.get("title") if a else "Assignment"
    
    await create_notification(
        user_id=sub["student_id"],
        title=f"Assignment Graded: {a_title}",
        message=f"You received {marks} marks for {a_title}. Feedback: {feedback or 'Good job!'}",
        notif_type="grade",
        link="/assignments"
    )
    
    updated = await db.assignment_submissions.find_one({"_id": ObjectId(submission_id)})
    return serialize_doc(updated)

