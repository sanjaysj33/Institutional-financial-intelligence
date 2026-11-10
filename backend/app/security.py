import os
import json
import firebase_admin
from firebase_admin import credentials, initialize_app, get_app

def initialize_firebase_admin():
    try:
        return get_app()
    except ValueError:
        pass

    firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    if not firebase_json:
        raise RuntimeError("Firebase credentials not configured")

    firebase_info = json.loads(firebase_json)
    cred = credentials.Certificate(firebase_info)

    return initialize_app(cred)
