
from fastapi import Request
from fastapi.responses import JSONResponse
from firebase_admin import auth, credentials, initialize_app, get_app
from firebase_admin.exceptions import FirebaseError
import os


def initialize_firebase_admin():
    try:
        get_app()
    except ValueError:
        credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if credential_path:
            initialize_app(credentials.Certificate(credential_path))
        else:
            initialize_app()


def install_auth_middleware(app):
    @app.middleware("http")
    async def authenticate_api_requests(request: Request, call_next):
        path = request.url.path

        public_paths = {
            "/",
            "/health",
            "/docs",
            "/openapi.json",
            "/redoc",
        }

        if request.method == "OPTIONS" or path in public_paths:
            return await call_next(request)

        if not path.startswith("/api/"):
            return await call_next(request)

        authorization = request.headers.get("Authorization", "")

        if not authorization.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Sign in required."},
            )

        token = authorization.removeprefix("Bearer ").strip()

        try:
            decoded = auth.verify_id_token(token, check_revoked=True)
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired login. Please sign in again."},
            )

        role = decoded.get("role")

        if role not in {"owner", "staff"}:
            return JSONResponse(
                status_code=403,
                content={"detail": "No authorized CampusLedger role."},
            )

        request.state.user = {
            "uid": decoded["uid"],
            "email": decoded.get("email", ""),
            "role": role,
        }

        if request.method == "DELETE" and role != "owner":
            return JSONResponse(
                status_code=403,
                content={"detail": "Only the Owner can delete records."},
            )

        return await call_next(request)
