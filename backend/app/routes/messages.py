from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from app.services.auth_service import get_current_user, serialize_doc
from app.routes.notifications import create_notification
from app.db.mongodb import get_database
from bson import ObjectId
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import os
import shutil

router = APIRouter(prefix="/api/messages", tags=["messages"])

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "messages"))

@router.get("/contacts")
async def get_allowed_contacts(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    role = current_user.get("role")
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    contacts = []
    seen_ids = set()
    
    if role == "student":
        # Find classes where student is enrolled
        cursor = db.classes.find({"student_ids": {"$in": [user_obj_id, user_id]}})
        classes = await cursor.to_list(length=100)
        for c in classes:
            fac_id = c.get("faculty_id")
            if fac_id:
                fac_obj = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
                if str(fac_obj) not in seen_ids:
                    fac = await db.users.find_one({"_id": fac_obj})
                    if fac:
                        seen_ids.add(str(fac["_id"]))
                        contacts.append({
                            "id": str(fac["_id"]),
                            "name": fac.get("name"),
                            "email": fac.get("email"),
                            "role": "faculty",
                            "class_name": c.get("name")
                        })
    elif role == "faculty":
        # Find classes where faculty is assigned
        cursor = db.classes.find({"$or": [{"faculty_id": user_obj_id}, {"faculty_id": user_id}]})
        classes = await cursor.to_list(length=100)
        for c in classes:
            for st_id in c.get("student_ids", []):
                st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
                if str(st_obj) not in seen_ids:
                    st = await db.users.find_one({"_id": st_obj})
                    if st:
                        seen_ids.add(str(st["_id"]))
                        contacts.append({
                            "id": str(st["_id"]),
                            "name": st.get("name"),
                            "email": st.get("email"),
                            "role": "student",
                            "class_name": c.get("name")
                        })
    else:  # Admin can talk to anyone
        cursor = db.users.find({"_id": {"$ne": user_obj_id}})
        users = await cursor.to_list(length=100)
        for u in users:
            contacts.append({
                "id": str(u["_id"]),
                "name": u.get("name"),
                "email": u.get("email"),
                "role": u.get("role")
            })
            
    return contacts

@router.get("/conversations")
async def get_conversations(current_user: Dict[str, Any] = Depends(get_current_user)):
    contacts = await get_allowed_contacts(current_user)
    return contacts

@router.get("/conversations/{user_id}")
@router.get("/chat/{user_id}")
async def get_chat_history(user_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    curr_id = current_user["id"]
    
    u1_obj = ObjectId(curr_id) if ObjectId.is_valid(curr_id) else curr_id
    u2_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    query = {
        "$or": [
            {"sender_id": u1_obj, "receiver_id": u2_obj},
            {"sender_id": u2_obj, "receiver_id": u1_obj},
            {"sender_id": curr_id, "receiver_id": user_id},
            {"sender_id": user_id, "receiver_id": curr_id}
        ]
    }
    
    cursor = db.messages.find(query).sort("timestamp", 1)
    msgs = await cursor.to_list(length=500)
    
    await db.messages.update_many(
        {
            "$and": [
                {"$or": [{"sender_id": u2_obj}, {"sender_id": user_id}]},
                {"$or": [{"receiver_id": u1_obj}, {"receiver_id": curr_id}]},
                {"read": False}
            ]
        },
        {"$set": {"read": True}}
    )
    
    return [serialize_doc(m) for m in msgs]

@router.get("")
async def list_all_user_messages(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    uid = current_user["id"]
    uobj = ObjectId(uid) if ObjectId.is_valid(uid) else uid
    cursor = db.messages.find({"$or": [{"sender_id": uobj}, {"receiver_id": uobj}, {"sender_id": uid}, {"receiver_id": uid}]}).sort("timestamp", -1)
    msgs = await cursor.to_list(length=200)
    return [serialize_doc(m) for m in msgs]

@router.get("/{message_id}")
async def get_message_by_id(message_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID format")
    m = await db.messages.find_one({"_id": ObjectId(message_id)})
    if not m:
        raise HTTPException(status_code=404, detail="Message not found")
    return serialize_doc(m)

@router.post("")
@router.post("/send")
async def send_message(
    receiver_id: str = Form(...),
    message_text: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    sender_id = current_user["id"]
    sender_obj = ObjectId(sender_id) if ObjectId.is_valid(sender_id) else sender_id
    
    if not ObjectId.is_valid(receiver_id):
        raise HTTPException(status_code=400, detail="Invalid receiver ID format")
        
    receiver = await db.users.find_one({"_id": ObjectId(receiver_id)})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver user not found")
        
    # Check valid Faculty ↔ Student relationship
    sender_role = current_user.get("role")
    rec_role = receiver.get("role")
    
    if sender_role != "admin" and rec_role != "admin":
        st_id = sender_id if sender_role == "student" else receiver_id
        fac_id = receiver_id if sender_role == "student" else sender_id
        
        st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
        fac_obj = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
        fac_email = receiver.get("email") if sender_role == "student" else current_user.get("email")
        
        cursor = db.classes.find({
            "$or": [
                {"faculty_id": fac_obj},
                {"faculty_id": str(fac_id)},
                {"faculty_email": fac_email}
            ]
        })
        fac_classes = await cursor.to_list(length=100)
        if not fac_classes:
            all_classes = await db.classes.find().to_list(length=100)
            fac_classes = [c for c in all_classes if str(c.get("faculty_id")) in [str(fac_id), str(fac_obj)] or c.get("faculty_email") == fac_email]
            
        shared = False
        for fc in fac_classes:
            st_list = [str(x) for x in fc.get("student_ids", [])]
            if str(st_id) in st_list or st_obj in fc.get("student_ids", []):
                shared = True
                break
                
        if not shared:
            raise HTTPException(status_code=403, detail="Communication not allowed. Student and Faculty do not share an assigned class.")


            
    attachment_url = None
    if file:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        safe_name = "".join([c for c in file.filename if c.isalnum() or c in ['.', '_', '-']]).strip()
        filename = f"{datetime.now().timestamp()}_{safe_name}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        attachment_url = f"/uploads/messages/{filename}"
        
    msg_doc = {
        "sender_id": sender_obj,
        "sender_name": current_user.get("name", "User"),
        "sender_role": current_user.get("role"),
        "receiver_id": ObjectId(receiver_id),
        "message_text": message_text,
        "attachment_url": attachment_url,
        "read": False,
        "timestamp": datetime.now(timezone.utc)
    }
    
    res = await db.messages.insert_one(msg_doc)
    msg_doc["_id"] = res.inserted_id
    
    await create_notification(
        user_id=receiver_id,
        title=f"New message from {current_user.get('name')}",
        message=message_text[:60] + "..." if len(message_text) > 60 else message_text,
        notif_type="message",
        link="/messages"
    )
    
    return serialize_doc(msg_doc)

@router.post("/{message_id}/reply")
async def reply_to_message(
    message_id: str,
    message_text: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID format")
    orig = await db.messages.find_one({"_id": ObjectId(message_id)})
    if not orig:
        raise HTTPException(status_code=404, detail="Original message not found")
        
    # Send message to original sender
    rec_id = str(orig["sender_id"]) if str(orig["sender_id"]) != current_user["id"] else str(orig["receiver_id"])
    return await send_message(receiver_id=rec_id, message_text=message_text, file=file, current_user=current_user)

@router.post("/{message_id}/read")
async def mark_message_read(message_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID format")
    await db.messages.update_one({"_id": ObjectId(message_id)}, {"$set": {"read": True}})
    return {"message": "Message marked as read"}

