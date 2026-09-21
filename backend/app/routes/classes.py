from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.db.mongodb import get_database
from bson import ObjectId
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/classes", tags=["classes"])

class ClassCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = ""
    subject_ids: Optional[List[str]] = []
    faculty_id: Optional[str] = None
    student_ids: Optional[List[str]] = []

class ClassUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    subject_ids: Optional[List[str]] = None
    faculty_id: Optional[str] = None
    student_ids: Optional[List[str]] = None

@router.get("")
async def list_classes(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    role = current_user.get("role")
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    user_email = current_user.get("email", "")
    user_name = current_user.get("name", "")
    
    if role == "admin":
        cursor = db.classes.find()
    elif role == "faculty":
        # Search by faculty_id as ObjectId, str, email, or name for complete reliability
        query_conditions = [
            {"faculty_id": user_obj_id},
            {"faculty_id": str(user_id)},
            {"faculty_id": user_email},
            {"faculty_email": user_email}
        ]
        if user_name:
            query_conditions.append({"faculty_name": user_name})
            
        cursor = db.classes.find({"$or": query_conditions})
    else:  # student
        cursor = db.classes.find({
            "$or": [
                {"student_ids": {"$in": [user_obj_id, str(user_id)]}},
                {"student_ids": user_obj_id},
                {"student_ids": str(user_id)}
            ]
        })
        
    classes = await cursor.to_list(length=100)
    
    # If user has no classes assigned by Admin, return empty list cleanly

    
    # Enrich with faculty and student details
    result = []
    for c in classes:
        ser = serialize_doc(c)
        fac_id = ser.get("faculty_id")
        
        if fac_id:
            fac_lookup = None
            if ObjectId.is_valid(fac_id):
                fac_lookup = await db.users.find_one({"_id": ObjectId(fac_id)})
            if not fac_lookup:
                fac_lookup = await db.users.find_one({"$or": [{"_id": str(fac_id)}, {"email": fac_id}]})
                
            if fac_lookup:
                ser["faculty_name"] = fac_lookup.get("name", "Faculty")
                ser["faculty_email"] = fac_lookup.get("email", "")
        
        # Enrich with enrolled student details
        student_ids = ser.get("student_ids", [])
        students_data = []
        for st_id in student_ids:
            st_lookup = None
            if ObjectId.is_valid(st_id):
                st_lookup = await db.users.find_one({"_id": ObjectId(st_id)})
            if not st_lookup:
                st_lookup = await db.users.find_one({"$or": [{"_id": str(st_id)}, {"email": str(st_id)}]})
                
            if st_lookup:
                students_data.append({
                    "id": str(st_lookup["_id"]),
                    "name": st_lookup.get("name", "Student"),
                    "email": st_lookup.get("email", "")
                })
        ser["students"] = students_data
        ser["student_count"] = len(students_data) if students_data else len(student_ids)
        result.append(ser)
        
    return result

@router.get("/{class_id}")
async def get_class_details(class_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
        
    ser = serialize_doc(c)
    
    # Fetch faculty details
    if ser.get("faculty_id"):
        fac_id = ser["faculty_id"]
        fac_lookup = None
        if ObjectId.is_valid(fac_id):
            fac_lookup = await db.users.find_one({"_id": ObjectId(fac_id)})
        if not fac_lookup:
            fac_lookup = await db.users.find_one({"$or": [{"_id": str(fac_id)}, {"email": fac_id}]})
            
        if fac_lookup:
            ser["faculty_name"] = fac_lookup.get("name")
            ser["faculty_email"] = fac_lookup.get("email")
            
    # Fetch student details
    student_ids = ser.get("student_ids", [])
    students_data = []
    for st_id in student_ids:
        st_lookup = None
        if ObjectId.is_valid(st_id):
            st_lookup = await db.users.find_one({"_id": ObjectId(st_id)})
        if not st_lookup:
            st_lookup = await db.users.find_one({"_id": str(st_id)})
            
        if st_lookup:
            students_data.append({
                "id": str(st_lookup["_id"]),
                "name": st_lookup.get("name"),
                "email": st_lookup.get("email")
            })
    ser["students"] = students_data
    return ser

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_class(
    class_in: ClassCreate,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    
    existing = await db.classes.find_one({"code": class_in.code})
    if existing:
        raise HTTPException(status_code=400, detail="Class with this code already exists")
        
    faculty_obj_id = ObjectId(class_in.faculty_id) if class_in.faculty_id and ObjectId.is_valid(class_in.faculty_id) else class_in.faculty_id
    student_obj_ids = [ObjectId(s_id) if ObjectId.is_valid(s_id) else s_id for s_id in class_in.student_ids]
    subject_obj_ids = [ObjectId(sub_id) if ObjectId.is_valid(sub_id) else sub_id for sub_id in class_in.subject_ids]
    
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
        "faculty_id": faculty_obj_id,
        "faculty_name": fac_name,
        "faculty_email": fac_email,
        "student_ids": student_obj_ids,
        "subject_ids": subject_obj_ids,
        "created_at": datetime.now(timezone.utc)
    }
    
    res = await db.classes.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)

@router.put("/{class_id}")
async def update_class(
    class_id: str,
    class_in: ClassUpdate,
    current_user: Dict[str, Any] = Depends(require_role(["admin", "faculty"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    c = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not c:
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
        
    updated_doc = await db.classes.find_one({"_id": ObjectId(class_id)})
    return serialize_doc(updated_doc)

@router.delete("/{class_id}")
async def delete_class(
    class_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(class_id):
        raise HTTPException(status_code=400, detail="Invalid class ID format")
        
    await db.classes.delete_one({"_id": ObjectId(class_id)})
    return {"message": "Class deleted successfully"}
