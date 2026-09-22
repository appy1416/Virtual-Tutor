import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.db.persistent_db import PersistentDatabase

class Database:
    client: AsyncIOMotorClient = None
    db = None
    _connecting = False

db_instance = Database()

async def connect_to_mongo():
    # Avoid duplicate connection initializations
    if db_instance.client is not None or db_instance._connecting:
        return

    db_instance._connecting = True
    try:
        connect_kwargs = {
            "serverSelectionTimeoutMS": 2500,
            "connectTimeoutMS": 2500,
            "socketTimeoutMS": 3000,
            "tlsAllowInvalidCertificates": True,
        }
        try:
            import certifi
            connect_kwargs["tlsCAFile"] = certifi.where()
        except Exception as ce:
            print(f"Notice: certifi CA bundle not loaded ({ce}), using system defaults.")

        client = AsyncIOMotorClient(settings.MONGODB_URL, **connect_kwargs)
        # Test connection with strict timeout
        await client.admin.command("ping")
        db_instance.client = client
        db_instance.db = client[settings.MONGODB_DB_NAME]
        print(f"Database Storage Engine: Connected to MongoDB database ({settings.MONGODB_DB_NAME})")
    except Exception as e:
        print(f"MongoDB Connection Warning: Could not connect to remote MongoDB ({e}). Falling back gracefully to local persistent storage (backend/data/).")
        db_instance.client = None
        db_instance.db = PersistentDatabase()
    finally:
        db_instance._connecting = False

async def close_mongo_connection():
    if db_instance.client:
        try:
            db_instance.client.close()
            db_instance.client = None
            print("Closed MongoDB connection")
        except Exception as e:
            print(f"Error closing MongoDB connection: {e}")

def get_database():
    if db_instance.db is None:
        db_instance.db = PersistentDatabase()
    return db_instance.db

