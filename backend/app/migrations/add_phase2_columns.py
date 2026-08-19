import os
import sys
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.core.config import settings

def run():
    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_engine(str(settings.DATABASE_URL))
    
    queries = [
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_fault VARCHAR(100);",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS identified_fault VARCHAR(100);",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS diagnostic_time_mins INTEGER;",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS repair_time_mins INTEGER;",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resolution_notes TEXT;"
    ]
    
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE TYPE complexity_level AS ENUM ('low', 'medium', 'high');"))
            conn.commit()
        except Exception:
            conn.rollback() # Type might already exist
            
        try:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS complexity_level complexity_level;"))
            conn.commit()
            print("Added complexity_level")
        except Exception as e:
            conn.rollback()
            print(f"Error adding complexity_level: {e}")
            
        for q in queries:
            try:
                conn.execute(text(q))
                conn.commit()
                print(f"Executed: {q}")
            except Exception as e:
                conn.rollback()
                print(f"Error: {e}")
                
    print("Phase 2 Migration Complete")

if __name__ == '__main__':
    run()
