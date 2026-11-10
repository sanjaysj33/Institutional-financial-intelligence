import os, sys
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import auth, credentials, firestore

def main():
    path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    email = os.environ.get('CAMPUSLEDGER_OWNER_EMAIL', '').strip().lower()
    password = os.environ.get('CAMPUSLEDGER_OWNER_PASSWORD', '')
    name = os.environ.get('CAMPUSLEDGER_OWNER_NAME', 'CampusLedger Owner').strip()
    if not path or not email or not password:
        sys.exit('Set GOOGLE_APPLICATION_CREDENTIALS, CAMPUSLEDGER_OWNER_EMAIL, and CAMPUSLEDGER_OWNER_PASSWORD.')
    if len(password) < 14:
        sys.exit('Owner password must be at least 14 characters.')
    firebase_admin.initialize_app(credentials.Certificate(path))
    try:
        user = auth.get_user_by_email(email)
        print('Account already exists; password was not reset.')
    except auth.UserNotFoundError:
        user = auth.create_user(email=email, password=password, display_name=name, email_verified=False)
    auth.set_custom_user_claims(user.uid, {'role': 'owner'})
    firestore.client().collection('campusledgerUsers').document(user.uid).set({
        'uid': user.uid, 'email': email, 'display_name': name, 'role': 'owner', 'is_active': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    }, merge=True)
    print(f'Owner role configured for {email}. Firebase Auth manages the password hash.')
if __name__ == '__main__': main()
