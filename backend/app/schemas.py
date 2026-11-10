from pydantic import BaseModel, ConfigDict, Field


class DepartmentBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(
        min_length=2,
        max_length=20,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(DepartmentBase):
    pass


class DepartmentRead(DepartmentBase):
    id: str

    model_config = ConfigDict(from_attributes=True)