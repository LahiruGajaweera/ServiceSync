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
            conn.execute(text("CREATE TYPE timer_mode AS ENUM ('diagnostic', 'repair');"))
            conn.commit()
        except Exception:
            conn.rollback() # Type might already exist
            
        try:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_timer_mode timer_mode;"))
            conn.commit()
            print("Added current_timer_mode")
        except Exception as e:
            conn.rollback()
            print(f"Error adding current_timer_mode: {e}")

        try:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_diagnostic_seconds INTEGER NOT NULL DEFAULT 0;"))
            conn.commit()
            print("Added total_diagnostic_seconds")
        except Exception as e:
            conn.rollback()
            print(f"Error adding total_diagnostic_seconds: {e}")
                
    print("Dual Timer Migration Complete")

if __name__ == '__main__':
    run()
