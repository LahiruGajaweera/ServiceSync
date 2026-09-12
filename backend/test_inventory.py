from app.core.database import SessionLocal
from app.services.inventory_service import create_item
from app.schemas.inventory import InventoryItemCreate

db = SessionLocal()
data = InventoryItemCreate(
    name='Test Part 2',
    category='Test',
    part_type='factory_new',
    quantity=5,
    unit_cost=10.0,
    unit_price=20.0
)
res = create_item(data, db)
print('Created part quantity:', res['quantity'])
print('Batches:', len(res['batches']))
