from datetime import datetime, timezone
from uuid import uuid4
import re

from fastapi import APIRouter, Body, HTTPException, Response, status
from ..firebase_db import get_firestore
from ..student_schemas import StudentCreate, StudentRead, StudentUpdate

router = APIRouter(prefix="/api/students", tags=["Students"])


def student_collection():
    return get_firestore().collection("students")


def check_department(department_id: str):
    department = get_firestore().collection("departments").document(department_id).get()
    if not department.exists:
        raise HTTPException(status_code=400, detail="The selected department does not exist.")
    if not (department.to_dict() or {}).get("is_active", True):
        raise HTTPException(status_code=400, detail="The selected department is inactive.")


def check_duplicate_admission_number(admission_number: str, department_id: str, course: str, batch: str, exclude_id: str | None = None):
    docs = (
        student_collection()
        .where("admission_number", "==", admission_number.strip())
        .where("department_id", "==", department_id)
        .where("course", "==", course.strip())
        .where("batch", "==", batch.strip())
        .stream()
    )
    for doc in docs:
        if doc.id != exclude_id:
            raise HTTPException(status_code=409, detail="This admission number already exists in the selected department, course, and batch.")


def serialize_student(document):
    data = document.to_dict() or {}
    data["id"] = document.id
    return data


def validate_batch(value: str) -> str:
    match = re.fullmatch(r"\s*(20\d{2})\s*[-–—/]\s*(20\d{2})\s*", str(value or ""))
    if not match:
        raise HTTPException(status_code=422, detail="Batch must be a valid range, for example 2027-2031.")
    start, end = int(match.group(1)), int(match.group(2))
    if end <= start or end - start > 8:
        raise HTTPException(status_code=422, detail="Batch end year must be after the start year and no more than 8 years later.")
    return f"{start}-{end}"


@router.get("", response_model=list[StudentRead])
def list_students():
    students = [serialize_student(doc) for doc in student_collection().stream()]
    return sorted(students, key=lambda item: str(item.get("full_name") or "").lower())


@router.post("", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentCreate):
    check_department(payload.department_id)
    data = payload.model_dump(mode="json")
    data["admission_number"] = data["admission_number"].strip()
    data["batch"] = validate_batch(data["batch"])
    check_duplicate_admission_number(data["admission_number"], data["department_id"], data["course"], data["batch"])
    now = datetime.now(timezone.utc).isoformat()
    data.update({"created_at": now, "updated_at": now})
    student_id = str(uuid4())
    student_collection().document(student_id).set(data)
    return {"id": student_id, **data}


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def bulk_create_students(payload: dict = Body(...)):
    # Main UI sends admission_prefix/start_number/end_number.
    prefix = str(payload.get("admission_prefix", "")).strip()
    if prefix:
        try:
            start, end = int(payload.get("start_number")), int(payload.get("end_number"))
            padding = int(payload.get("number_padding", 3))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Start, end and padding must be valid numbers.")
        department_id = str(payload.get("department_id", "")).strip()
        course = str(payload.get("course", "")).strip()
        batch = validate_batch(payload.get("batch", ""))
        if not department_id or not course:
            raise HTTPException(status_code=400, detail="Department and course are required.")
        if start < 1 or end < start or end - start + 1 > 500:
            raise HTTPException(status_code=400, detail="Enter a valid range of up to 500 students.")
        if padding < 1 or padding > 10:
            raise HTTPException(status_code=400, detail="Number padding must be between 1 and 10.")
        check_department(department_id)
        generated = [f"{prefix}{n:0{padding}d}" for n in range(start, end + 1)]
        existing = {(doc.to_dict() or {}).get("admission_number") for doc in student_collection().stream()}
        duplicates = [number for number in generated if number in existing]
        if duplicates:
            raise HTTPException(status_code=409, detail=f"Admission numbers already exist: {', '.join(duplicates[:10])}")
        now = datetime.now(timezone.utc).isoformat()
        created = []
        collection = student_collection()
        for number in generated:
            student_id = str(uuid4())
            data = {
                "admission_number": number, "full_name": "", "email": None, "phone": None,
                "department_id": department_id, "course": course, "batch": batch,
                "admission_date": payload.get("admission_date"), "expected_graduation_date": None,
                "status": "active", "profile_complete": False, "created_at": now, "updated_at": now,
            }
            collection.document(student_id).set(data)
            created.append({"id": student_id, **data})
        return {"message": f"Created {len(created)} student records.", "count": len(created), "students": created}

    # Compatibility with a payload shaped as {"students": [...]}.
    items = payload.get("students", [])
    if not items:
        raise HTTPException(status_code=400, detail="Provide admission-prefix/range details or a non-empty students list.")
    created = []
    for item in items:
        student = StudentCreate.model_validate(item)
        check_department(student.department_id)
        data = student.model_dump(mode="json")
        data["admission_number"] = data["admission_number"].strip()
        data["batch"] = validate_batch(data["batch"])
        check_duplicate_admission_number(data["admission_number"], data["department_id"], data["course"], data["batch"])
        now = datetime.now(timezone.utc).isoformat()
        data.update({"created_at": now, "updated_at": now})
        student_id = str(uuid4())
        student_collection().document(student_id).set(data)
        created.append({"id": student_id, **data})
    return created


