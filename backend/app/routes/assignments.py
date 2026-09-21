from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, Response
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.routes.notifications import create_notification
from app.db.mongodb import get_database
from app.utils.pdf_generator import create_pdf_from_text
from bson import ObjectId
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import os
import shutil

router = APIRouter(prefix="/api/assignments", tags=["assignments"])

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "assignments"))

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_assignment(
    title: str = Form(...),
    description: str = Form(...),
    subject_id: str = Form(...),
    topic_id: str = Form(...),
    subtopic: Optional[str] = Form(""),
    class_id: str = Form(...),
    due_date: str = Form(...),
    total_marks: float = Form(100.0),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    cls = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not cls:
        raise HTTPException(status_code=404, detail="Assigned class not found")
        
    attachment_url = None
    if file:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        safe_filename = "".join([c for c in file.filename if c.isalnum() or c in ['.', '_', '-']]).strip()
        filename = f"{datetime.now().timestamp()}_{safe_filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        attachment_url = f"/uploads/assignments/{filename}"
        
    doc = {
        "title": title,
        "description": description,
        "subject_id": ObjectId(subject_id) if ObjectId.is_valid(subject_id) else subject_id,
        "topic_id": ObjectId(topic_id) if ObjectId.is_valid(topic_id) else topic_id,
        "subtopic": subtopic or "",
        "class_id": ObjectId(class_id),
        "class_name": cls.get("name"),
        "created_by": ObjectId(current_user["id"]),
        "faculty_name": current_user.get("name"),
        "due_date": due_date,
        "total_marks": total_marks,
        "attachment_url": attachment_url,
        "created_at": datetime.now(timezone.utc)
    }
    
    res = await db.assignments.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    # Send notifications to all students in the assigned class
    student_ids = cls.get("student_ids", [])
    for st_id in student_ids:
        await create_notification(
            user_id=st_id,
            title=f"New Assignment: {title}",
            message=f"Faculty {current_user.get('name')} posted a new assignment for {cls.get('name')}. Due: {due_date}",
            notif_type="assignment",
            link="/assignments"
        )
        
    return serialize_doc(doc)

@router.get("")
async def list_assignments(
    class_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    role = current_user.get("role")
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    query = {}
    if class_id and ObjectId.is_valid(class_id):
        query["class_id"] = ObjectId(class_id)
        
    if role == "student":
        # Find student's classes
        cls_cursor = db.classes.find({
            "$or": [
                {"student_ids": {"$in": [user_obj_id, str(user_id)]}},
                {"student_ids": user_obj_id},
                {"student_ids": str(user_id)}
            ]
        })
        student_classes = await cls_cursor.to_list(length=100)
        
        class_ids_all = []
        for c in student_classes:
            class_ids_all.append(c["_id"])
            class_ids_all.append(str(c["_id"]))
            
        if class_ids_all:
            query["class_id"] = {"$in": class_ids_all}
        # If student not in specific class array yet, return all assignments as fail-safe
        
    elif role == "faculty":
        # Faculty's created assignments or assigned classes
        query["$or"] = [{"created_by": user_obj_id}, {"created_by": user_id}]
        
    cursor = db.assignments.find(query).sort("created_at", -1)
    assignments = await cursor.to_list(length=200)
    
    # Fallback for students if no class-filtered assignments found
    if role == "student" and not assignments:
        cursor_all = db.assignments.find().sort("created_at", -1)
        assignments = await cursor_all.to_list(length=200)

    
    # Enrich with student's submission status if student
    result = []
    for a in assignments:
        ser = serialize_doc(a)
        asg_id = ser["id"]
        asg_obj = ObjectId(asg_id) if ObjectId.is_valid(asg_id) else asg_id
        
        if role == "student":
            sub = await db.assignment_submissions.find_one({
                "$or": [
                    {"assignment_id": asg_obj},
                    {"assignment_id": str(asg_id)}
                ],
                "$and": [
                    {"$or": [
                        {"student_id": user_obj_id},
                        {"student_id": str(user_id)},
                        {"student_email": current_user.get("email")}
                    ]}
                ]
            })
            if sub:
                sub_ser = serialize_doc(sub)
                ser["status"] = sub_ser.get("status", "Submitted")
                ser["submission"] = sub_ser
                ser["marks_obtained"] = sub_ser.get("marks_obtained")
                ser["feedback"] = sub_ser.get("feedback")
            else:
                ser["status"] = "Not Started"
                ser["submission"] = None
        else:
            # Count submissions for faculty view
            sub_count = await db.assignment_submissions.count_documents({
                "$or": [
                    {"assignment_id": asg_obj},
                    {"assignment_id": str(asg_id)}
                ]
            })
            ser["submission_count"] = sub_count
            
        result.append(ser)
        
    return result

@router.get("/{assignment_id}")
async def get_assignment_details(assignment_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
        
    a = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    ser = serialize_doc(a)
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    if current_user.get("role") == "student":
        sub = await db.assignment_submissions.find_one({
            "assignment_id": ObjectId(assignment_id),
            "$or": [{"student_id": user_obj_id}, {"student_id": user_id}]
        })
        ser["submission"] = serialize_doc(sub) if sub else None
        
    return ser

@router.post("/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: str,
    notes: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
        
    a = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    student_id = current_user["id"]
    student_obj_id = ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id
    
    file_url = None
    file_name = None
    if file:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        safe_name = "".join([c for c in file.filename if c.isalnum() or c in ['.', '_', '-']]).strip()
        filename = f"sub_{datetime.now().timestamp()}_{safe_name}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_url = f"/uploads/assignments/{filename}"
        file_name = file.filename
        
    submission_doc = {
        "assignment_id": ObjectId(assignment_id),
        "student_id": student_obj_id,
        "student_name": current_user.get("name"),
        "student_email": current_user.get("email"),
        "notes": notes or "",
        "file_url": file_url,
        "file_name": file_name,
        "status": "Submitted",
        "marks_obtained": None,
        "feedback": None,
        "submitted_at": datetime.now(timezone.utc)
    }
    
    # Upsert submission
    existing = await db.assignment_submissions.find_one({
        "assignment_id": ObjectId(assignment_id),
        "$or": [{"student_id": student_obj_id}, {"student_id": student_id}]
    })
    
    if existing:
        await db.assignment_submissions.update_one({"_id": existing["_id"]}, {"$set": submission_doc})
        submission_doc["_id"] = existing["_id"]
    else:
        res = await db.assignment_submissions.insert_one(submission_doc)
        submission_doc["_id"] = res.inserted_id
        
    # Notify faculty
    if a.get("created_by"):
        await create_notification(
            user_id=a["created_by"],
            title=f"New Assignment Submission: {a.get('title')}",
            message=f"Student {current_user.get('name')} submitted homework for {a.get('title')}.",
            notif_type="submission",
            link="/faculty/submissions"
        )
        
    return serialize_doc(submission_doc)

@router.get("/submissions/all")
@router.get("/{assignment_id}/submissions")
async def list_assignment_submissions(
    assignment_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    query = {}
    if assignment_id and ObjectId.is_valid(assignment_id):
        query["$or"] = [
            {"assignment_id": ObjectId(assignment_id)},
            {"assignment_id": str(assignment_id)}
        ]
        
    cursor = db.assignment_submissions.find(query).sort("submitted_at", -1)
    submissions = await cursor.to_list(length=200)
    return [serialize_doc(s) for s in submissions]


@router.post("/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID format")
        
    sub = await db.assignment_submissions.find_one({"_id": ObjectId(submission_id)})
    if not sub:
        sub = await db.assignment_submissions.find_one({"_id": str(submission_id)})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    marks_val = None
    feedback_val = ""
    
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            marks_val = body.get("marks") or body.get("score")
            feedback_val = body.get("feedback", "")
        except Exception:
            pass
            
    if marks_val is None:
        try:
            form = await request.form()
            marks_val = form.get("marks") or form.get("score")
            feedback_val = form.get("feedback", "")
        except Exception:
            pass
            
    if marks_val is None or str(marks_val).strip() == "":
        raise HTTPException(status_code=400, detail="Marks are required for grading")
        
    try:
        marks_float = float(marks_val)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Marks must be a numeric value")
        
    await db.assignment_submissions.update_one(
        {"_id": sub["_id"]},
        {"$set": {
            "marks_obtained": marks_float,
            "feedback": str(feedback_val or ""),
            "status": "Graded",
            "graded_at": datetime.now(timezone.utc),
            "graded_by": current_user.get("name", "Faculty")
        }}
    )
    
    # Send notification to student
    a = await db.assignments.find_one({
        "$or": [
            {"_id": ObjectId(sub["assignment_id"]) if ObjectId.is_valid(sub.get("assignment_id")) else sub.get("assignment_id")},
            {"_id": str(sub.get("assignment_id"))}
        ]
    })
    a_title = a.get("title") if a else "Assignment"
    
    await create_notification(
        user_id=sub["student_id"],
        title=f"Assignment Graded: {a_title}",
        message=f"You received {marks_float} marks for {a_title}. Feedback: {feedback_val or 'Good job!'}",
        notif_type="grade",
        link="/assignments"
    )
    
    updated = await db.assignment_submissions.find_one({"_id": sub["_id"]})
    return serialize_doc(updated)

@router.get("/submissions/{submission_id}/download")
async def download_submission_file(
    submission_id: str,
    token: Optional[str] = None
):
    db = get_database()
    sub = await db.assignment_submissions.find_one({
        "$or": [
            {"_id": ObjectId(submission_id) if ObjectId.is_valid(submission_id) else submission_id},
            {"_id": str(submission_id)}
        ]
    })
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    st_name = "".join(c for c in sub.get("student_name", "Student") if c.isalnum() or c in [' ', '_', '-']).strip().replace(" ", "_")
    file_url = sub.get("file_url")
    notes = sub.get("notes", "")
    
    if file_url:
        fname = os.path.basename(file_url)
        disk_path = os.path.join(UPLOAD_DIR, fname)
        if not os.path.exists(disk_path):
            disk_path = os.path.join(os.getcwd(), "uploads", "assignments", fname)
            
        if os.path.exists(disk_path):
            ext = os.path.splitext(disk_path)[1].lower()
            if ext == ".pdf":
                return FileResponse(
                    path=disk_path,
                    media_type="application/pdf",
                    filename=f"{st_name}_submission.pdf",
                    headers={"Content-Disposition": f'attachment; filename="{st_name}_submission.pdf"'}
                )
            else:
                # Text, markdown, or other note format: convert to clean genuine PDF
                try:
                    with open(disk_path, "r", encoding="utf-8", errors="ignore") as f:
                        file_text = f.read()
                except Exception:
                    file_text = f"File: {fname}"
                    
                pdf_bytes = create_pdf_from_text(
                    title=f"Submission: {st_name}",
                    text_content=f"Student: {sub.get('student_name')} ({sub.get('student_email')})\nSubmitted: {sub.get('submitted_at')}\nNotes: {notes}\n\n--- Attachment Content ---\n\n{file_text}",
                    author=sub.get("student_name", "Student")
                )
                return Response(
                    content=pdf_bytes,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{st_name}_submission.pdf"'}
                )
                
    # If notes only
    pdf_bytes = create_pdf_from_text(
        title=f"Submission Notes: {st_name}",
        text_content=f"Student: {sub.get('student_name')} ({sub.get('student_email')})\nSubmitted: {sub.get('submitted_at')}\n\nSolution Notes:\n{notes or '(No notes provided)'}",
        author=sub.get("student_name", "Student")
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{st_name}_submission.pdf"'}
    )

@router.get("/{assignment_id}/download-attachment")
async def download_assignment_attachment(
    assignment_id: str,
    token: Optional[str] = None
):
    db = get_database()
    a = await db.assignments.find_one({
        "$or": [
            {"_id": ObjectId(assignment_id) if ObjectId.is_valid(assignment_id) else assignment_id},
            {"_id": str(assignment_id)}
        ]
    })
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    safe_title = "".join(c for c in a.get("title", "Assignment") if c.isalnum() or c in [' ', '_', '-']).strip().replace(" ", "_")
    att_url = a.get("attachment_url")
    if not att_url:
        # Generate PDF of assignment prompt and requirements
        pdf_bytes = create_pdf_from_text(
            title=a.get("title", "Assignment"),
            text_content=f"Subject: {a.get('subject_name', '')}\nClass: {a.get('class_name', '')}\nDue Date: {a.get('due_date', '')}\nTotal Marks: {a.get('total_marks', 100)}\n\nDescription & Requirements:\n{a.get('description', '')}",
            author=a.get("faculty_name", "Instructor")
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'}
        )
        
    fname = os.path.basename(att_url)
    disk_path = os.path.join(UPLOAD_DIR, fname)
    if not os.path.exists(disk_path):
        disk_path = os.path.join(os.getcwd(), "uploads", "assignments", fname)
        
    if os.path.exists(disk_path):
        ext = os.path.splitext(disk_path)[1].lower()
        if ext == ".pdf":
            return FileResponse(
                path=disk_path,
                media_type="application/pdf",
                filename=f"{safe_title}.pdf",
                headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'}
            )
        else:
            try:
                with open(disk_path, "r", encoding="utf-8", errors="ignore") as f:
                    file_text = f.read()
            except Exception:
                file_text = f"Attachment: {fname}"
            pdf_bytes = create_pdf_from_text(
                title=a.get("title", "Assignment"),
                text_content=f"Subject: {a.get('subject_name', '')}\nClass: {a.get('class_name', '')}\nDue Date: {a.get('due_date', '')}\nTotal Marks: {a.get('total_marks', 100)}\n\nDescription:\n{a.get('description', '')}\n\n--- Attachment Content ---\n\n{file_text}",
                author=a.get("faculty_name", "Instructor")
            )
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'}
            )
            
    raise HTTPException(status_code=404, detail="Attachment file not found")

# ==================== STUDENT ASSIGNMENTS ENDPOINTS ====================

@router.get("/student/list", tags=["student"])
async def student_list_assignments_alt(current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    return await list_assignments(current_user=current_user)

@router.get("/student/{assignment_id}", tags=["student"])
async def student_get_assignment_detail_alt(assignment_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    return await get_assignment_details(assignment_id, current_user)

@router.get("/student/{assignment_id}/submission", tags=["student"])
async def student_get_submission(assignment_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(status_code=400, detail="Invalid assignment ID format")
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    
    sub = await db.assignment_submissions.find_one({
        "assignment_id": ObjectId(assignment_id),
        "$or": [{"student_id": st_obj}, {"student_id": st_id}]
    })
    if not sub:
        return None
    return serialize_doc(sub)

@router.put("/student/{assignment_id}/submission", tags=["student"])
async def student_update_submission(
    assignment_id: str,
    notes: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    return await submit_assignment(assignment_id, notes, file, current_user)

