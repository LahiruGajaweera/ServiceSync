import os
import sys
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.core.config import settings

def run():
    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_engine(str(settings.DATABASE_URL))
    
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE TYPE job_type AS ENUM ('new', 'rework', 'warranty');"))
            conn.commit()
        except Exception:
            conn.rollback() # Type might already exist
            
        try:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type job_type NOT NULL DEFAULT 'new';"))
            conn.commit()
            print("Added job_type")
        except Exception as e:
            conn.rollback()
            print(f"Error adding job_type: {e}")

        try:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rework_reason TEXT;"))
            conn.commit()
            print("Added rework_reason")
        except Exception as e:
            conn.rollback()
            print(f"Error adding rework_reason: {e}")
                
    print("Job Type Migration Complete")

if __name__ == '__main__':
    run()
