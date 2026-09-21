from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from app.models.course import MaterialType, MaterialOut
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.services.rag_service import process_and_index_material, chroma_client
from app.db.mongodb import get_database
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import os
import shutil
from bson import ObjectId

router = APIRouter(prefix="/api/reference-materials", tags=["reference-materials"])

# Upload directory configuration
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "reference_materials"))

async def process_reference_material_bg(material_id: str, file_path: str, material_type: str):
    try:
        await process_and_index_material(material_id, "", file_path, material_type)
    except Exception as e:
        print(f"Error processing reference material in background task: {e}")
        db = get_database()
        await db.materials.update_one(
            {"_id": ObjectId(material_id)},
            {"$set": {"vector_status": "failed", "summary": f"Failed to process: {str(e)}"}}
        )

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_reference_material(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    type: Optional[str] = Form(None),
    subject_id: str = Form(...),
    topic_id: str = Form(...),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    subj_obj = ObjectId(subject_id) if ObjectId.is_valid(subject_id) else subject_id
    top_obj = ObjectId(topic_id) if ObjectId.is_valid(topic_id) else topic_id
    subject = await db.subjects.find_one({"$or": [{"_id": subj_obj}, {"_id": str(subject_id)}]})
    topic = await db.topics.find_one({"$or": [{"_id": top_obj}, {"_id": str(topic_id)}]})
    if not subject or not topic:
        raise HTTPException(status_code=404, detail="Subject or Topic not found")

    # Normalize type
    if not type:
        if file and file.filename:
            ext = file.filename.rsplit(".", 1)[-1].lower()
            if ext in ["pdf", "pptx", "docx", "png", "jpg", "jpeg"]:
                type = "image" if ext in ["png", "jpg", "jpeg"] else ext
            elif ext == "txt":
                type = "text"
            else:
                type = "pdf"
        elif content:
            type = "text"
        else:
            type = "pdf"

    type_str = type.value if hasattr(type, "value") else str(type).lower()

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = None
    
    # Handle physical file upload
    if type_str in ["pdf", "pptx", "docx", "image"]:
        if not file:
            raise HTTPException(status_code=400, detail="File is required for document uploads")
            
        safe_filename = "".join([c for c in file.filename if c.isalnum() or c in ['.', '_', '-']]).strip()
        file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().timestamp()}_{safe_filename}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    # Handle raw note content creation
    elif type_str == "text":
        if not content:
            raise HTTPException(status_code=400, detail="Content text is required for text notes")
            
        file_path = os.path.join(UPLOAD_DIR, f"note_{datetime.now().timestamp()}.txt")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
    else:
        if file:
            safe_filename = "".join([c for c in file.filename if c.isalnum() or c in ['.', '_', '-']]).strip()
            file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().timestamp()}_{safe_filename}")
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

    user_id = current_user.get("id") or current_user.get("_id")
    uploaded_by = ObjectId(user_id) if ObjectId.is_valid(user_id) else str(user_id)

    material_dict = {
        "title": title,
        "type": type_str,
        "subject_id": subj_obj,
        "topic_id": top_obj,
        "subject_name": subject.get("name", "General"),
        "topic_name": topic.get("name", "General Topic"),
        "file_path": file_path,
        "uploaded_by": uploaded_by,
        "uploaded_at": datetime.now(timezone.utc),
        "summary": None,
        "vector_status": "pending"
    }
    
    result = await db.materials.insert_one(material_dict)
    material_dict["_id"] = result.inserted_id
    
    # Trigger background tasks to parse text, summarize, and embed in vector DB
    if file_path:
        background_tasks.add_task(
            process_reference_material_bg, 
            str(result.inserted_id), 
            file_path, 
            type_str
        )
    
    return serialize_doc(material_dict)

