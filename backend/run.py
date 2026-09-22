import uvicorn
import sys
import os

# Append the directory containing app to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings

if __name__ == "__main__":
    is_prod = bool(
        os.getenv("RENDER")
        or os.getenv("ENVIRONMENT") == "production"
        or os.getenv("NODE_ENV") == "production"
    )
    # Never use reload in production
    reload_flag = False if is_prod else (os.getenv("RELOAD", "false").lower() in ("true", "1", "yes"))
    
    port_env = os.getenv("PORT")
    port = int(port_env) if port_env and port_env.isdigit() else settings.PORT
    host = os.getenv("HOST", settings.HOST)

    print(f"Starting server on {host}:{port} (reload={reload_flag}, production={is_prod})")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload_flag
    )

