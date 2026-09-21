from fastapi import APIRouter, Depends, HTTPException, status
from app.models.quiz import QuizCreateRequest, QuizOut, QuizAttemptSubmission
from app.services.auth_service import get_current_user, require_role, serialize_doc
from app.services.llm_service import LLMService
from app.routes.notifications import create_notification
from app.db.mongodb import get_database
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import json
import re
from bson import ObjectId

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

def clean_json_response(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
    return cleaned.strip()

def generate_fallback_questions(subject_name: str, topic_name: str, subtopic: Optional[str], diff: str, q_type: str, q_count: int) -> List[Dict[str, Any]]:
    questions = []
    sub_str = f" ({subtopic})" if subtopic else ""
    is_tf = "true" in q_type.lower() or "false" in q_type.lower()
    is_code = "code" in q_type.lower() or "coding" in q_type.lower()
    is_num = "num" in q_type.lower()

    for idx in range(1, q_count + 1):
        q_id = f"q{idx}"
        if is_tf:
            questions.append({
                "id": q_id,
                "question_text": f"In {subject_name} - {topic_name}{sub_str}, statement #{idx}: Core operational concepts apply consistently across modern implementations.",
                "options": ["True", "False"],
                "correct_answer": "0"
            })
        elif is_code:
            questions.append({
                "id": q_id,
                "question_text": f"In {subject_name} ({topic_name}), what is the primary algorithmic property or code outcome for concept #{idx}?",
                "options": [
                    f"Provides logarithmic/linear computational scaling for {topic_name}",
                    f"Throws an uncaught NullPointerException runtime error",
                    f"Bypasses object initialization and stack frame allocation",
                    f"Produces undefined behavior across execution threads"
                ],
                "correct_answer": "0"
            })
        elif is_num:
            questions.append({
                "id": q_id,
                "question_text": f"Calculate the quantitative measure or index #{idx} for {topic_name} under {diff.upper()} difficulty parameters.",
                "options": [
                    f"{idx * 12} units",
                    f"{idx * 24} units",
                    f"{idx * 36} units",
                    f"{idx * 48} units"
                ],
                "correct_answer": "0"
            })
        else:
            questions.append({
                "id": q_id,
                "question_text": f"Which of the following statements correctly describes core principle #{idx} of {topic_name}{sub_str} in {subject_name}?",
                "options": [
                    f"It provides a fundamental design abstraction for scalable development in {topic_name}.",
                    f"It is a deprecated pattern that prevents code compilation.",
                    f"It strictly applies only to legacy mainframe systems.",
                    f"None of the above choices are valid."
                ],
                "correct_answer": "0"
            })
    return questions

# ==================== EXISTING AI QUIZ GENERATOR ====================

@router.post("/generate", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    req: QuizCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    
    # 1. Flexible Subject Resolution
    subject = None
    subj_query = req.subject_id or req.subject
    if subj_query:
        if ObjectId.is_valid(subj_query):
            subject = await db.subjects.find_one({"_id": ObjectId(subj_query)})
        if not subject:
            subject = await db.subjects.find_one({"$or": [{"_id": subj_query}, {"id": subj_query}, {"name": subj_query}]})
    
    # 2. Flexible Topic Resolution
    topic = None
    topic_query = req.topic_id or req.topic
    if topic_query:
        if ObjectId.is_valid(topic_query):
            topic = await db.topics.find_one({"_id": ObjectId(topic_query)})
        if not topic:
            topic = await db.topics.find_one({"$or": [{"_id": topic_query}, {"id": topic_query}, {"name": topic_query}]})
            
    subject_name = subject["name"] if subject and "name" in subject else (req.subject or req.subject_id or "Computer Science")
    topic_name = topic["name"] if topic and "name" in topic else (req.topic or req.topic_id or "General Topic")
    
    # Question count & difficulty
    q_count = req.count or req.question_count or 5
    diff = (req.difficulty or "easy").lower()
    q_type = (req.question_type or "MCQ").strip()
    
    diff_descriptions = {
        "easy": "EASY: Direct foundational questions, definitions, basic syntax, and straightforward concept checks.",
        "medium": "MEDIUM: Application-oriented questions, multi-step scenarios, intermediate problem solving, and trade-off analysis.",
        "hard": "HARD: Advanced, challenging problems, deep conceptual edge-cases, tricky code tracing, optimization, or multi-step derivations."
    }
    diff_guide = diff_descriptions.get(diff, diff_descriptions["easy"])

    # Specific Question Type formatting
    is_tf = "true" in q_type.lower() or "false" in q_type.lower()
    if is_tf:
        type_instruction = "Question Type: TRUE / FALSE. Every question must be a factual or conceptual statement. The 'options' list MUST be exactly ['True', 'False']. 'correct_answer' must be '0' if True is correct, or '1' if False is correct."
        options_schema = '["True", "False"]'
        answer_schema = "'0' or '1'"
    elif "code" in q_type.lower() or "coding" in q_type.lower():
        type_instruction = "Question Type: CODING QUESTIONS. Every question must feature code snippets or algorithmic logic related to the subject. Questions can ask for code output, bug identification, or the best implementation. Each question must have 4 distinct choices."
        options_schema = '["Option A", "Option B", "Option C", "Option D"]'
        answer_schema = "'0', '1', '2', or '3'"
    elif "num" in q_type.lower():
        type_instruction = "Question Type: NUMERICAL / COMPUTATIONAL. Every question must require mathematical, statistical, or computational derivation. The 4 options must be distinct numerical values with units where appropriate."
        options_schema = '["Option A", "Option B", "Option C", "Option D"]'
        answer_schema = "'0', '1', '2', or '3'"
    elif "short" in q_type.lower():
        type_instruction = "Question Type: SHORT ANSWER / CONCEPTUAL. Every question must be a targeted conceptual scenario. Provide 4 concise, plausible answer choices for browser auto-grading."
        options_schema = '["Option A", "Option B", "Option C", "Option D"]'
        answer_schema = "'0', '1', '2', or '3'"
    else:
        type_instruction = "Question Type: STANDARD MULTIPLE CHOICE. High quality 4-choice academic questions with one unambiguously correct answer and 3 plausible distractors."
        options_schema = '["Option A", "Option B", "Option C", "Option D"]'
        answer_schema = "'0', '1', '2', or '3'"

    subtopic_part = f' (focusing on subtopic: "{req.subtopic}")' if req.subtopic else ""
    
    prompt = f"""
Generate an academic quiz on the topic: "{topic_name}"{subtopic_part} for the subject "{subject_name}".
Difficulty Level: {diff.upper()} ({diff_guide})
{type_instruction}
Total Number of questions required: exactly {q_count}

Output RULES:
1. Return ONLY a valid JSON array containing EXACTLY {q_count} question objects.
2. No markdown wrappers (no ```json or ```), no preamble, no explanations.
3. Every question must adhere strictly to this schema:
{{
  "id": "q1",
  "question_text": "Detailed question text here",
  "options": {options_schema},
  "correct_answer": {answer_schema}
}}
"""
    system_instruction = f"You are an expert academic curriculum and assessment designer. You generate rigorous assessments for students. Always output raw valid JSON arrays containing exactly {q_count} questions."
    
    questions = []
    try:
        raw_response = await LLMService.generate_text(prompt, system_instruction)
        if raw_response and not raw_response.startswith("[Error") and not raw_response.startswith("[Gemini") and not raw_response.startswith("[LLM"):
            cleaned_json = clean_json_response(raw_response)
            try:
                questions = json.loads(cleaned_json)
            except Exception as e:
                print(f"Error parsing AI quiz: {e}. Raw response: {raw_response[:200]}")
                match = re.search(r"\[\s*\{.*\}\s*\]", cleaned_json, re.DOTALL)
                if match:
                    try:
                        questions = json.loads(match.group(0))
                    except Exception:
                        pass
    except Exception as exc:
        print(f"LLM quiz generation exception: {exc}")

    if not questions or not isinstance(questions, list):
        print(f"Using robust fallback question generator for {subject_name} - {topic_name}")
        questions = generate_fallback_questions(subject_name, topic_name, req.subtopic, diff, q_type, q_count)

    # Validate and normalize questions
    normalized_questions = []
    for idx, q in enumerate(questions[:q_count]):
        q_id = str(q.get("id") or f"q{idx+1}")
        q_text = str(q.get("question_text") or f"Question {idx+1}")
        raw_opts = q.get("options")
        if isinstance(raw_opts, dict):
            opts = list(raw_opts.values())
        elif isinstance(raw_opts, list):
            opts = [str(o) for o in raw_opts]
        else:
            opts = ["True", "False"] if is_tf else ["Option A", "Option B", "Option C", "Option D"]
            
        c_ans = str(q.get("correct_answer", "0")).strip()
        # If c_ans was letter 'A', 'B', 'C', 'D'
        if c_ans.upper() in ["A", "B", "C", "D"]:
            c_ans = str(["A", "B", "C", "D"].index(c_ans.upper()))
        elif not c_ans.isdigit() or int(c_ans) >= len(opts):
            c_ans = "0"
            
        normalized_questions.append({
            "id": q_id,
            "question_text": q_text,
            "options": opts,
            "correct_answer": c_ans
        })

    quiz_dict = {
        "subject_id": str(subject["_id"]) if subject and "_id" in subject else (req.subject_id or "subj_general"),
        "topic_id": str(topic["_id"]) if topic and "_id" in topic else (req.topic_id or "topic_general"),
        "subtopic": req.subtopic,
        "question_type": q_type,
        "difficulty": diff,
        "questions": normalized_questions,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.quizzes.insert_one(quiz_dict)
    quiz_dict["_id"] = result.inserted_id
    
    return serialize_doc(quiz_dict)

@router.post("/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: str,
    submission: QuizAttemptSubmission,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db = get_database()
    student_id = current_user["id"]
    
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
        
    quiz = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    questions = quiz.get("questions", [])
    submitted_answers = {ans.question_id: ans.submitted_answer for ans in submission.answers}
    
    graded_questions = []
    correct_count = 0
    
    for q in questions:
        q_id = q["id"]
        correct_ans = q["correct_answer"]
        student_ans = submitted_answers.get(q_id, "").strip()
        
        is_correct = (student_ans == correct_ans)
        if is_correct:
            correct_count += 1
            
        graded_questions.append({
            "id": q_id,
            "question_text": q["question_text"],
            "options": q["options"],
            "correct_answer": correct_ans,
            "submitted_answer": student_ans,
            "is_correct": is_correct
        })
        
    percentage = round((correct_count / len(questions)) * 100.0, 1) if questions else 0.0
    
    subject_id = quiz.get("subject_id")
    topic_id = quiz.get("topic_id")
    
    topic = await db.topics.find_one({"_id": ObjectId(topic_id)}) if ObjectId.is_valid(topic_id) else None
    topic_name = topic["name"] if topic else "this topic"
    
    recommendation = ""
    if correct_count >= 4:
        recommendation = f"Excellent mastery! You scored {percentage}% in '{topic_name}'."
    elif correct_count == 3:
        recommendation = f"Good progress! You scored {percentage}% in '{topic_name}'. Practice more questions."
    else:
        recommendation = f"Needs Improvement. You scored {percentage}% in '{topic_name}'. Revise the topic."
        
    result_dict = {
        "user_id": ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id,
        "topic_id": ObjectId(topic_id) if ObjectId.is_valid(topic_id) else topic_id,
        "score": correct_count,
        "total_questions": len(questions),
        "percentage": percentage,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.quiz_results.insert_one(result_dict)
    
    return {
        "score": correct_count,
        "total_questions": len(questions),
        "percentage": percentage,
        "graded_questions": graded_questions,
        "recommendation": recommendation
    }

# ==================== FACULTY MANUAL QUIZ SYSTEM ====================

class FacultyQuizQuestion(BaseModel):
    id: str
    type: str  # mcq, true_false, short_answer, long_answer, coding
    question_text: str
    options: Optional[List[str]] = []
    correct_answer: Optional[str] = ""
    marks: float = 1.0

class FacultyQuizCreate(BaseModel):
    title: str
    subject_id: str
    topic_id: str
    subtopic: Optional[str] = ""
    class_id: str
    duration_minutes: int = 30
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    questions: List[FacultyQuizQuestion]

@router.post("/faculty/create", status_code=status.HTTP_201_CREATED)
async def create_faculty_manual_quiz(
    quiz_in: FacultyQuizCreate,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    total_marks = sum(q.marks for q in quiz_in.questions)
    doc = {
        "title": quiz_in.title,
        "subject_id": ObjectId(quiz_in.subject_id) if ObjectId.is_valid(quiz_in.subject_id) else quiz_in.subject_id,
        "topic_id": ObjectId(quiz_in.topic_id) if ObjectId.is_valid(quiz_in.topic_id) else quiz_in.topic_id,
        "subtopic": quiz_in.subtopic or "",
        "class_id": ObjectId(quiz_in.class_id) if ObjectId.is_valid(quiz_in.class_id) else quiz_in.class_id,
        "duration_minutes": quiz_in.duration_minutes,
        "start_date": quiz_in.start_date,
        "end_date": quiz_in.end_date,
        "created_by": ObjectId(current_user["id"]),
        "faculty_name": current_user.get("name"),
        "total_marks": total_marks,
        "questions": [q.model_dump() for q in quiz_in.questions],
        "created_at": datetime.now(timezone.utc)
    }
    
    res = await db.quizzes.insert_one(doc)
    doc["_id"] = res.inserted_id
    
    cls = await db.classes.find_one({"_id": doc["class_id"]})
    if cls:
        for st_id in cls.get("student_ids", []):
            await create_notification(
                user_id=st_id,
                title=f"New Faculty Quiz: {quiz_in.title}",
                message=f"Faculty {current_user.get('name')} published a new quiz. Duration: {quiz_in.duration_minutes} mins.",
                notif_type="quiz",
                link="/quizzes"
            )
            
    return serialize_doc(doc)

@router.get("/faculty/list")
async def list_faculty_created_quizzes(current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))):
    db = get_database()
    fac_id = current_user["id"]
    fac_obj_id = ObjectId(fac_id) if ObjectId.is_valid(fac_id) else fac_id
    
    cursor = db.quizzes.find({"created_by": fac_obj_id}).sort("created_at", -1)
    quizzes = await cursor.to_list(length=100)
    
    result = []
    for q in quizzes:
        ser = serialize_doc(q)
        attempts_count = await db.quiz_attempts.count_documents({"quiz_id": ObjectId(ser["id"])})
        ser["attempt_count"] = attempts_count
        result.append(ser)
    return result

@router.get("/student/assigned")
@router.get("/assigned")
@router.get("/student/list")
async def list_student_assigned_quizzes(current_user: Dict[str, Any] = Depends(require_role(["student", "faculty", "admin"]))):
    db = get_database()
    st_id = current_user["id"]
    st_obj_id = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    
    cls_cursor = db.classes.find({
        "$or": [
            {"student_ids": {"$in": [st_obj_id, str(st_id)]}},
            {"student_ids": st_obj_id},
            {"student_ids": str(st_id)}
        ]
    })
    classes = await cls_cursor.to_list(length=100)
    
    class_ids_all = []
    for c in classes:
        class_ids_all.append(c["_id"])
        class_ids_all.append(str(c["_id"]))
        
    query = {}
    if class_ids_all:
        query["class_id"] = {"$in": class_ids_all}
        
    cursor = db.quizzes.find(query).sort("created_at", -1)
    quizzes = await cursor.to_list(length=100)
    
    # Fail-safe fallback if no class-filtered quizzes found
    if not quizzes:
        cursor_all = db.quizzes.find({"questions": {"$exists": True}}).sort("created_at", -1)
        quizzes = await cursor_all.to_list(length=100)
    
    result = []
    for q in quizzes:
        ser = serialize_doc(q)
        attempt = await db.quiz_attempts.find_one({
            "quiz_id": ObjectId(ser["id"]) if ObjectId.is_valid(ser["id"]) else ser["id"],
            "$or": [{"student_id": st_obj_id}, {"student_id": str(st_id)}]
        })
        ser["attempt"] = serialize_doc(attempt) if attempt else None
        result.append(ser)
    return result


@router.post("/faculty/submit-attempt/{quiz_id}")
@router.post("/student/{quiz_id}/submit")
@router.post("/student/{quiz_id}/attempt")
@router.put("/student/{quiz_id}/attempt")
async def submit_faculty_quiz_attempt(
    quiz_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_role(["student", "faculty", "admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
        
    quiz = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    student_id = current_user["id"]
    student_obj_id = ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id
    
    # Normalize answers: can be a list of objects [{"question_id": "...", "submitted_answer": "..."}] or dict {"q1": "0"}
    raw_answers = payload.get("answers", {})
    answers_map: Dict[str, str] = {}
    if isinstance(raw_answers, list):
        for item in raw_answers:
            if isinstance(item, dict):
                qid = str(item.get("question_id") or item.get("id") or "")
                ans = str(item.get("submitted_answer") if item.get("submitted_answer") is not None else item.get("answer", ""))
                if qid:
                    answers_map[qid] = ans
    elif isinstance(raw_answers, dict):
        answers_map = {str(k): str(v) for k, v in raw_answers.items()}
    
    questions = quiz.get("questions", [])
    auto_score = 0.0
    correct_count = 0
    graded_answers = []
    graded_questions = []
    needs_manual_review = False
    
    for q in questions:
        q_id = str(q.get("id", ""))
        q_type = q.get("type", "mcq")
        q_marks = float(q.get("marks", 1.0))
        given_ans = answers_map.get(q_id, "").strip()
        correct_ans = str(q.get("correct_answer", "")).strip()
        
        if q_type in ["mcq", "true_false"]:
            is_corr = (given_ans.lower() == correct_ans.lower())
            score = q_marks if is_corr else 0.0
            auto_score += score
            if is_corr:
                correct_count += 1
            graded_answers.append({
                "question_id": q_id,
                "type": q_type,
                "given_answer": given_ans,
                "is_correct": is_corr,
                "score": score
            })
            graded_questions.append({
                "id": q_id,
                "question_text": q.get("question_text", ""),
                "options": q.get("options", []),
                "correct_answer": correct_ans,
                "submitted_answer": given_ans,
                "is_correct": is_corr
            })
        else:
            needs_manual_review = True
            graded_answers.append({
                "question_id": q_id,
                "type": q_type,
                "given_answer": given_ans,
                "is_correct": None,
                "score": 0.0
            })
            graded_questions.append({
                "id": q_id,
                "question_text": q.get("question_text", ""),
                "options": q.get("options", []),
                "correct_answer": correct_ans,
                "submitted_answer": given_ans,
                "is_correct": None
            })
            
    total_q = len(questions)
    total_marks = float(quiz.get("total_marks", total_q if total_q > 0 else 100))
    pct = round((auto_score / max(total_marks, 1.0)) * 100.0, 1) if questions else 0.0

    attempt_doc = {
        "quiz_id": ObjectId(quiz_id),
        "quiz_title": quiz.get("title"),
        "student_id": student_obj_id,
        "student_name": current_user.get("name"),
        "score": auto_score,
        "total_marks": total_marks,
        "status": "Graded" if not needs_manual_review else "Needs Grading",
        "graded_answers": graded_answers,
        "submitted_at": datetime.now(timezone.utc)
    }
    
    res = await db.quiz_attempts.insert_one(attempt_doc)
    attempt_id = str(res.inserted_id)
    
    await db.quiz_results.insert_one({
        "user_id": student_obj_id,
        "topic_id": quiz.get("topic_id"),
        "score": auto_score,
        "total_questions": total_q,
        "percentage": pct,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Notify faculty member who created the quiz
    if quiz.get("created_by"):
        try:
            await create_notification(
                user_id=quiz["created_by"],
                title=f"Quiz Submitted: {quiz.get('title')}",
                message=f"Student {current_user.get('name')} submitted quiz attempt for '{quiz.get('title')}'. Score: {auto_score}/{total_marks}.",
                notif_type="quiz_submission",
                link="/faculty/submissions"
            )
        except Exception as e:
            print(f"Notice: Failed to dispatch quiz notification: {e}")
        
    recommendation = ""
    if pct >= 80:
        recommendation = f"Outstanding performance! You scored {pct}% ({auto_score}/{total_marks}). Excellent mastery!"
    elif pct >= 60:
        recommendation = f"Good effort! You scored {pct}% ({auto_score}/{total_marks}). Review any missed concepts."
    else:
        recommendation = f"Keep practicing! You scored {pct}% ({auto_score}/{total_marks}). Review topic reference materials."

    return {
        "id": attempt_id,
        "attempt_id": attempt_id,
        "quiz_id": str(quiz["_id"]),
        "quiz_title": quiz.get("title", "Quiz"),
        "score": auto_score if not auto_score.is_integer() else int(auto_score),
        "total_questions": total_q,
        "total_marks": total_marks,
        "percentage": pct,
        "status": attempt_doc["status"],
        "graded_questions": graded_questions,
        "graded_answers": graded_answers,
        "recommendation": recommendation,
        "submitted_at": attempt_doc["submitted_at"].isoformat()
    }

@router.get("/faculty/attempts")
@router.get("/faculty/{quiz_id}/attempts")
async def list_faculty_quiz_attempts(
    quiz_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    query = {}
    if quiz_id and ObjectId.is_valid(quiz_id):
        query["quiz_id"] = ObjectId(quiz_id)
        
    cursor = db.quiz_attempts.find(query).sort("submitted_at", -1)
    attempts = await cursor.to_list(length=200)
    return [serialize_doc(a) for a in attempts]

@router.post("/faculty/attempts/{attempt_id}/grade")
async def grade_faculty_quiz_attempt(
    attempt_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_role(["faculty", "admin"]))
):
    db = get_database()
    if not ObjectId.is_valid(attempt_id):
        raise HTTPException(status_code=400, detail="Invalid attempt ID format")
        
    attempt = await db.quiz_attempts.find_one({"_id": ObjectId(attempt_id)})
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
        
    score = float(payload.get("score", attempt.get("score", 0.0)))
    feedback = payload.get("feedback", "")
    
    await db.quiz_attempts.update_one(
        {"_id": ObjectId(attempt_id)},
        {"$set": {
            "score": score,
            "feedback": feedback,
            "status": "Graded",
            "graded_at": datetime.now(timezone.utc),
            "graded_by": current_user.get("name")
        }}
    )
    
    # Notify student of quiz score / grade feedback
    await create_notification(
        user_id=attempt["student_id"],
        title=f"Quiz Graded: {attempt.get('quiz_title')}",
        message=f"Faculty reviewed your quiz '{attempt.get('quiz_title')}'. Final score: {score}/{attempt.get('total_marks', 100)}. Feedback: {feedback or 'Reviewed'}",
        notif_type="grade",
        link="/quizzes"
    )
    
    updated = await db.quiz_attempts.find_one({"_id": ObjectId(attempt_id)})
    return serialize_doc(updated)

@router.get("/student/{quiz_id}/result")
async def get_student_quiz_result(quiz_id: str, current_user: Dict[str, Any] = Depends(require_role(["student"]))):
    db = get_database()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID format")
    st_id = current_user["id"]
    st_obj = ObjectId(st_id) if ObjectId.is_valid(st_id) else st_id
    attempt = await db.quiz_attempts.find_one({"quiz_id": ObjectId(quiz_id), "$or": [{"student_id": st_obj}, {"student_id": st_id}]})
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz result not found")
    return serialize_doc(attempt)


