import os
import sys
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def upgrade():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Checking if total_away_seconds column exists...")
        try:
            # Try to select the column to see if it exists
            conn.execute(text("SELECT total_away_seconds FROM jobs LIMIT 1"))
            print("Column total_away_seconds already exists.")
        except Exception:
            # Column doesn't exist, we must add it
            print("Adding total_away_seconds column to jobs table...")
            # We must end the current transaction block and start a new one
            conn.rollback() 
            conn.execute(text("ALTER TABLE jobs ADD COLUMN total_away_seconds INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("Column total_away_seconds added successfully.")

if __name__ == "__main__":
    upgrade()
