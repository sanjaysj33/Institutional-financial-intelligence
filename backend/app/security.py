
import os
import json
import firebase_admin

from firebase_admin import (
    credentials,
    initialize_app,
    get_app,
    auth,
    firestore,
)
from firebase_admin.exceptions import FirebaseError

from fastapi import Request
from fastapi.responses import JSONResponse


def initialize_firebase_admin():
    """Initialize Firebase Admin SDK only once."""

    try:
        return get_app()
    except ValueError:
        pass

    firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    if not firebase_json:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON is not configured"
        )

    firebase_info = json.loads(firebase_json)
    credential = credentials.Certificate(firebase_info)

    return initialize_app(credential)


def install_auth_middleware(app):
    """Verify Firebase ID tokens and attach user information."""

    @app.middleware("http")
    async def firebase_auth_middleware(request: Request, call_next):

        path = request.url.path

        # Public endpoints
        public_paths = [
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
        ]

        if path in public_paths or request.method == "OPTIONS":
            return await call_next(request)

        # Read Authorization header
        authorization = request.headers.get("Authorization", "")

        if not authorization.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"}
            )

        token = authorization.split(" ", 1)[1].strip()

        if not token:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authentication token"}
            )

        try:
            # Verify Firebase ID token
            decoded_token = auth.verify_id_token(token)

            uid = decoded_token["uid"]
            role = decoded_token.get("role")

            # Get role from Firestore if not in Firebase claims
            if not role:
                user_doc = (
                    firestore.client()
                    .collection("campusledgerUsers")
                    .document(uid)
                    .get()
                )

                if user_doc.exists:
                    user_data = user_doc.to_dict() or {}
                    role = user_data.get("role")

            # Attach authenticated user to request
            request.state.user = {
                "uid": uid,
                "email": decoded_token.get("email"),
                "role": role,
            }

        except (ValueError, FirebaseError, KeyError):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired authentication token"}
            )

        return await call_next(request)

    return app
