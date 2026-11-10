
from datetime import datetime, timezone, date
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..firebase_db import get_firestore

router = APIRouter(prefix="/api/staff", tags=["Staff"])


def collection():
    return get_firestore().collection("staff")


def now():
    return datetime.now(timezone.utc).isoformat()


def today_iso():
    return datetime.now(timezone.utc).date().isoformat()


def validate_date(value, field_name):
    try:
        date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must use YYYY-MM-DD format.",
        )


class StaffCreate(BaseModel):
    staff_id: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=150)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)
    department_id: str = Field(min_length=1)
    joined_date: str
    monthly_salary: float = Field(default=0, ge=0)
    staff_type: str = Field(
        default="teaching",
        pattern="^(teaching|non_teaching)$",
    )


class StaffUpdate(StaffCreate):
    status: str = Field(
        default="active",
        pattern="^(active|relieved)$",
    )
    relieved_date: str | None = None


@router.get("")
def list_staff():
    result = []

    for doc in collection().stream():
        row = doc.to_dict() or {}
        row["id"] = doc.id
        row.setdefault("status", "active")
        row.setdefault("monthly_salary", 0)
        row.setdefault("staff_type", "teaching")
        result.append(row)

    return sorted(
        result,
        key=lambda item: item.get("name", "").lower(),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffCreate):
    staff_code = payload.staff_id.strip()
    validate_date(payload.joined_date, "joined_date")

    duplicates = (
        collection()
        .where("staff_id", "==", staff_code)
        .limit(1)
        .stream()
    )

    if next(duplicates, None):
        raise HTTPException(
            status_code=409,
            detail="Staff ID already exists.",
        )

    data = payload.model_dump()
    timestamp = now()

    data.update({
        "staff_id": staff_code,
        "name": payload.name.strip(),
        "joined_date": str(payload.joined_date)[:10],
        "status": "active",
        "relieved_date": None,
        "created_at": timestamp,
        "updated_at": timestamp,
    })

    ref = collection().document(str(uuid4()))
    ref.set(data)

    return {"id": ref.id, **data}


@router.post("/{staff_id}/relieve")
def relieve_staff(staff_id: str):
    ref = collection().document(staff_id)
    document = ref.get()

    if not document.exists:
        raise HTTPException(
            status_code=404,
            detail="Staff member not found.",
        )

    existing = document.to_dict() or {}

    if existing.get("status") == "relieved":
        return {
            "id": staff_id,
            **existing,
            "message": "Staff member is already relieved.",
        }

    # Preserve the staff record and its historical payroll.
    ref.update({
        "status": "relieved",
        "relieved_date": today_iso(),
        "updated_at": now(),
    })

    updated = ref.get().to_dict() or {}

    return {
        "id": staff_id,
        **updated,
        "message": "Staff member relieved successfully.",
    }


@router.put("/{staff_id}")
def update_staff(staff_id: str, payload: StaffUpdate):
    ref = collection().document(staff_id)
    old = ref.get()

    if not old.exists:
        raise HTTPException(
            status_code=404,
            detail="Staff record not found.",
        )

    old_data = old.to_dict() or {}
    staff_code = payload.staff_id.strip()

    validate_date(payload.joined_date, "joined_date")

    duplicates = (
        collection()
        .where("staff_id", "==", staff_code)
        .limit(2)
        .stream()
    )

    for doc in duplicates:
        if doc.id != staff_id:
            raise HTTPException(
                status_code=409,
                detail="Staff ID already exists.",
            )

    data = payload.model_dump()
    data["staff_id"] = staff_code
    data["name"] = payload.name.strip()
    data["joined_date"] = str(payload.joined_date)[:10]
    data["created_at"] = old_data.get("created_at", now())
    data["updated_at"] = now()

    if data["status"] == "relieved":
        relief_date = (
            payload.relieved_date
            or old_data.get("relieved_date")
            or today_iso()
        )
        validate_date(relief_date, "relieved_date")
        data["relieved_date"] = str(relief_date)[:10]
    else:
        data["relieved_date"] = None

    # Update only the staff profile. Never modify payrollRecords here.
    ref.set(data)

    return {"id": staff_id, **data}
