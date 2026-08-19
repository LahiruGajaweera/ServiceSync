"""
Migration: Add Phase 3 columns to jobs table (Performance Tracking)
Run this script once to add the new columns.

Usage:
    python -m app.migrations.add_phase3_columns
"""
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

from sqlalchemy import text
from app.core.database import engine


def migrate():
    with engine.connect() as conn:
        # Check if columns already exist before adding
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'jobs'"
        ))
        existing_columns = {row[0] for row in result}

        columns_to_add = {
            "rework_of_job_id": "UUID",
            "active_repair_start_time": "TIMESTAMP WITH TIME ZONE",
            "total_active_repair_seconds": "INTEGER DEFAULT 0"
        }

        for col_name, col_type in columns_to_add.items():
            if col_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} {col_type}"))
                print(f"✅ Added '{col_name}' column")
            else:
                print(f"⏭️  '{col_name}' column already exists")

        conn.commit()
        print("\n🎉 Phase 3 Migration complete!")


if __name__ == "__main__":
    migrate()
