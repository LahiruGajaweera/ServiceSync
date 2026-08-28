from pydantic import BaseModel, EmailStr
import json

class TechnicianCreate(BaseModel):
    name: str
    email: EmailStr | None = None
    phone_number: str
    specializations: str | None = None

try:
    TechnicianCreate.model_validate(json.loads('{"name":"test","email":null,"phone_number":"12345","specializations":""}'))
    print("OK null")
except Exception as e:
    print("Error null:", e)

try:
    TechnicianCreate.model_validate(json.loads('{"name":"test","email":"","phone_number":"12345","specializations":""}'))
    print("OK empty")
except Exception as e:
    print("Error empty:", e)
