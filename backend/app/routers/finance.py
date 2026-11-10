
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, Literal

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from ..firebase_db import get_firestore


router = APIRouter(prefix="/api/finance", tags=["Finance"])


def db():
    return get_firestore()


def now():
    return datetime.now(timezone.utc).isoformat()


def rows(name):
    out = []

    for doc in db().collection(name).stream():
        item = doc.to_dict() or {}
        item["id"] = doc.id
        out.append(item)

    return out


def create(name, data):
    timestamp = now()
    data = {
        **data,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    ref = db().collection(name).document(str(uuid4()))
    ref.set(data)

    return {"id": ref.id, **data}


def positive_amount(value):
    if value <= 0:
        raise HTTPException(
            status_code=422,
            detail="Amount must be greater than zero.",
        )

    return round(float(value), 2)


# -------------------------
# REQUEST MODELS
# -------------------------

class FeeAssignment(BaseModel):
    student_id: str = Field(min_length=1)
    academic_year: str = Field(min_length=4, max_length=20)
    fee_category: str = Field(min_length=2, max_length=80)
    assigned_amount: float = Field(gt=0)
    concession_amount: float = Field(ge=0, default=0)
    due_date: str
    installment: str = Field(
        default="Full payment",
        max_length=80,
    )


class Payment(BaseModel):
    student_id: str = Field(min_length=1)
    fee_assignment_id: str = Field(min_length=1)
    amount: float = Field(gt=0)
    paid_date: str
    method: Literal[
        "cash", "upi", "bank_transfer", "card", "cheque", "other"
    ] = "upi"
    receipt_number: str = Field(min_length=1, max_length=60)


class Donation(BaseModel):
    student_id: str = Field(min_length=1)
    amount: float = Field(gt=0)
    received_date: str
    method: Literal[
        "cash", "upi", "bank_transfer", "card", "cheque", "other"
    ] = "upi"
    receipt_number: str = Field(min_length=1, max_length=60)
    purpose: Optional[str] = Field(default=None, max_length=200)


class Payroll(BaseModel):
    staff_id: str = Field(min_length=1)
    pay_period: str = Field(min_length=7, max_length=20)
    basic_salary: float = Field(ge=0)
    allowances: float = Field(ge=0, default=0)
    deductions: float = Field(ge=0, default=0)
    paid_amount: float = Field(ge=0, default=0)
    payment_date: Optional[str] = None
    payment_reference: Optional[str] = None


class Expense(BaseModel):
    category: str = Field(min_length=2, max_length=80)
    amount: float = Field(gt=0)
    paid_date: Optional[str] = None
    spent_date: Optional[str] = None
    payment_method: Literal[
        "cash", "upi", "bank_transfer", "card", "cheque", "other"
    ] = "upi"
    receipt_number: Optional[str] = None


# -------------------------
# FINANCE OVERVIEW
# -------------------------

@router.get("/overview")
def finance_overview():
    assignments = rows("studentFeeAssignments")
    payments = rows("payments")
    donations = rows("donations")
    payroll = rows("payrollRecords")
    expenses = rows("expenses")

    assigned = sum(
        max(
            0,
            float(x.get("assigned_amount", 0))
            - float(x.get("concession_amount", 0)),
        )
        for x in assignments
    )

    collected = sum(float(x.get("amount", 0)) for x in payments)
    donation_total = sum(float(x.get("amount", 0)) for x in donations)

    payroll_expense = sum(
        float(x.get("basic_salary", 0))
        + float(x.get("allowances", 0))
        - float(x.get("deductions", 0))
        for x in payroll
    )

    salary_paid = sum(
        float(x.get("paid_amount", 0)) for x in payroll
    )

    expense_total = sum(
        float(x.get("amount", 0)) for x in expenses
    )

    return {
        "fees_assigned": round(assigned, 2),
        "fees_collected": round(collected, 2),
        "outstanding_fees": round(max(0, assigned - collected), 2),
        "donations_received": round(donation_total, 2),
        "salary_expense": round(payroll_expense, 2),
        "salary_paid": round(salary_paid, 2),
        "salary_pending": round(
            max(0, payroll_expense - salary_paid), 2
        ),
        "other_expenses": round(expense_total, 2),
        "cash_received": round(collected + donation_total, 2),
        "cash_paid": round(salary_paid + expense_total, 2),
    }


# -------------------------
# FEES
# -------------------------

@router.get("/fees")
def list_fees():
    return rows("studentFeeAssignments")


@router.post("/fees", status_code=status.HTTP_201_CREATED)
def assign_fee(payload: FeeAssignment):
    if payload.concession_amount > payload.assigned_amount:
        raise HTTPException(
            status_code=422,
            detail="Concession cannot exceed assigned fee.",
        )

    student = (
        db().collection("students")
        .document(payload.student_id)
        .get()
    )

    if not student.exists:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    return create("studentFeeAssignments", payload.model_dump())


# -------------------------
# PAYMENTS
# -------------------------

@router.get("/payments")
def list_payments():
    return rows("payments")


@router.post("/payments", status_code=status.HTTP_201_CREATED)
def record_payment(payload: Payment):
    fee = (
        db().collection("studentFeeAssignments")
        .document(payload.fee_assignment_id)
        .get()
    )

    if not fee.exists:
        raise HTTPException(
            status_code=404,
            detail="Fee assignment not found.",
        )

    fee_data = fee.to_dict() or {}

    if fee_data.get("student_id") != payload.student_id:
        raise HTTPException(
            status_code=400,
            detail="Payment student does not match fee assignment.",
        )

    existing = sum(
        float(x.get("amount", 0))
        for x in rows("payments")
        if x.get("fee_assignment_id") == payload.fee_assignment_id
    )

    net_due = (
        float(fee_data.get("assigned_amount", 0))
        - float(fee_data.get("concession_amount", 0))
    )

    if existing + payload.amount > net_due + 0.0001:
        raise HTTPException(
            status_code=409,
            detail="Payment exceeds the remaining fee balance.",
        )

    for x in rows("payments"):
        if x.get("receipt_number") == payload.receipt_number:
            raise HTTPException(
                status_code=409,
                detail="Receipt number already exists.",
            )

    return create("payments", payload.model_dump())


# -------------------------
# DONATIONS
# -------------------------

@router.get("/donations")
def list_donations():
    return rows("donations")


@router.post("/donations", status_code=status.HTTP_201_CREATED)
def record_donation(payload: Donation):
    student = (
        db().collection("students")
        .document(payload.student_id)
        .get()
    )

    if not student.exists:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    for x in rows("donations"):
        if x.get("receipt_number") == payload.receipt_number:
            raise HTTPException(
                status_code=409,
                detail="Donation receipt number already exists.",
            )

    return create("donations", payload.model_dump())


# -------------------------
# PAYROLL
# -------------------------

# Partial-update endpoints for existing student financial records.
# These deliberately use dict payloads: editing a saved record must not require
# create-only fields such as student_id, academic_year, fee_category, or due_date.
@router.put("/fees/{fee_id}")
def update_fee_assignment(fee_id: str, payload: dict):
    ref = db().collection("studentFeeAssignments").document(fee_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Fee assignment not found.")
    changes = {key: value for key, value in payload.items() if key in {"assigned_amount", "concession_amount"}}
    if not changes:
        raise HTTPException(status_code=422, detail="No supported fee fields supplied.")
    current = snapshot.to_dict() or {}
    assigned = float(changes.get("assigned_amount", current.get("assigned_amount", 0)) or 0)
    concession = float(changes.get("concession_amount", current.get("concession_amount", 0)) or 0)
    if assigned < 0 or concession < 0:
        raise HTTPException(status_code=422, detail="Fee amounts cannot be negative.")
    if concession > assigned:
        raise HTTPException(status_code=422, detail="Concession cannot exceed assigned fee.")
    paid = sum(float(item.get("amount", 0) or 0) for item in rows("payments") if item.get("fee_assignment_id") == fee_id)
    if paid > assigned - concession + 0.0001:
        raise HTTPException(status_code=409, detail="Net fee cannot be reduced below payments already received.")
    changes["updated_at"] = now()
    ref.update(changes)
    return {"id": fee_id, **(ref.get().to_dict() or {})}


@router.put("/payments/{payment_id}")
def update_payment(payment_id: str, payload: dict):
    ref = db().collection("payments").document(payment_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Payment record not found.")
    current = snapshot.to_dict() or {}
    changes = {key: value for key, value in payload.items() if key in {"amount", "paid_date", "method", "receipt_number"}}
    if not changes:
        raise HTTPException(status_code=422, detail="No supported payment fields supplied.")
    amount = float(changes.get("amount", current.get("amount", 0)) or 0)
    if amount < 0:
        raise HTTPException(status_code=422, detail="Payment amount cannot be negative.")
    fee_id = current.get("fee_assignment_id")
    fee_snapshot = db().collection("studentFeeAssignments").document(str(fee_id)).get()
    if not fee_snapshot.exists:
        raise HTTPException(status_code=404, detail="Related fee assignment not found.")
    fee = fee_snapshot.to_dict() or {}
    other_paid = sum(float(item.get("amount", 0) or 0) for item in rows("payments") if item.get("fee_assignment_id") == fee_id and item.get("id") != payment_id)
    net_due = float(fee.get("assigned_amount", 0) or 0) - float(fee.get("concession_amount", 0) or 0)
    if other_paid + amount > net_due + 0.0001:
        raise HTTPException(status_code=409, detail="Payment would exceed the net fee balance.")
    receipt = changes.get("receipt_number")
    if receipt and any(item.get("receipt_number") == receipt and item.get("id") != payment_id for item in rows("payments")):
        raise HTTPException(status_code=409, detail="Receipt number already exists.")
    changes["updated_at"] = now()
    ref.update(changes)
    return {"id": payment_id, **(ref.get().to_dict() or {})}


@router.put("/donations/{donation_id}")
def update_donation(donation_id: str, payload: dict):
    ref = db().collection("donations").document(donation_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Donation record not found.")
    changes = {key: value for key, value in payload.items() if key in {"amount", "received_date", "method", "purpose", "receipt_number"}}
    if not changes:
        raise HTTPException(status_code=422, detail="No supported donation fields supplied.")
    if "amount" in changes and float(changes["amount"] or 0) < 0:
        raise HTTPException(status_code=422, detail="Donation amount cannot be negative.")
    receipt = changes.get("receipt_number")
    if receipt and any(item.get("receipt_number") == receipt and item.get("id") != donation_id for item in rows("donations")):
        raise HTTPException(status_code=409, detail="Donation receipt number already exists.")
    changes["updated_at"] = now()
    ref.update(changes)
    return {"id": donation_id, **(ref.get().to_dict() or {})}


@router.get("/payroll")
def list_payroll():
    return rows("payrollRecords")


@router.post("/payroll", status_code=status.HTTP_201_CREATED)
def record_payroll(payload: Payroll):
    staff = (
        db().collection("staff")
        .document(payload.staff_id)
        .get()
    )

    if not staff.exists:
        raise HTTPException(
            status_code=404,
            detail="Staff record not found.",
        )

    net = (
        payload.basic_salary
        + payload.allowances
        - payload.deductions
    )

    if payload.paid_amount > net:
        raise HTTPException(
            status_code=422,
            detail="Paid amount cannot exceed net salary.",
        )

    for item in rows("payrollRecords"):
        if (
            item.get("staff_id") == payload.staff_id
            and item.get("pay_period") == payload.pay_period
        ):
            raise HTTPException(
                status_code=409,
                detail="Payroll already exists for this staff member and period.",
            )

    return create("payrollRecords", payload.model_dump())


# -------------------------
# COLLEGE EXPENSES
# -------------------------

@router.get("/expenses")
def list_expenses():
    return rows("expenses")


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
def record_expense(payload: Expense):
    expense_date = payload.paid_date or payload.spent_date

    if not expense_date:
        raise HTTPException(
            status_code=422,
            detail="Expense date is required.",
        )

    data = payload.model_dump(exclude_none=True)
    data["paid_date"] = expense_date
    data["spent_date"] = expense_date

    return create("expenses", data)


@router.put("/expenses/{expense_id}")
def update_expense(expense_id: str, payload: Expense):
    ref = db().collection("expenses").document(expense_id)
    snapshot = ref.get()

    if not snapshot.exists:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    expense_date = payload.paid_date or payload.spent_date

    if not expense_date:
        raise HTTPException(
            status_code=422,
            detail="Expense date is required.",
        )

    data = payload.model_dump(exclude_none=True)
    data["paid_date"] = expense_date
    data["spent_date"] = expense_date
    data["updated_at"] = now()

    ref.update(data)

    updated = ref.get().to_dict() or {}
    return {"id": expense_id, **updated}


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_expense(expense_id: str):
    ref = db().collection("expenses").document(expense_id)

    if not ref.get().exists:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    ref.delete()
    return None
