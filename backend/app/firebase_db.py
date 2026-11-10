
import firebase_admin
from firebase_admin import firestore

from .security import initialize_firebase_admin


def get_firestore():
    # Reuse the existing Firebase Admin app
    initialize_firebase_admin()

    return firestore.client()
