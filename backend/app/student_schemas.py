from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


StudentStatus = Literal["active", "graduated", "discontinued"]


class StudentCreate(BaseModel):
    admission_number: str = Field(min_length=2, max_length=30)
    full_name: str = Field(min_length=2, max_length=150)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)

    department_id: str = Field(min_length=1)
    course: str = Field(min_length=2, max_length=120)
    batch: str = Field(min_length=4, max_length=30)

    admission_date: date
    expected_graduation_date: date | None = None
    status: StudentStatus = "active"

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.expected_graduation_date is not None
            and self.expected_graduation_date <= self.admission_date
        ):
            raise ValueError(
                "Expected graduation date must be after admission date."
            )
        return self


class StudentUpdate(StudentCreate):
    pass


class BulkStudentCreate(BaseModel):
    admission_prefix: str = Field(min_length=1, max_length=20)
    start_number: int = Field(ge=1)
    end_number: int = Field(ge=1)
    number_padding: int = Field(default=3, ge=1, le=10)

    department_id: str = Field(min_length=1)
    course: str = Field(min_length=2, max_length=120)
    batch: str = Field(min_length=4, max_length=30)
    admission_date: date = Field(default_factory=date.today)

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_number < self.start_number:
            raise ValueError(
                "End number must be greater than or equal to start number."
            )

        if self.end_number - self.start_number + 1 > 500:
            raise ValueError(
                "You can generate a maximum of 500 students per request."
            )

        return self


class StudentRead(BaseModel):
    id: str
    admission_number: str
    full_name: str = ""
    email: str | None = None
    phone: str | None = None

    department_id: str
    course: str = ""
    batch: str = ""

    admission_date: date | None = None
    expected_graduation_date: date | None = None
    status: StudentStatus = "active"
    profile_status: Literal["incomplete", "complete"] = "complete"

    created_at: str | None = None
    updated_at: str | None = None

    model_config = ConfigDict(from_attributes=True)