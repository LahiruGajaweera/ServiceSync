import os
import sys
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def upgrade():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Checking if payment_reference column exists...")
        try:
            # Try to select the column to see if it exists
            conn.execute(text("SELECT payment_reference FROM invoices LIMIT 1"))
            print("Column payment_reference already exists.")
        except Exception:
            # Column doesn't exist, we must add it
            print("Adding payment_reference column to invoices table...")
            # We must end the current transaction block and start a new one
            conn.rollback() 
            conn.execute(text("ALTER TABLE invoices ADD COLUMN payment_reference VARCHAR(255)"))
            conn.commit()
            print("Column payment_reference added successfully.")

if __name__ == "__main__":
    upgrade()
