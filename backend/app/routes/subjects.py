from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import get_current_user, serialize_doc
from app.db.mongodb import get_database
from bson import ObjectId
from typing import List, Dict, Any

router = APIRouter(prefix="/api/subjects", tags=["subjects"])

@router.get("")
async def list_subjects(current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    cursor = db.subjects.find()
    subjects = await cursor.to_list(length=100)
    result = []
    for s in subjects:
        s_dict = serialize_doc(s)
        t_cursor = db.topics.find({"subject_id": s["_id"]})
        topics = await t_cursor.to_list(length=100)
        s_dict["topics"] = [serialize_doc(t) for t in topics]
        result.append(s_dict)
    return result

@router.get("/{subject_id}/topics")
async def list_subject_topics(subject_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(subject_id):
        raise HTTPException(status_code=400, detail="Invalid subject ID")
    
    cursor = db.topics.find({"subject_id": ObjectId(subject_id)})
    topics = await cursor.to_list(length=100)
    return [serialize_doc(t) for t in topics]

@router.get("/topics/{topic_id}")
async def get_topic_details(topic_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(topic_id):
        raise HTTPException(status_code=400, detail="Invalid topic ID")
        
    topic = await db.topics.find_one({"_id": ObjectId(topic_id)})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    # Also attach the parent subject name
    subject = await db.subjects.find_one({"_id": topic["subject_id"]})
    topic_serialized = serialize_doc(topic)
    topic_serialized["subject_name"] = subject["name"] if subject else "Unknown"
    
    return topic_serialized

@router.get("/analytics")
async def get_student_analytics(current_user: Dict[str, Any] = Depends(get_current_user)):
    from app.services.analytics_service import AnalyticsService
    return await AnalyticsService.get_student_analytics(current_user["id"])

async def seed_subjects_db():
    from app.db.seed_data import seed_real_database
    await seed_real_database()


@router.get("/topics/subtopics/explain")
async def explain_subtopic(
    subject_name: str,
    topic_name: str,
    subtopic: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    prompt = f"""
Generate structured learning material for:
Subject: {subject_name}
Topic: {topic_name}
Subtopic: {subtopic}

You must output a VALID JSON object matching the following structure exactly. Do not include markdown tags like ```json.
{{
  "explanation": "Detailed, clear, educational academic explanation of the concepts in this subtopic. Highlight critical parts using standard spacing.",
  "examples": "Provide clear code examples (with comments) or conceptual walkthrough scenarios showcasing the subtopic in practice.",
  "key_concepts": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3"
  ],
  "flashcards": [
    {{"front": "Question/Term for card front", "back": "Detailed definition/explanation for card back"}},
    {{"front": "Question/Term for card front", "back": "Detailed definition/explanation for card back"}},
    {{"front": "Question/Term for card front", "back": "Detailed definition/explanation for card back"}}
  ],
  "practice": [
    {{
      "question": "A multiple-choice conceptual practice question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0
    }}
  ]
}}
"""
    system_instruction = "You are a professional teaching assistant. You only output raw valid JSON structures."
    try:
        from app.services.llm_service import LLMService
        import json
        
        raw_res = await LLMService.generate_text(prompt, system_instruction)
        
        cleaned = raw_res.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("\n", 1)[0]
        cleaned = cleaned.strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
            
        data = json.loads(cleaned)
        return data
    except Exception as e:
        print(f"Error generating subtopic details: {e}")
        return {
            "explanation": f"Study explanation for {subtopic} under {topic_name}.",
            "examples": "// Example code placeholder\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Learning " + subtopic + "\");\n  }\n}",
            "key_concepts": [
                f"Core foundations of {subtopic}",
                "Practical implementation guidelines",
                "Testing and validation cases"
            ],
            "flashcards": [
                {"front": f"What is the primary role of {subtopic}?", "back": "Serves as a fundamental structure for academic learning and curriculum."},
                {"front": f"Key component of {subtopic}", "back": "Encourages interaction, problem solving, and practice."}
            ],
            "practice": [
                {
                    "question": f"Which of the following is correct regarding {subtopic}?",
                    "options": ["It is a core concept", "It is obsolete", "It is non-functional", "None of the above"],
                    "correct_index": 0
                }
            ]
        }
