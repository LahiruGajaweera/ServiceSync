"""
Market price scraper supporting multiple Sri Lankan sites.

Searches for a device by brand + model and extracts listed prices from
the search results page concurrently. Returns a combined price range
and sample listings so the admin can decide on a fair market value for salvage assessment.
"""

import asyncio
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _parse_price(raw: str) -> Optional[float]:
    """Extract a numeric price from strings like 'Rs 145,000' or '145000'."""
    digits = re.sub(r"[^\d.]", "", raw)
    try:
        return float(digits) if digits else None
    except ValueError:
        return None


async def _scrape_ikman(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    base_url = "https://ikman.lk"
    search_url = f"{base_url}/en/ads/sri-lanka/phones-and-accessories"
    query = f"{brand} {model}".strip()
    params = {"query": query, "sort_by": "price_asc"}
    
    try:
        resp = await client.get(search_url, params=params)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        
        items = soup.select("li.list-item--")
        if not items:
            items = soup.select("[class*='item--']")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one("[class*='title']") or item.select_one("h2") or item.select_one("h3")
            price_el = item.select_one("[class*='price']") or item.select_one("strong")
            link_el = item.select_one("a[href]")

            if not title_el or not price_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            href = link_el["href"] if link_el else ""
            url = href if href.startswith("http") else f"{base_url}{href}"

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": url,
                "source": "ikman.lk"
            })
        return listings
    except Exception:
        return []


async def _scrape_dialcom(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    query = f"{brand} {model}".strip()
    params = {"s": query, "post_type": "product"}
    search_url = "https://dialcom.lk/"
    
    try:
        resp = await client.get(search_url, params=params)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".product")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one(".wd-entities-title") or item.select_one(".product-title")
            price_el = item.select_one(".price")
            link_el = item.select_one("a.product-image-link")

            if not title_el or not price_el or not link_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": link_el["href"],
                "source": "dialcom.lk"
            })
        return listings
    except Exception:
        return []


async def _scrape_cellmart(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    query = f"{brand} {model}".strip().replace(" ", "+")
    search_url = f"https://cellmart.lk/search?q={query}"
    
    try:
        resp = await client.get(search_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".product-item, .grid-view-item, .product-card")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one(".product-title, .grid-view-item__title")
            price_el = item.select_one(".price-item, .product-price")
            link_el = item.select_one("a")

            if not title_el or not price_el or not link_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            href = link_el["href"]
            url = href if href.startswith("http") else f"https://cellmart.lk{href}"

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": url,
                "source": "cellmart.lk"
            })
        return listings
    except Exception:
        return []


async def scrape_market_price(brand: str, model: str) -> dict:
    """
    Search multiple sites for the given device and return:
      - listings: list of {title, price, url, source}
      - min_price, max_price, avg_price (LKR, floats)
    """
    query = f"{brand} {model}".strip()
    
    async with httpx.AsyncClient(headers=_HEADERS, timeout=15, follow_redirects=True) as client:
        results = await asyncio.gather(
            _scrape_ikman(client, brand, model),
            _scrape_dialcom(client, brand, model),
            _scrape_cellmart(client, brand, model),
            return_exceptions=True
        )

    listings = []
    for res in results:
        if isinstance(res, list):
            listings.extend(res)

    # Sort listings by price
    listings.sort(key=lambda x: x["price"])

    prices = [l["price"] for l in listings]
    return {
        "query": query,
        "listings": listings,
        "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None,
        "avg_price": round(sum(prices) / len(prices), 2) if prices else None,
        "error": None,
    }
