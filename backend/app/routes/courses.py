from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from app.models.course import CourseCreate, CourseOut, MaterialOut, MaterialType
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.db.mongodb import get_database
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import os
import shutil
from bson import ObjectId

router = APIRouter(prefix="/api/courses", tags=["courses"])

# Upload directory configuration
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))

# Helper function to process uploaded document in background
async def process_document_bg(material_id: str, course_id: str, file_path: str, material_type: str):
    # This will be fully implemented in rag_service, but we place a scaffold or import it here
    try:
        from app.services.rag_service import process_and_index_material
        await process_and_index_material(material_id, course_id, file_path, material_type)
    except Exception as e:
        print(f"Error processing document in background task: {e}")
        db = get_database()
        await db.materials.update_one(
            {"_id": ObjectId(material_id)},
            {"$set": {"vector_status": "failed", "summary": f"Failed to process: {str(e)}"}}
        )

@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_in: CourseCreate,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    
    course_dict = {
        "title": course_in.title,
        "description": course_in.description,
        "subject": course_in.subject,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc),
        "students_enrolled": []
    }
    
    result = await db.courses.insert_one(course_dict)
    course_dict["_id"] = result.inserted_id
    
    return serialize_doc(course_dict)

@router.get("", response_model=List[CourseOut])
async def list_courses(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    cursor = db.courses.find()
    courses = await cursor.to_list(length=100)
    return [serialize_doc(c) for c in courses]

@router.get("/{course_id}", response_model=CourseOut)
async def get_course(course_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=400, detail="Invalid course ID")
        
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    return serialize_doc(course)

@router.post("/{course_id}/enroll", status_code=status.HTTP_200_OK)
async def enroll_course(
    course_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    db = get_database()
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=400, detail="Invalid course ID")
        
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    student_id = current_user["id"]
    
    # Check if already enrolled
    if student_id in course.get("students_enrolled", []):
        return {"message": "Already enrolled in this course"}
        
    await db.courses.update_one(
        {"_id": ObjectId(course_id)},
        {"$push": {"students_enrolled": student_id}}
    )
    
    # Initialize student progress for this course if not exists
    progress_exists = await db.user_progress.find_one({
        "student_id": ObjectId(student_id),
        "course_id": ObjectId(course_id)
    })
    
    if not progress_exists:
        progress_dict = {
            "student_id": ObjectId(student_id),
            "course_id": ObjectId(course_id),
            "topics": {},
            "overall_accuracy": 0.0,
            "weak_areas": [],
            "learning_speed": 1.0,
            "last_updated": datetime.now(timezone.utc)
        }
        await db.user_progress.insert_one(progress_dict)
        
    return {"message": "Successfully enrolled in the course"}

@router.post("/{course_id}/materials", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
async def upload_material(
    course_id: str,
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    type: MaterialType = Form(...),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=400, detail="Invalid course ID")
        
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    material_dir = os.path.join(UPLOAD_DIR, course_id)
    os.makedirs(material_dir, exist_ok=True)
    
    file_path = None
    
    # Handle physical file upload
    if type in [MaterialType.PDF, MaterialType.PPTX, MaterialType.DOCX, MaterialType.IMAGE]:
        if not file:
            raise HTTPException(status_code=400, detail="File is required for document uploads")
            
        safe_filename = "".join([c for c in file.filename if c.isalnum() or c in ['.', '_', '-']]).strip()
        file_path = os.path.join(material_dir, f"{datetime.now().timestamp()}_{safe_filename}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    # Handle raw note content creation
    elif type == MaterialType.TEXT:
        if not content:
            raise HTTPException(status_code=400, detail="Content text is required for text notes")
            
        file_path = os.path.join(material_dir, f"note_{datetime.now().timestamp()}.txt")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
            
    material_dict = {
        "course_id": course_id,
        "title": title,
        "type": type.value,
        "file_path": file_path,
        "uploaded_by": current_user["id"],
        "uploaded_at": datetime.now(timezone.utc),
        "summary": None,
        "vector_status": "pending"
    }
    
    result = await db.materials.insert_one(material_dict)
    material_dict["_id"] = result.inserted_id
    
    # Trigger background tasks to parse text, summarize, and embed in vector DB
    background_tasks.add_task(
        process_document_bg, 
        str(result.inserted_id), 
        course_id, 
        file_path, 
        type.value
    )
    
    return serialize_doc(material_dict)

@router.get("/{course_id}/materials", response_model=List[MaterialOut])
async def list_course_materials(
    course_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=400, detail="Invalid course ID")
        
    cursor = db.materials.find({"course_id": course_id})
    materials = await cursor.to_list(length=100)
    return [serialize_doc(m) for m in materials]

@router.get("/{course_id}/recommendations")
async def get_course_recommendations(
    course_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    from app.services.recommendation import RecommendationService
    student_id = current_user["id"]
    return await RecommendationService.get_recommendations(student_id, course_id)

@router.get("/{course_id}/analytics")
async def get_course_analytics(
    course_id: str,
    current_user: Dict[str, Any] = Depends(require_role(["student"]))
):
    from app.services.analytics_service import AnalyticsService
    student_id = current_user["id"]
    return await AnalyticsService.get_student_analytics(student_id, course_id)

