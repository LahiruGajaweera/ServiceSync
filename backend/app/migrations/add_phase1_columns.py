"""
Migration: Add Phase 1 columns to salvage_assessments table.
Run this script once to add the new columns.

Usage:
    cd backend
    python -m app.migrations.add_phase1_columns
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy import text
from app.core.database import engine


def migrate():
    with engine.connect() as conn:
        # Check if columns already exist before adding
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'salvage_assessments'"
        ))
        existing_columns = {row[0] for row in result}

        if 'parts_breakdown' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE salvage_assessments ADD COLUMN parts_breakdown JSONB DEFAULT '[]'"
            ))
            print("✅ Added 'parts_breakdown' column")
        else:
            print("⏭️  'parts_breakdown' column already exists")

        if 'notes' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE salvage_assessments ADD COLUMN notes TEXT"
            ))
            print("✅ Added 'notes' column")
        else:
            print("⏭️  'notes' column already exists")

        if 'ai_confidence' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE salvage_assessments ADD COLUMN ai_confidence FLOAT"
            ))
            print("✅ Added 'ai_confidence' column")
        else:
            print("⏭️  'ai_confidence' column already exists")

        conn.commit()
        print("\n🎉 Migration complete!")


if __name__ == "__main__":
    migrate()
