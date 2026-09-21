from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import get_current_user, require_role, serialize_doc, hash_password
from app.db.mongodb import get_database
from bson import ObjectId
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["admin"])

class UserCreateAdmin(BaseModel):
    name: str
    email: str
    password: str
    role: str

class UserUpdateAdmin(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None

@router.get("/stats")
async def get_admin_platform_stats(current_user: Dict[str, Any] = Depends(require_role(["admin"]))):
    db = get_database()
    
    total_users = await db.users.count_documents({})
    total_students = await db.users.count_documents({"role": "student"})
    total_faculty = await db.users.count_documents({"role": "faculty"})
    total_admins = await db.users.count_documents({"role": "admin"})
    
    total_classes = await db.classes.count_documents({})
    total_assignments = await db.assignments.count_documents({})
    total_submissions = await db.assignment_submissions.count_documents({})
    total_quizzes = await db.quizzes.count_documents({})
    total_materials = await db.materials.count_documents({})
    
    # AI Query Telemetry
    ai_query_count = await db.ai_usage.count_documents({})
        
    return {
        "total_users": total_users,
        "total_students": total_students,
        "total_faculty": total_faculty,
        "total_admins": total_admins,
        "total_classes": total_classes,
        "total_assignments": total_assignments,
        "total_submissions": total_submissions,
        "total_quizzes": total_quizzes,
        "total_materials": total_materials,
        "ai_query_count": ai_query_count,
        "platform_health": "Optimal",
        "active_sessions": max(total_users, 1)
    }

@router.get("/users")
async def list_all_users(
    role: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    query = {}
    if role:
        query["role"] = role
        
    cursor = db.users.find(query).sort("created_at", -1)
    users = await cursor.to_list(length=500)
    
    result = []
    for u in users:
        ser = serialize_doc(u)
        ser.pop("password_hash", None)
        result.append(ser)
    return result

@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    user_in: UserCreateAdmin,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    existing = await db.users.find_one({"email": user_in.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
        
    hashed_pwd = hash_password(user_in.password)
    user_dict = {
        "name": user_in.name,
        "email": user_in.email,
        "password_hash": hashed_pwd,
        "role": user_in.role,
        "active": True,
        "created_at": datetime.now(timezone.utc),
        "profile": {
            "avatar": "",
            "bio": f"Registered as {user_in.role}"
        }
    }
    
    res = await db.users.insert_one(user_dict)
    user_dict["_id"] = res.inserted_id
    user_dict.pop("password_hash", None)
    return serialize_doc(user_dict)

@router.put("/users/{user_id}")
async def update_user_admin(
    user_id: str,
    user_in: UserUpdateAdmin,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
        
    updates = {}
    if user_in.name is not None:
        updates["name"] = user_in.name
    if user_in.email is not None:
        updates["email"] = user_in.email
    if user_in.role is not None:
        updates["role"] = user_in.role
    if user_in.active is not None:
        updates["active"] = user_in.active
        
    if updates:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
        
    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    ser = serialize_doc(updated)
    ser.pop("password_hash", None)
    return ser

@router.delete("/users/{user_id}")
async def delete_user_admin(
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"message": "User account permanently deleted"}

# ==================== ADMIN CLASS MANAGEMENT ====================

class AdminClassCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = ""
    subject_ids: Optional[List[str]] = []
    faculty_id: Optional[str] = None
    student_ids: Optional[List[str]] = []

class AdminClassUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    subject_ids: Optional[List[str]] = None
    faculty_id: Optional[str] = None
    student_ids: Optional[List[str]] = None

class AssignFacultyPayload(BaseModel):
    faculty_id: str

class AssignStudentPayload(BaseModel):
    student_id: Optional[str] = None
    student_ids: Optional[List[str]] = None

@router.get("/classes")
async def admin_list_classes(current_user: Dict[str, Any] = Depends(require_role(["admin"]))):
    db = get_database()
    cursor = db.classes.find().sort("created_at", -1)
    classes = await cursor.to_list(length=100)
    
    result = []
    for c in classes:
        ser = serialize_doc(c)
        fac_id = ser.get("faculty_id")
        if fac_id:
            fac = None
            if ObjectId.is_valid(fac_id):
                fac = await db.users.find_one({"_id": ObjectId(fac_id)})
            if not fac:
                fac = await db.users.find_one({"$or": [{"_id": str(fac_id)}, {"email": fac_id}]})
            if fac:
                ser["faculty_name"] = fac.get("name")
                ser["faculty_email"] = fac.get("email")
        ser["student_count"] = len(ser.get("student_ids", []))
        result.append(ser)
    return result

@router.post("/classes", status_code=status.HTTP_201_CREATED)
async def admin_create_class(
    class_in: AdminClassCreate,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    existing = await db.classes.find_one({"code": class_in.code})
    if existing:
        raise HTTPException(status_code=400, detail="Class with this code already exists")
        
    fac_obj_id = ObjectId(class_in.faculty_id) if class_in.faculty_id and ObjectId.is_valid(class_in.faculty_id) else class_in.faculty_id
    student_obj_ids = [ObjectId(s) if ObjectId.is_valid(s) else s for s in (class_in.student_ids or [])]
    subject_obj_ids = [ObjectId(s) if ObjectId.is_valid(s) else s for s in (class_in.subject_ids or [])]
    
    fac_name = "Unassigned"
    fac_email = ""
    if class_in.faculty_id:
        fac = None
        if ObjectId.is_valid(class_in.faculty_id):
            fac = await db.users.find_one({"_id": ObjectId(class_in.faculty_id)})
        if not fac:
            fac = await db.users.find_one({"_id": str(class_in.faculty_id)})
        if fac:
            fac_name = fac.get("name", "Faculty")
            fac_email = fac.get("email", "")

    doc = {
        "name": class_in.name,
        "code": class_in.code,
        "description": class_in.description or "",
        "faculty_id": fac_obj_id,
        "faculty_name": fac_name,
        "faculty_email": fac_email,
        "student_ids": student_obj_ids,
        "subject_ids": subject_obj_ids,
        "created_at": datetime.now(timezone.utc)
    }
    
    res = await db.classes.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)

@router.put("/classes/{class_id}")
async def admin_update_class(
    class_id: str,
    class_in: AdminClassUpdate,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    cls = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
        
    updates = {}
    if class_in.name is not None:
        updates["name"] = class_in.name
    if class_in.code is not None:
        updates["code"] = class_in.code
    if class_in.description is not None:
        updates["description"] = class_in.description
    if class_in.faculty_id is not None:
        fac_id = class_in.faculty_id
        fac_obj_id = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
        updates["faculty_id"] = fac_obj_id
        
        fac = None
        if ObjectId.is_valid(fac_id):
            fac = await db.users.find_one({"_id": ObjectId(fac_id)})
        if not fac:
            fac = await db.users.find_one({"_id": str(fac_id)})
        if fac:
            updates["faculty_name"] = fac.get("name", "Faculty")
            updates["faculty_email"] = fac.get("email", "")

    if class_in.student_ids is not None:
        updates["student_ids"] = [ObjectId(s) if ObjectId.is_valid(s) else s for s in class_in.student_ids]
    if class_in.subject_ids is not None:
        updates["subject_ids"] = [ObjectId(s) if ObjectId.is_valid(s) else s for s in class_in.subject_ids]
        
    if updates:
        await db.classes.update_one({"_id": ObjectId(class_id)}, {"$set": updates})
        
    updated = await db.classes.find_one({"_id": ObjectId(class_id)})
    return serialize_doc(updated)

@router.delete("/classes/{class_id}")
async def admin_delete_class(
    class_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    await db.classes.delete_one({"_id": ObjectId(class_id)})
    return {"message": "Class deleted successfully"}

@router.post("/classes/{class_id}/faculty")
async def admin_assign_faculty(
    class_id: str,
    payload: AssignFacultyPayload,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    fac_id = payload.faculty_id
    fac_obj = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
    
    fac = await db.users.find_one({"$or": [{"_id": fac_obj}, {"_id": str(fac_id)}]})
    if not fac:
        raise HTTPException(status_code=404, detail="Faculty user not found")
        
    await db.classes.update_one(
        {"_id": ObjectId(class_id)},
        {"$set": {
            "faculty_id": fac_obj,
            "faculty_name": fac.get("name", "Faculty"),
            "faculty_email": fac.get("email", "")
        }}
    )
    
    updated = await db.classes.find_one({"_id": ObjectId(class_id)})
    return serialize_doc(updated)

@router.delete("/classes/{class_id}/faculty/{faculty_id}")
async def admin_remove_faculty(
    class_id: str,
    faculty_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    await db.classes.update_one(
        {"_id": ObjectId(class_id)},
        {"$set": {"faculty_id": None, "faculty_name": "Unassigned", "faculty_email": ""}}
    )
    return {"message": "Faculty unassigned from class"}

@router.post("/classes/{class_id}/students")
async def admin_assign_students(
    class_id: str,
    payload: AssignStudentPayload,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    cls = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
        
    new_ids = []
    if payload.student_id:
        new_ids.append(payload.student_id)
    if payload.student_ids:
        new_ids.extend(payload.student_ids)
        
    existing_list = cls.get("student_ids", [])
    for sid in new_ids:
        sobj = ObjectId(sid) if ObjectId.is_valid(sid) else sid
        if sobj not in existing_list and str(sid) not in [str(x) for x in existing_list]:
            existing_list.append(sobj)
            
    await db.classes.update_one({"_id": ObjectId(class_id)}, {"$set": {"student_ids": existing_list}})
    updated = await db.classes.find_one({"_id": ObjectId(class_id)})
    return serialize_doc(updated)

@router.delete("/classes/{class_id}/students/{student_id}")
async def admin_remove_student(
    class_id: str,
    student_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    cls = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
        
    sobj = ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id
    updated_ids = [s for s in cls.get("student_ids", []) if str(s) != str(student_id)]
    
    await db.classes.update_one({"_id": ObjectId(class_id)}, {"$set": {"student_ids": updated_ids}})
    return {"message": "Student removed from class"}

@router.get("/classes/{class_id}/students")
async def admin_get_class_students(
    class_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["admin", "faculty"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    cls = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
        
    students = []
    for sid in cls.get("student_ids", []):
        sobj = ObjectId(sid) if ObjectId.is_valid(sid) else sid
        st = await db.users.find_one({"$or": [{"_id": sobj}, {"_id": str(sid)}]})
        if st:
            ser = serialize_doc(st)
            ser.pop("password_hash", None)
            students.append(ser)
    return students

@router.get("/classes/{class_id}/faculty")
async def admin_get_class_faculty(
    class_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["admin", "faculty"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    cls = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
        
    fac_id = cls.get("faculty_id")
    if not fac_id:
        return None
        
    fac_obj = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
    fac = await db.users.find_one({"$or": [{"_id": fac_obj}, {"_id": str(fac_id)}]})
    if fac:
        ser = serialize_doc(fac)
        ser.pop("password_hash", None)
        return ser
    return None

