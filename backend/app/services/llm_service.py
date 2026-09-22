import httpx
import base64
from typing import Optional, Dict, Any, List
from app.config import settings

class LLMService:
    @staticmethod
    async def generate_text(prompt: str, system_instruction: Optional[str] = None) -> str:
        """
        Generates text response using the configured LLM provider (Gemini or OpenAI).
        """
        if settings.LLM_PROVIDER == "openai":
            return await LLMService._call_openai(prompt, system_instruction)
        else:
            return await LLMService._call_gemini(prompt, system_instruction)

    @staticmethod
    async def generate_multimodal(prompt: str, image_bytes: bytes, mime_type: str) -> str:
        """
        Processes image inputs for diagram analysis, handwriting OCR, and math solving.
        """
        if settings.LLM_PROVIDER == "openai":
            return await LLMService._call_openai_multimodal(prompt, image_bytes, mime_type)
        else:
            return await LLMService._call_gemini_multimodal(prompt, image_bytes, mime_type)

    @staticmethod
    async def _call_gemini(prompt: str, system_instruction: Optional[str] = None) -> str:
        if not settings.GEMINI_API_KEY:
            return "[Error: GEMINI_API_KEY is not set in .env. Please configure it to run AI doubt-solving.]"

        contents = {
            "parts": [{"text": prompt}]
        }
        
        payload = {
            "contents": [contents],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 2048
            }
        }
        
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        models_to_try = [
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemini-3.1-flash-lite"
        ]
        last_error = ""

        async with httpx.AsyncClient(timeout=15.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        resp_json = response.json()
                        candidates = resp_json.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts:
                                return parts[0].get("text", "")
                        return ""
                    else:
                        last_error = f"[Gemini API Error: {response.status_code} - {response.text}]"
                except Exception as e:
                    last_error = f"[LLM Connection Error: {str(e)}]"

        # Fallback to OpenAI if configured
        if settings.OPENAI_API_KEY:
            try:
                openai_res = await LLMService._call_openai(prompt, system_instruction)
                if openai_res and not openai_res.startswith("[Error") and not openai_res.startswith("[OpenAI"):
                    return openai_res
            except Exception:
                pass

        return last_error

    @staticmethod
    async def _call_gemini_multimodal(prompt: str, image_bytes: bytes, mime_type: str) -> str:
        if not settings.GEMINI_API_KEY:
            return "[Error: GEMINI_API_KEY is not set in .env.]"

        base64_data = base64.b64encode(image_bytes).decode("utf-8")
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_data
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.1
            }
        }

        models_to_try = [
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemini-3.1-flash-lite"
        ]
        last_error = ""

        async with httpx.AsyncClient(timeout=15.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        resp_json = response.json()
                        candidates = resp_json.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts:
                                return parts[0].get("text", "")
                        return ""
                    else:
                        last_error = f"[Gemini Multimodal Error: {response.status_code} - {response.text}]"
                except Exception as e:
                    last_error = f"[LLM Multimodal Connection Error: {str(e)}]"

        if settings.OPENAI_API_KEY:
            try:
                openai_res = await LLMService._call_openai_multimodal(prompt, image_bytes, mime_type)
                if openai_res and not openai_res.startswith("[Error") and not openai_res.startswith("[OpenAI"):
                    return openai_res
            except Exception:
                pass

        return last_error

    @staticmethod
    async def _call_openai(prompt: str, system_instruction: Optional[str] = None) -> str:
        if not settings.OPENAI_API_KEY:
            return "[Error: OPENAI_API_KEY is not set in .env. Please configure it.]"

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": "gpt-4o",
            "messages": messages,
            "temperature": 0.3
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code != 200:
                    return f"[OpenAI API Error: {response.status_code} - {response.text}]"
                
                resp_json = response.json()
                text = resp_json["choices"][0]["message"]["content"]
                return text
            except Exception as e:
                return f"[LLM Connection Error: {str(e)}]"

    @staticmethod
    async def _call_openai_multimodal(prompt: str, image_bytes: bytes, mime_type: str) -> str:
        if not settings.OPENAI_API_KEY:
            return "[Error: OPENAI_API_KEY is not set in .env.]"

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        base64_data = base64.b64encode(image_bytes).decode("utf-8")
        image_url = f"data:{mime_type};base64,{base64_data}"
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            "temperature": 0.1
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code != 200:
                    return f"[OpenAI Multimodal Error: {response.status_code} - {response.text}]"
                
                resp_json = response.json()
                text = resp_json["choices"][0]["message"]["content"]
                return text
            except Exception as e:
                return f"[LLM Multimodal Connection Error: {str(e)}]"

    @staticmethod
    async def generate_embedding(text: str) -> List[float]:
        """
        Generates an embedding vector for a single string using Gemini (text-embedding-004) or OpenAI.
        Falls back to a deterministic hashing embedding if APIs are unavailable.
        """
        results = await LLMService.generate_embeddings([text])
        return results[0] if results else LLMService._fallback_embedding(text)

    @staticmethod
    async def generate_embeddings(texts: List[str]) -> List[List[float]]:
        """
        Generates embedding vectors for a list of strings using Gemini text-embedding-004 or OpenAI text-embedding-3-small.
        """
        if not texts:
            return []

        # 1. Try Gemini Embeddings if configured
        if settings.GEMINI_API_KEY:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key={settings.GEMINI_API_KEY}"
                requests_payload = [
                    {
                        "model": "models/text-embedding-004",
                        "content": {"parts": [{"text": t[:2048]}]}
                    }
                    for t in texts
                ]
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(url, json={"requests": requests_payload})
                    if response.status_code == 200:
                        data = response.json()
                        embeddings = []
                        for item in data.get("embeddings", []):
                            embeddings.append(item.get("values", []))
                        if len(embeddings) == len(texts):
                            return embeddings
            except Exception as ge:
                print(f"Gemini embedding API error: {ge}")

        # 2. Try OpenAI Embeddings if configured
        if settings.OPENAI_API_KEY:
            try:
                url = "https://api.openai.com/v1/embeddings"
                headers = {
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "text-embedding-3-small",
                    "input": [t[:2048] for t in texts]
                }
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(url, json=payload, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        raw_data = sorted(data.get("data", []), key=lambda x: x.get("index", 0))
                        embeddings = [item["embedding"] for item in raw_data]
                        if len(embeddings) == len(texts):
                            return embeddings
            except Exception as oe:
                print(f"OpenAI embedding API error: {oe}")

        # 3. Deterministic lightweight fallback (e.g. for offline / local tests)
        return [LLMService._fallback_embedding(t) for t in texts]

    @staticmethod
    def _fallback_embedding(text: str, dim: int = 384) -> List[float]:
        """
        Creates a fast, deterministic pseudo-embedding based on character n-grams and hashing.
        Allows ChromaDB vector storage and query retrieval to work without external API keys or heavy models.
        """
        import hashlib
        import math
        vec = [0.0] * dim
        clean_words = text.lower().split()
        if not clean_words:
            return vec
        for word in clean_words:
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % dim
            sign = 1.0 if ((h >> 8) & 1) else -1.0
            vec[idx] += sign
        # Normalize vector
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec
