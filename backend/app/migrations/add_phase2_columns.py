"""
Migration: Add Phase 2 columns to salvage_assessments table.
Run this script once to add the new columns.

Usage:
    docker compose exec backend python -m app.migrations.add_phase2_columns
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

        columns_to_add = {
            "actual_refurbish_cost": "NUMERIC(10, 2)",
            "actual_resale_price": "NUMERIC(10, 2)",
            "actual_parts_revenue": "NUMERIC(10, 2)",
            "profit_loss": "NUMERIC(10, 2)",
            "ai_accuracy_score": "FLOAT"
        }

        for col_name, col_type in columns_to_add.items():
            if col_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE salvage_assessments ADD COLUMN {col_name} {col_type}"))
                print(f"✅ Added '{col_name}' column")
            else:
                print(f"⏭️  '{col_name}' column already exists")

        conn.commit()
        print("\n🎉 Phase 2 Migration complete!")


if __name__ == "__main__":
    migrate()
