
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()


def get_firestore():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credentials.ApplicationDefault()
        )

    return firestore.client()
