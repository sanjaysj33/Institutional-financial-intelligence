
from app.firebase_db import get_firestore

try:
    db = get_firestore()

    # Test access to the departments collection
    list(db.collection("departments").limit(1).stream())

    print("Firebase Firestore connection successful!")

except Exception as error:
    print("Firebase connection failed.")
    print(type(error).__name__, str(error))
