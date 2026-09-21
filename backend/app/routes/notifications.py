from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import get_current_user, serialize_doc
from app.db.mongodb import get_database
from bson import ObjectId
from datetime import datetime, timezone
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
student_notif_router = APIRouter(prefix="/api/student/notifications", tags=["student-notifications"])

def serialize_notification(doc: Dict[str, Any]) -> Dict[str, Any]:
    ser = serialize_doc(doc)
    doc_id = str(doc.get("_id", ""))
    rec_id = str(doc.get("recipient_id") or doc.get("user_id") or "")
    ser["notification_id"] = doc_id
    ser["id"] = doc_id
    ser["recipient_id"] = rec_id
    ser["student_id"] = rec_id
    ser["sender_id"] = str(doc.get("sender_id") or "")
    ser["related_id"] = str(doc.get("related_id") or "")
    ser["type"] = doc.get("type", "info")
    ser["title"] = doc.get("title", "")
    ser["message"] = doc.get("message", "")
    ser["link"] = doc.get("link", "")
    ser["read"] = bool(doc.get("read", False))
    return ser

async def create_notification(
    user_id: Any,
    title: str,
    message: str,
    notif_type: str = "info",
    link: Optional[str] = None,
    related_id: Optional[str] = None,
    sender_id: Optional[str] = None
):
    try:
        db = get_database()
        u_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else str(user_id)
        doc = {
            "user_id": u_obj,
            "recipient_id": str(user_id),
            "title": title,
            "message": message,
            "type": notif_type,
            "link": link or "",
            "related_id": str(related_id) if related_id else "",
            "sender_id": str(sender_id) if sender_id else "",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        res = await db.notifications.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize_notification(doc)
    except Exception as e:
        print(f"Error creating notification: {e}")
        return None

async def fetch_user_notifications(current_user: Dict[str, Any]):
    db = get_database()
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    cursor = db.notifications.find({
        "$or": [
            {"user_id": user_obj_id},
            {"user_id": str(user_id)},
            {"recipient_id": str(user_id)}
        ]
    }).sort("created_at", -1)
    
    notifications = await cursor.to_list(length=100)
    unread_count = sum(1 for n in notifications if not n.get("read", False))
    
    return {
        "notifications": [serialize_notification(n) for n in notifications],
        "unread_count": unread_count
    }

@router.get("")
async def list_notifications(current_user: Dict[str, Any] = Depends(get_current_user)):
    return await fetch_user_notifications(current_user)

@student_notif_router.get("")
async def student_list_notifications(current_user: Dict[str, Any] = Depends(get_current_user)):
    return await fetch_user_notifications(current_user)

@router.get("/unread")
async def list_unread_notifications(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    cursor = db.notifications.find({
        "$or": [
            {"user_id": user_obj_id},
            {"user_id": str(user_id)},
            {"recipient_id": str(user_id)}
        ],
        "read": False
    }).sort("created_at", -1)
    
    notifications = await cursor.to_list(length=100)
    return {
        "notifications": [serialize_notification(n) for n in notifications],
        "unread_count": len(notifications)
    }

@router.put("/{notification_id}/read")
@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID format")
        
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@router.put("/read-all")
@router.post("/read-all")
async def mark_all_notifications_read(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    await db.notifications.update_many(
        {"$or": [
            {"user_id": user_obj_id},
            {"user_id": str(user_id)},
            {"recipient_id": str(user_id)}
        ]},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}

@router.delete("/clear-all")
@student_notif_router.delete("/clear-all")
async def clear_all_notifications(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["id"]
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    await db.notifications.delete_many(
        {"$or": [
            {"user_id": user_obj_id},
            {"user_id": str(user_id)},
            {"recipient_id": str(user_id)}
        ]}
    )
    return {"success": True, "message": "All notifications cleared permanently"}

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID format")
    await db.notifications.delete_one({"_id": ObjectId(notification_id)})
    return {"message": "Notification deleted"}


