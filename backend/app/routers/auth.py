from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from firebase_admin import auth, firestore
from firebase_admin.exceptions import FirebaseError

router = APIRouter(prefix='/api/auth', tags=['authentication'])

class StaffAccountCreate(BaseModel):
    email: EmailStr
    temporary_password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=2, max_length=120)

def owner(request: Request):
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(401, 'Sign in required.')
    if user['role'] != 'owner':
        raise HTTPException(403, 'Only the Owner can perform this action.')
    return user

@router.get('/me')
def me(request: Request):
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(401, 'Sign in required.')
    return user

@router.post('/staff', status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffAccountCreate, request: Request):
    creator = owner(request)
    email = str(payload.email).lower().strip()
    try:
        user = auth.create_user(email=email, password=payload.temporary_password, display_name=payload.display_name.strip(), email_verified=False)
        auth.set_custom_user_claims(user.uid, {'role': 'staff'})
        firestore.client().collection('campusledgerUsers').document(user.uid).set({
            'uid': user.uid, 'email': email, 'display_name': payload.display_name.strip(), 'role': 'staff',
            'is_active': True, 'created_by': creator['uid'], 'created_at': datetime.now(timezone.utc).isoformat()
        })
        return {'uid': user.uid, 'email': email, 'role': 'staff', 'message': 'Staff account created.'}
    except auth.EmailAlreadyExistsError:
        raise HTTPException(409, 'An account with this email already exists.')
    except (ValueError, FirebaseError) as exc:
        raise HTTPException(400, 'Unable to create staff account. Check Firebase configuration.') from exc

@router.get('/staff')
def list_staff(request: Request):
    owner(request)
    return [doc.to_dict() for doc in firestore.client().collection('campusledgerUsers').where('role', '==', 'staff').stream()]

@router.patch('/staff/{uid}/disable')
def disable_staff(uid: str, request: Request):
    owner(request)
    try:
        auth.update_user(uid, disabled=True)
        firestore.client().collection('campusledgerUsers').document(uid).update({'is_active': False})
        return {'uid': uid, 'is_active': False}
    except (ValueError, FirebaseError) as exc:
        raise HTTPException(404, 'Staff account not found or could not be disabled.') from exc
