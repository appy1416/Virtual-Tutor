import base64
import httpx
import os
import uuid
from gtts import gTTS
from app.config import settings

class VoiceService:
    @staticmethod
    async def speech_to_text(audio_bytes: bytes, content_type: str) -> str:
        """
        Transcribe audio using Whisper API (OpenAI or Groq), with automatic seamless
        fallback to Gemini Flash multimodal audio transcription if Whisper quota is exhausted or errors occur.
        """
        if not audio_bytes or len(audio_bytes) < 32:
            return ""

        # Determine extension and sanitized mime type
        ext = "webm"
        mime_type = content_type or "audio/webm"
        if "wav" in content_type:
            ext = "wav"
            mime_type = "audio/wav"
        elif "mp3" in content_type:
            ext = "mp3"
            mime_type = "audio/mp3"
        elif "ogg" in content_type:
            ext = "ogg"
            mime_type = "audio/ogg"
        elif "mp4" in content_type or "m4a" in content_type:
            ext = "mp4"
            mime_type = "audio/mp4"

        # Check for Whisper API Key (WHISPER_API_KEY override or OPENAI_API_KEY)
        whisper_key = (
            getattr(settings, "WHISPER_API_KEY", "")
            or os.getenv("WHISPER_API_KEY", "")
            or settings.OPENAI_API_KEY
            or os.getenv("OPENAI_API_KEY", "")
        ).strip()

        # 1. Attempt Whisper API if key is available
        if whisper_key:
            # Determine endpoint and model
            custom_url = getattr(settings, "WHISPER_API_URL", "") or os.getenv("WHISPER_API_URL", "")
            custom_model = getattr(settings, "WHISPER_MODEL", "") or os.getenv("WHISPER_MODEL", "")
            
            is_groq = whisper_key.startswith("gsk_")
            if custom_url:
                endpoint = custom_url
                model = custom_model or ("whisper-large-v3" if is_groq else "whisper-1")
            elif is_groq:
                endpoint = "https://api.groq.com/openai/v1/audio/transcriptions"
                model = custom_model or "whisper-large-v3"
            else:
                endpoint = "https://api.openai.com/v1/audio/transcriptions"
                model = custom_model or "whisper-1"

            try:
                async with httpx.AsyncClient(timeout=35.0) as client:
                    headers = {"Authorization": f"Bearer {whisper_key}"}
                    files = {"file": (f"audio.{ext}", audio_bytes, mime_type)}
                    data = {"model": model}
                    response = await client.post(endpoint, headers=headers, files=files, data=data)
                    
                    if response.status_code == 200:
                        text = response.json().get("text", "").strip()
                        if text:
                            return text
                    else:
                        print(f"Whisper API responded with {response.status_code}: {response.text[:200]}")
            except Exception as e:
                print(f"Whisper API request exception: {e}")

        # 2. Resilient Fallback to Gemini Flash audio transcription
        gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        if gemini_key:
            try:
                base64_data = base64.b64encode(audio_bytes).decode("utf-8")
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": "Transcribe this audio clip accurately into English text. Return only the exact transcribed words spoken, with no other commentary, formatting, or explanations."},
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": base64_data
                                }
                            }
                        ]
                    }],
                    "generationConfig": {
                        "temperature": 0.0
                    }
                }

                models_to_try = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"]
                async with httpx.AsyncClient(timeout=35.0) as client:
                    for model_name in models_to_try:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                        try:
                            response = await client.post(url, json=payload)
                            if response.status_code == 200:
                                resp_json = response.json()
                                candidates = resp_json.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    if parts:
                                        result_text = parts[0].get("text", "").strip()
                                        if result_text:
                                            return result_text
                            else:
                                print(f"Gemini {model_name} response {response.status_code}: {response.text[:150]}")
                        except Exception as ge:
                            print(f"Gemini {model_name} error: {ge}")
            except Exception as fe:
                print(f"Fallback audio transcription failed: {fe}")

        return "[Error: Speech recognition failed. Please ensure your Whisper API key or Gemini API key is configured with active quota.]"

    @staticmethod
    def text_to_speech(text: str) -> str:
        audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "audio"))
        os.makedirs(audio_dir, exist_ok=True)
        
        filename = f"{uuid.uuid4()}.mp3"
        file_path = os.path.join(audio_dir, filename)
        
        tts = gTTS(text=text, lang='en')
        tts.save(file_path)
        
        return f"/uploads/audio/{filename}"
