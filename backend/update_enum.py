import asyncio
from sqlalchemy import text
from app.core.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        db.execute(text("ALTER TYPE assessment_status ADD VALUE IF NOT EXISTS 'assessed';"))
        db.commit()
        print('Altered enum')
    except Exception as e:
        print('Enum might already exist', e)
    finally:
        db.close()

if __name__ == "__main__":
    main()
