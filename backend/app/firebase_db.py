
import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

def get_firestore():
    if not firebase_admin._apps:
        credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        if not credential_path:
            raise RuntimeError(
                "Firebase credentials path missing from backend/.env"
            )

        credential = credentials.Certificate(credential_path)
        firebase_admin.initialize_app(credential)

    return firestore.client()
