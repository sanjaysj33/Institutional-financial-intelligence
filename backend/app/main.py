from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.students import router as students_router
from app.routers import staff, finance
from app.security import initialize_firebase_admin, install_auth_middleware
from app.routers.auth import router as auth_router
from app.security import (
    initialize_firebase_admin,
    install_auth_middleware,
)
from app.routers.auth import router as auth_router

from .routers.departments import router as departments_router

app = FastAPI(
    title="College Financial Intelligence API",
    description="Backend API for CampusLedger, a college financial management system using Firebase Firestore.",
    version="0.2.0",
    
)
initialize_firebase_admin()
install_auth_middleware(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(departments_router)
app.include_router(students_router)
app.include_router(staff.router)
app.include_router(finance.router)
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "message": "CampusLedger API is running",
        "database": "Firebase Firestore",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
