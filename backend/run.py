import uvicorn
import sys
import os

# Append the directory containing app to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