@router.get("")
async def list_reference_materials(
    subject_id: Optional[str] = None,
    topic_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    query = {}
    
    if subject_id:
        s_obj = ObjectId(subject_id) if ObjectId.is_valid(subject_id) else subject_id
        query["$or"] = [{"subject_id": s_obj}, {"subject_id": str(subject_id)}]
    if topic_id:
        t_obj = ObjectId(topic_id) if ObjectId.is_valid(topic_id) else topic_id
        query["$or"] = [{"topic_id": t_obj}, {"topic_id": str(topic_id)}]
        
    cursor = db.materials.find(query)
    materials = await cursor.to_list(length=200)
    
    subj_cache = {}
    top_cache = {}
    serialized_list = []
    for m in materials:
        ser = serialize_doc(m)
        if not ser.get("subject_name"):
            s_id = str(m.get("subject_id", ""))
            if s_id and s_id not in subj_cache:
                s_doc = await db.subjects.find_one({"$or": [{"_id": ObjectId(s_id) if ObjectId.is_valid(s_id) else s_id}, {"_id": s_id}]})
                subj_cache[s_id] = s_doc.get("name", "General") if s_doc else "General"
            ser["subject_name"] = subj_cache.get(s_id, "General")
            
        if not ser.get("topic_name"):
            t_id = str(m.get("topic_id", ""))
            if t_id and t_id not in top_cache:
                t_doc = await db.topics.find_one({"$or": [{"_id": ObjectId(t_id) if ObjectId.is_valid(t_id) else t_id}, {"_id": t_id}]})
                top_cache[t_id] = t_doc.get("name", "General Topic") if t_doc else "General Topic"
            ser["topic_name"] = top_cache.get(t_id, "General Topic")
        serialized_list.append(ser)
        
    return serialized_list

from fastapi.responses import FileResponse, Response
from app.utils.pdf_generator import create_pdf_from_text

@router.get("/{material_id}/download")
async def download_reference_material(
    material_id: str,
    token: Optional[str] = None
):
    db = get_database()
    if not ObjectId.is_valid(material_id):
        raise HTTPException(status_code=400, detail="Invalid material ID format")
        
    material = await db.materials.find_one({"_id": ObjectId(material_id)})
    if not material:
        raise HTTPException(status_code=404, detail="Reference material not found")
        
    file_path = material.get("file_path")
    if file_path and not os.path.exists(file_path):
        candidates = [
            os.path.join(os.getcwd(), file_path),
            os.path.join(os.getcwd(), "uploads", "reference_materials", os.path.basename(file_path)),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "reference_materials", os.path.basename(file_path))
        ]
        for c in candidates:
            if os.path.exists(c):
                file_path = c
                break

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document file not found on disk")
        
    mat_type = str(material.get("type", "pdf")).lower()
    title = str(material.get("title", "learning_material"))
    safe_title = "".join([c for c in title if c.isalnum() or c in [' ', '_', '-']]).strip().replace(" ", "_")
    
    ext = os.path.splitext(file_path)[1].lower()
    
    # If the file is already a PDF
    if ext == ".pdf" or mat_type == "pdf":
        # Check if file has PDF header
        try:
            with open(file_path, "rb") as f:
                header = f.read(5)
            if header.startswith(b"%PDF-"):
                return FileResponse(
                    path=file_path,
                    media_type="application/pdf",
                    filename=f"{safe_title}.pdf",
                    headers={
                        "Content-Disposition": f'attachment; filename="{safe_title}.pdf"',
                        "Access-Control-Expose-Headers": "Content-Disposition"
                    }
                )
        except Exception:
            pass
            
    # If text notes, markdown, or plain text: convert to genuine PDF
    if ext in [".txt", ".md", ""] or mat_type == "text":
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content_text = f.read()
        except Exception:
            content_text = material.get("content") or f"Material: {title}"
            
        pdf_bytes = create_pdf_from_text(
            title=title,
            text_content=f"Subject: {material.get('subject_name', '')}\nTopic: {material.get('topic_name', '')}\nUploaded: {material.get('uploaded_at', '')}\n\n--- Content Notes ---\n\n{content_text}",
            author="Virtual AI Tutor"
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_title}.pdf"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    download_filename = f"{safe_title}{ext}"
    media_types = {
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg"
    }
    media_type = media_types.get(ext, "application/octet-stream")
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=download_filename,
        headers={
            "Content-Disposition": f'attachment; filename="{download_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.delete("/{material_id}")
async def delete_reference_material(
    material_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    if not ObjectId.is_valid(material_id):
        raise HTTPException(status_code=400, detail="Invalid material ID format")
        
    material = await db.materials.find_one({"_id": ObjectId(material_id)})
    if not material:
        raise HTTPException(status_code=404, detail="Reference material not found")
        
    # Delete file from storage
    file_path = material.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error removing file: {e}")
            
    # Delete from ChromaDB vector collection
    try:
        collection = chroma_client.get_or_create_collection("course_materials")
        collection.delete(where={"material_id": str(material_id)})
    except Exception as e:
        print(f"Error deleting from Chroma: {e}")
        
    # Delete document from MongoDB
    await db.materials.delete_one({"_id": ObjectId(material_id)})
    return {"message": "Reference material deleted successfully"}
