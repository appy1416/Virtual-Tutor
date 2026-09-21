import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, "c:/Users/ASHWITH REDDY/OneDrive/Desktop/AI VIRTUAL TUTOR/backend")
load_dotenv("c:/Users/ASHWITH REDDY/OneDrive/Desktop/AI VIRTUAL TUTOR/backend/.env")

from app.services.llm_service import LLMService

async def main():
    prompt = 'Explain the educational concept: "What is recursion?"'
    sys_inst = "You are a professional educational Virtual AI Tutor. You only respond with valid structured JSON objects."
    res = await LLMService.generate_text(prompt, sys_inst)
    print("AI Tutor Response Result:")
    print(res[:500])

if __name__ == "__main__":
    asyncio.run(main())
