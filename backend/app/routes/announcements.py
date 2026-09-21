from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.routes.notifications import create_notification
from app.db.mongodb import get_database
import os
from bson import ObjectId
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/announcements", tags=["announcements"])
faculty_announcements_router = APIRouter(prefix="/api/faculty/announcements", tags=["faculty-announcements"])
student_announcements_router = APIRouter(prefix="/api/student/announcements", tags=["student-announcements"])

ANNOUNCEMENTS_UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "announcements"))
os.makedirs(ANNOUNCEMENTS_UPLOAD_DIR, exist_ok=True)

class AnnouncementCreate(BaseModel):
    title: str
    message: Optional[str] = ""
    content: Optional[str] = ""
    class_id: Optional[str] = None
    image_url: Optional[str] = None

@router.get("")
@faculty_announcements_router.get("")
@student_announcements_router.get("")
async def list_announcements(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    role = current_user.get("role")
    user_id = current_user["id"]
    user_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    if role == "student":
        # Find student's classes
        cls_cursor = db.classes.find({
            "$or": [
                {"student_ids": {"$in": [user_obj, str(user_id)]}},
                {"student_ids": user_obj},
                {"student_ids": str(user_id)}
            ]
        })
        classes = await cls_cursor.to_list(length=100)
        class_ids = [c["_id"] for c in classes]
        class_ids_str = [str(c["_id"]) for c in classes]
        
        query = {
            "$or": [
                {"class_id": {"$in": class_ids + class_ids_str}},
                {"class_id": None},
                {"class_id": ""}
            ]
        }
    elif role == "faculty":
        # Find faculty's classes
        cls_cursor = db.classes.find({
            "$or": [
                {"faculty_id": user_obj},
                {"faculty_id": str(user_id)},
                {"faculty_email": current_user.get("email")}
            ]
        })
        classes = await cls_cursor.to_list(length=100)
        class_ids = [c["_id"] for c in classes] + [str(c["_id"]) for c in classes]
        query = {
            "$or": [
                {"posted_by": user_obj},
                {"posted_by": str(user_id)},
                {"class_id": {"$in": class_ids}},
                {"class_id": None}
            ]
        }
    else:  # admin
        query = {}
        
    cursor = db.announcements.find(query).sort("created_at", -1)
    announcements = await cursor.to_list(length=100)
    
    # Enrich with class name if available
    result = []
    for a in announcements:
        ser = serialize_doc(a)
        # Ensure 'message' field is present for frontend
        if "content" in ser and not ser.get("message"):
            ser["message"] = ser["content"]
        if "message" in ser and not ser.get("content"):
            ser["content"] = ser["message"]
            
        cid = ser.get("class_id")
        if cid:
            cls_doc = await db.classes.find_one({"_id": ObjectId(cid) if ObjectId.is_valid(cid) else cid})
            if cls_doc:
                ser["class_name"] = cls_doc.get("name", "Class Section")
        result.append(ser)
        
    return result

@router.post("")
@faculty_announcements_router.post("")
async def create_announcement(
    request: Request,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    
    # Support both JSON payload and Form-encoded data (with optional image file upload)
    content_type = request.headers.get("content-type", "")
    title = ""
    message = ""
    class_id = None
    image_url = None
    
    if "application/json" in content_type:
        body = await request.json()
        title = body.get("title", "").strip()
        message = (body.get("message") or body.get("content") or "").strip()
        class_id = body.get("class_id")
        image_url = body.get("image_url")
    else:
        form = await request.form()
        title = str(form.get("title", "")).strip()
        message = str(form.get("message") or form.get("content") or "").strip()
        class_id = form.get("class_id")
        image_url = form.get("image_url")
        
        # Check if an image file was uploaded
        file_field = form.get("image") or form.get("file") or form.get("image_file")
        if file_field and hasattr(file_field, "filename") and file_field.filename:
            raw_filename = os.path.basename(file_field.filename).replace(" ", "_")
            safe_filename = f"{datetime.now().timestamp()}_{raw_filename}"
            file_path = os.path.join(ANNOUNCEMENTS_UPLOAD_DIR, safe_filename)
            file_bytes = await file_field.read()
            with open(file_path, "wb") as f:
                f.write(file_bytes)
            image_url = f"/uploads/announcements/{safe_filename}"
        
    if not title:
        raise HTTPException(status_code=400, detail="Announcement title is required")
    if not message:
        raise HTTPException(status_code=400, detail="Announcement message is required")
        
    class_obj = ObjectId(class_id) if class_id and ObjectId.is_valid(class_id) else None
    class_name = ""
    if class_id:
        c_doc = await db.classes.find_one({"_id": class_obj or class_id})
        if c_doc:
            class_name = c_doc.get("name", "")
            
    doc = {
        "title": title,
        "message": message,
        "content": message,
        "image_url": image_url,
        "class_id": str(class_obj) if class_obj else (str(class_id) if class_id else None),
        "class_name": class_name,
        "posted_by": str(current_user["id"]),
        "author_name": current_user.get("name", "Instructor"),
        "author_role": current_user.get("role", "faculty"),
        "published": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    res = await db.announcements.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    # Notify students
    notif_count = 0
    if class_id:
        c = await db.classes.find_one({"_id": class_obj or class_id})
        if c:
            student_ids = c.get("student_ids", [])
            for s_id in student_ids:
                await create_notification(
                    user_id=s_id,
                    title=f"New Announcement: {title}",
                    message=f"[{class_name or 'Course'}] {message[:100]}",
                    notif_type="announcement",
                    link="/announcements"
                )
                notif_count += 1
    else:
        # Platform-wide announcement
        st_cursor = db.users.find({"role": "student"})
        students = await st_cursor.to_list(length=200)
        for s in students:
            await create_notification(
                user_id=s["_id"],
                title=f"Announcement: {title}",
                message=message[:100],
                notif_type="announcement",
                link="/announcements"
            )
            notif_count += 1
            
    ser = serialize_doc(doc)
    ser["students_notified"] = notif_count
    return ser

@router.delete("/{announcement_id}")
@faculty_announcements_router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(announcement_id):
        raise HTTPException(status_code=400, detail="Invalid announcement ID format")
    
    existing = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
    if existing and existing.get("image_url"):
        img_url = existing["image_url"]
        if img_url.startswith("/uploads/announcements/"):
            fname = os.path.basename(img_url)
            fpath = os.path.join(ANNOUNCEMENTS_UPLOAD_DIR, fname)
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass
                    
    await db.announcements.delete_one({"_id": ObjectId(announcement_id)})
    return {"message": "Announcement deleted successfully"}