@router.patch("/{student_id}/batch")
def update_student_batch(student_id: str, payload: dict = Body(...)):
    ref = student_collection().document(student_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Student not found.")
    current = snapshot.to_dict() or {}
    if current.get("status") == "discontinued":
        raise HTTPException(status_code=409, detail="Discontinued student records cannot be edited.")
    batch = validate_batch(payload.get("batch", current.get("batch", "")))
    department_id = str(payload.get("department_id", current.get("department_id", ""))).strip()
    course = str(payload.get("course", current.get("course", ""))).strip()
    if not department_id or not course:
        raise HTTPException(status_code=422, detail="Department and course are required.")
    if department_id != current.get("department_id"):
        check_department(department_id)
    check_duplicate_admission_number(str(current.get("admission_number", "")), department_id, course, batch, exclude_id=student_id)
    ref.update({"batch": batch, "department_id": department_id, "course": course, "updated_at": datetime.now(timezone.utc).isoformat()})
    return {"id": student_id, **(ref.get().to_dict() or {})}


@router.post("/{student_id}/graduate")
def graduate_student(student_id: str):
    ref = student_collection().document(student_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Student not found.")
    if (snapshot.to_dict() or {}).get("status") == "discontinued":
        raise HTTPException(status_code=409, detail="A discontinued student cannot be graduated.")
    ref.update({"status": "graduated", "updated_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "Student graduated successfully."}


@router.post("/bulk-graduate")
def bulk_graduate_students(payload: dict = Body(...)):
    ids = payload.get("student_ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No students selected.")
    count = 0
    collection = student_collection()
    for student_id in ids:
        ref = collection.document(str(student_id))
        snapshot = ref.get()
        if not snapshot.exists or (snapshot.to_dict() or {}).get("status") == "discontinued":
            continue
        ref.update({"status": "graduated", "updated_at": datetime.now(timezone.utc).isoformat()})
        count += 1
    return {"graduated_count": count}


@router.put("/{student_id}", response_model=StudentRead)
def update_student(student_id: str, payload: StudentUpdate):
    ref = student_collection().document(student_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Student not found.")
    old = snapshot.to_dict() or {}
    if old.get("status") == "discontinued":
        raise HTTPException(status_code=409, detail="Discontinued student records cannot be edited.")
    check_department(payload.department_id)
    data = payload.model_dump(mode="json")
    data["admission_number"] = data["admission_number"].strip()
    data["batch"] = validate_batch(data["batch"])
    check_duplicate_admission_number(data["admission_number"], data["department_id"], data["course"], data["batch"], exclude_id=student_id)
    data["created_at"] = old.get("created_at", datetime.now(timezone.utc).isoformat())
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    ref.set(data)
    return {"id": student_id, **data}


@router.delete("/{student_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_student(student_id: str):
    ref = student_collection().document(student_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Student not found.")
    ref.delete()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def discontinue_student(student_id: str):
    ref = student_collection().document(student_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Student not found.")
    ref.update({"status": "discontinued", "updated_at": datetime.now(timezone.utc).isoformat()})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
