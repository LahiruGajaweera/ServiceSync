from app.core.database import SessionLocal
from app.services.job_parts_service import delete_job_part
from app.models.invoice import JobPartUsed

db = SessionLocal()
part = db.query(JobPartUsed).first()
if part:
    print(f'Deleting part {part.id} from job {part.job_id}')
    try:
        delete_job_part(part.job_id, part.id, db)
        print('Success')
    except Exception as e:
        import traceback
        traceback.print_exc()
else:
    print("No parts found")
