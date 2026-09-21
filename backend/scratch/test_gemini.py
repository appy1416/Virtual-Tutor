import os
import httpx
from dotenv import load_dotenv

load_dotenv("c:/Users/ASHWITH REDDY/OneDrive/Desktop/AI VIRTUAL TUTOR/backend/.env")
gemini_key = os.getenv("GEMINI_API_KEY")

candidates = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite"
]

for model_name in candidates:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
    payload = {"contents": [{"parts": [{"text": "Hello, respond with SUCCESS"}]}]}
    try:
        r = httpx.post(url, json=payload, timeout=10.0)
        print(f"Test {model_name}: status {r.status_code}")
        if r.status_code == 200:
            print("   RESPONSE:", r.json()["candidates"][0]["content"]["parts"][0]["text"])
        else:
            print("   ERROR:", r.text[:200])
    except Exception as e:
        print(f"Test {model_name} exception:", e)
