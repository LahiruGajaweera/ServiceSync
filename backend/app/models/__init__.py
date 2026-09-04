from app.models.user import User
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.job import Job, JobStatusHistory
from app.models.inventory import InventoryBatch, InventoryItem
from app.models.donor import DonorDevice, DonorPart
from app.models.invoice import Invoice, JobPartUsed
from app.models.notification import Notification, SalvageAssessment
from app.models.otp import AdminSetupOtp, PasswordResetOtp
from app.models.brand import Brand
from app.models.phone_model import PhoneModel
from app.models.part_spec import PartSpec
from app.models.setting import SystemSetting
from app.models.direct_sale import DirectSale, DirectSaleItem
__all__ = [
    "User",
    "Customer",
    "Supplier",
    "Job",
    "JobStatusHistory",
    "InventoryItem",
    "InventoryBatch",
    "DonorDevice",
    "DonorPart",
    "Invoice",
    "JobPartUsed",
    "Notification",
    "SalvageAssessment",
    "AdminSetupOtp",
    "PasswordResetOtp",
    "Brand",
    "PhoneModel",
    "PartSpec",
    "SystemSetting",
    "DirectSale",
    "DirectSaleItem",
]
