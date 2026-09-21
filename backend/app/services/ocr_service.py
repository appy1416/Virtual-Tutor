import easyocr
import io
import numpy as np
from PIL import Image
from app.services.llm_service import LLMService

class OCRService:
    reader = None

    @classmethod
    def get_reader(cls):
        if cls.reader is None:
            # Initialize EasyOCR reader for English without GPU to avoid CUDA errors
            cls.reader = easyocr.Reader(['en'], gpu=False)
        return cls.reader

    @classmethod
    async def extract_and_solve(cls, image_bytes: bytes, mime_type: str) -> dict:
        extracted_text = ""
        try:
            reader = cls.get_reader()
            image = Image.open(io.BytesIO(image_bytes))
            img_np = np.array(image)
            results = reader.readtext(img_np)
            extracted_text = "\n".join([res[1] for res in results])
        except Exception as e:
            print(f"EasyOCR error: {e}. Falling back to LLM multimodal solution.")

        prompt = f"""
Solve the following academic question step-by-step.
If local OCR was able to extract some text, here it is:
{extracted_text}

Analyze the image carefully, read any formulas or diagrams, and provide a clear, step-by-step educational solution.
Format all mathematical expressions in standard LaTeX (e.g., using $...$ for inline formulas and $$...$$ for block formulas).
"""
        solution = await LLMService.generate_multimodal(prompt, image_bytes, mime_type)
        return {
            "extracted_text": extracted_text,
            "solution": solution
        }
