from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from app.services.auth_service import get_current_user
from app.services.llm_service import LLMService
from app.services.rag_service import extract_text_from_file
from app.services.ocr_service import OCRService
from app.services.voice_service import VoiceService
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from urllib.parse import quote_plus
import json
import re
import os
import shutil
from tempfile import NamedTemporaryFile

router = APIRouter(prefix="/api/ai-tutor", tags=["ai-tutor"])

class TutorQueryRequest(BaseModel):
    question: str
    subject_name: Optional[str] = None
    topic_name: Optional[str] = None
    subtopic: Optional[str] = None

def clean_json_response(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
    return cleaned.strip()

@router.post("/ask")
async def ask_ai_tutor(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    content_type = request.headers.get("content-type", "")
    question = ""
    subject_name = None
    topic_name = None
    subtopic = None
    file_upload: Optional[UploadFile] = None
    file_name = None
    
    if "multipart/form-data" in content_type:
        form = await request.form()
        question = str(form.get("question", "")).strip()
        subject_name = form.get("subject_name")
        topic_name = form.get("topic_name")
        subtopic = form.get("subtopic")
        form_file = form.get("file")
        if form_file and hasattr(form_file, "filename") and form_file.filename:
            file_upload = form_file
            file_name = form_file.filename
    else:
        try:
            body = await request.json()
            question = str(body.get("question", "")).strip()
            subject_name = body.get("subject_name")
            topic_name = body.get("topic_name")
            subtopic = body.get("subtopic")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid request body")
            
    if not question and not file_upload:
        raise HTTPException(status_code=400, detail="Question or attached file cannot be empty")
        
    extracted_doc_text = ""
    if file_upload:
        # Validate file size <= 20MB
        file_bytes = await file_upload.read()
        if len(file_bytes) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Attached file exceeds maximum 20MB limit")
            
        file_mime = file_upload.content_type or ""
        ext = os.path.splitext(file_name)[1].lower()
        
        # Allowed formats
        allowed_extensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx", ".txt", ".pptx"]
        if ext not in allowed_extensions and not file_mime.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}. Supported: PDF, Images, DOCX, TXT.")
            
        if file_mime.startswith("image/") or ext in [".png", ".jpg", ".jpeg", ".webp"]:
            try:
                ocr_res = await OCRService.extract_and_solve(file_bytes, file_mime or "image/png")
                extracted_doc_text = ocr_res.get("extracted_text") or ocr_res.get("solution") or ""
            except Exception as oe:
                print(f"OCR analysis error: {oe}")
                extracted_doc_text = "[Image could not be fully transcribed via OCR]"
        else:
            # Document handling (PDF, DOCX, TXT)
            temp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "temp"))
            os.makedirs(temp_dir, exist_ok=True)
            temp_file_path = os.path.join(temp_dir, f"tutor_{file_name}")
            try:
                with open(temp_file_path, "wb") as f:
                    f.write(file_bytes)
                file_type_tag = "pdf" if ext == ".pdf" else ("docx" if ext == ".docx" else "text")
                pages = extract_text_from_file(temp_file_path, file_type_tag)
                extracted_doc_text = "\n".join([p["text"] for p in pages if p.get("text")])
            except Exception as de:
                print(f"Document extraction error: {de}")
                extracted_doc_text = f"[Error reading document: {str(de)}]"
            finally:
                if os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                    except Exception:
                        pass

    context_header = ""
    if subject_name or topic_name:
        context_header = f" (Context: Subject '{subject_name or ''}', Topic '{topic_name or ''}', Subtopic '{subtopic or ''}')"

    attachment_snippet = ""
    if extracted_doc_text:
        attachment_snippet = f"\n\n[Uploaded Document Content '{file_name}']:\n{extracted_doc_text[:4000]}\n"

    effective_question = question if question else f"Explain and analyze the attached document: {file_name}"

    prompt = f"""
Explain the educational concept or question: "{effective_question}"{context_header}{attachment_snippet}

You must respond with a VALID JSON object. Do not include any conversational text or markdown code blocks (like ```json).
The JSON object must have exactly these keys:
{{
  "explanation": "A simple, clear, step-by-step academic explanation answering the question or analyzing the uploaded document.",
  "example": "A clear, concrete example, code snippet, or walkthrough illustrating the concept.",
  "important_points": ["Point 1", "Point 2", "Point 3"]
}}
"""
    system_instruction = "You are a professional educational Virtual AI Tutor. You only respond with valid structured JSON objects."
    
    raw_response = await LLMService.generate_text(prompt, system_instruction)
    cleaned_json = clean_json_response(raw_response)
    
    search_term = effective_question.strip()
    if topic_name:
        search_term = f"{topic_name} {search_term}"
    elif subject_name:
        search_term = f"{subject_name} {search_term}"
        
    yt_query = quote_plus(f"{search_term[:50]} lecture tutorial")
    yt_search_url = f"https://www.youtube.com/results?search_query={yt_query}"
    
    youtube_resources = [
        {
            "title": f"Watch '{search_term[:40]}' Video Tutorial",
            "url": yt_search_url,
            "description": "Click to open relevant educational video lessons on YouTube in a new tab.",
            "channel": "YouTube Education"
        }
    ]

    try:
        data = json.loads(cleaned_json)
        data["youtube_resources"] = youtube_resources
        data["file_name"] = file_name
        return data
    except Exception as e:
        print(f"Error parsing AI Tutor response: {e}. Raw response was: {raw_response}")
        match = re.search(r"\{\s*\"explanation\".*\}", cleaned_json, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                parsed["youtube_resources"] = youtube_resources
                parsed["file_name"] = file_name
                return parsed
            except Exception:
                pass
        
        return {
            "explanation": raw_response,
            "example": "Please see explanation above.",
            "important_points": ["Review the uploaded topic and concept in detail.", "Formulate another query to retry structured view."],
            "youtube_resources": youtube_resources,
            "file_name": file_name
        }

class ExamGenerateRequest(BaseModel):
    subject: str
    topic: str
    difficulty: str
    count: int = 5

@router.post("/generate-exam")
async def generate_exam_paper(
    req: ExamGenerateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    prompt = f"""
Generate an academic written exam paper on the topic: "{req.topic}" for the subject "{req.subject}".
Difficulty: {req.difficulty.upper()}
Number of questions: {req.count}

Provide a complete, professional exam paper with instructions, questions, and a hidden "Answer Key" section at the end.
You must return the exam paper in clean Markdown format. Do not use JSON wrappers, just output clean Markdown.
"""
    system_instruction = "You are a professional university professor. You write high-quality academic exam papers."
    raw_response = await LLMService.generate_text(prompt, system_instruction)
    return {"exam_paper": raw_response}


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Transcribe recorded audio file from the user's microphone into text.
    Acts as a resilient, universal fallback when browser Web Speech API fails with 'network' or isn't supported.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")
        
    content_type = file.content_type or "audio/webm"
    audio_bytes = await file.read()
    
    if len(audio_bytes) < 64:
        raise HTTPException(status_code=400, detail="Recorded audio was empty or too short. Please speak clearly and try again.")
        
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file exceeds the 25MB limit.")
        
    try:
        transcript = await VoiceService.speech_to_text(audio_bytes, content_type)
        if transcript.startswith("[Error"):
            raise HTTPException(status_code=502, detail=f"Audio transcription service failed: {transcript}")
        return {"text": transcript}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Audio transcription exception: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

