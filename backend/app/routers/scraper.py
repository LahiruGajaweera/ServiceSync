from fastapi import APIRouter, Depends, Query

from app.core.deps import require_admin
from app.services import scraper_service

router = APIRouter(prefix="/scrape", tags=["Scraper"])


@router.get("/price")
async def scrape_price(
    brand: str = Query(..., description="Device brand, e.g. Apple"),
    model: str = Query(..., description="Device model, e.g. iPhone 14"),
    _=Depends(require_admin),
):
    """
    Scrape market prices for a device from multiple sources (ikman, dialcom, etc).
    Returns a list of listings and computed min/max/avg price in LKR.
    """
    return await scraper_service.scrape_market_price(brand, model)
