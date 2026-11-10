from uuid import uuid4

from fastapi import APIRouter, HTTPException, Response, status

from ..firebase_db import get_firestore
from ..schemas import DepartmentCreate, DepartmentRead, DepartmentUpdate

router = APIRouter(
    prefix="/api/departments",
    tags=["Departments"],
)


def get_department_collection():
    return get_firestore().collection("departments")


def check_duplicate(name: str, code: str, exclude_id: str | None = None):
    collection = get_department_collection()

    for document in collection.stream():
        if document.id == exclude_id:
            continue

        data = document.to_dict()

        if data.get("name", "").lower() == name.lower():
            raise HTTPException(
                status_code=409,
                detail="A department with this name already exists.",
            )

        if data.get("code", "").lower() == code.lower():
            raise HTTPException(
                status_code=409,
                detail="A department with this code already exists.",
            )


@router.get("", response_model=list[DepartmentRead])
def list_departments():
    documents = get_department_collection().stream()

    departments = []

    for document in documents:
        department = document.to_dict()
        department["id"] = document.id
        departments.append(department)

    return sorted(
        departments,
        key=lambda department: department["name"].lower(),
    )


@router.post(
    "",
    response_model=DepartmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_department(payload: DepartmentCreate):
    check_duplicate(payload.name, payload.code)

    department_id = str(uuid4())
    department = payload.model_dump()

    get_department_collection().document(department_id).set(department)

    return {
        **department,
        "id": department_id,
    }


@router.put("/{department_id}", response_model=DepartmentRead)
def update_department(
    department_id: str,
    payload: DepartmentUpdate,
):
    collection = get_department_collection()
    document_ref = collection.document(department_id)
    document = document_ref.get()

    if not document.exists:
        raise HTTPException(
            status_code=404,
            detail="Department not found.",
        )

    check_duplicate(
        payload.name,
        payload.code,
        exclude_id=department_id,
    )

    department = payload.model_dump()
    document_ref.update(department)

    return {
        **department,
        "id": department_id,
    }


@router.delete(
    "/{department_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_department(department_id: str):
    document_ref = get_department_collection().document(department_id)

    if not document_ref.get().exists:
        raise HTTPException(
            status_code=404,
            detail="Department not found.",
        )

    document_ref.delete()

    return Response(status_code=status.HTTP_204_NO_CONTENT)