import io
import re
from typing import Optional
from app.services.llm_service import LLMService

class OCRService:
    reader = None
    _easyocr_available = None

    @classmethod
    def get_reader(cls):
        if cls._easyocr_available is False:
            return None
        if cls.reader is None:
            try:
                import easyocr
                # Initialize EasyOCR reader for English without GPU to avoid CUDA errors
                cls.reader = easyocr.Reader(['en'], gpu=False)
                cls._easyocr_available = True
            except Exception as e:
                print(f"EasyOCR not available or failed to load: {e}. Multimodal LLM will be used directly.")
                cls.reader = None
                cls._easyocr_available = False
        return cls.reader

    @classmethod
    async def extract_and_solve(cls, image_bytes: bytes, mime_type: str) -> dict:
        extracted_text = ""
        reader = cls.get_reader()
        if reader is not None:
            try:
                from PIL import Image
                import numpy as np
                image = Image.open(io.BytesIO(image_bytes))
                img_np = np.array(image)
                results = reader.readtext(img_np)
                extracted_text = "\n".join([res[1] for res in results])
            except Exception as e:
                print(f"EasyOCR error: {e}. Falling back to LLM multimodal solution.")

        prompt = f"""
Analyze the provided image carefully.
Solve the academic question step-by-step.
{"Local OCR text extracted from the image:\n" + extracted_text if extracted_text else "Please read all text, mathematical formulas, equations, or diagrams in the image."}

Provide a clear, step-by-step educational solution.
Format all mathematical expressions in standard LaTeX (using $...$ for inline formulas and $$...$$ for block formulas).
"""
        solution = await LLMService.generate_multimodal(prompt, image_bytes, mime_type)
        if not extracted_text and solution:
            extracted_text = "Academic question extracted from image."

        return {
            "extracted_text": extracted_text,
            "solution": solution
        }
