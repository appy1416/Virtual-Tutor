from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.db.persistent_db import PersistentDatabase
import asyncio

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    if db_instance.db is not None:
        return
    try:
        connect_kwargs = {
            "serverSelectionTimeoutMS": 2000,
            "connectTimeoutMS": 2000,
            "socketTimeoutMS": 3000,
            "tlsAllowInvalidCertificates": True,
        }
        try:
            import certifi
            connect_kwargs["tlsCAFile"] = certifi.where()
        except Exception:
            pass

        client = AsyncIOMotorClient(settings.MONGODB_URL, **connect_kwargs)
        # Test connection
        await client.admin.command("ping")
        db_instance.client = client
        db_instance.db = client[settings.MONGODB_DB_NAME]
        print(f"Database Storage Engine: Connected to MongoDB database ({settings.MONGODB_DB_NAME})")
    except Exception:
        print("Database Storage Engine: Active local persistent disk-backed storage (backend/data/)")
        db_instance.db = PersistentDatabase()

async def close_mongo_connection():
    if db_instance.client:
        try:
            db_instance.client.close()
            print("Closed MongoDB connection")
        except Exception:
            pass

def get_database():
    if db_instance.db is None:
        db_instance.db = PersistentDatabase()
    return db_instance.db
