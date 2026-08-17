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

async def _scrape_patpat(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    query = f"{brand} {model}".strip().replace(" ", "+")
    search_url = f"https://www.patpat.lk/search?q={query}"
    
    try:
        resp = await client.get(search_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".result-item")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one(".result-title")
            price_el = item.select_one(".result-price")
            link_el = item.select_one("a")

            if not title_el or not price_el or not link_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": link_el.get("href", ""),
                "source": "patpat.lk"
            })
        return listings
    except Exception:
        return []

async def _scrape_lifemobile(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    query = f"{brand} {model}".strip().replace(" ", "+")
    search_url = f"https://lifemobile.lk/?s={query}&post_type=product"
    
    try:
        resp = await client.get(search_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".product")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one(".product-title")
            price_el = item.select_one(".price")
            link_el = item.select_one("a.product-image-link") or item.select_one("a")

            if not title_el or not price_el or not link_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": link_el.get("href", ""),
                "source": "lifemobile.lk"
            })
        return listings
    except Exception:
        return []

async def _scrape_geniusmobile(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    query = f"{brand} {model}".strip().replace(" ", "+")
    search_url = f"https://geniusmobile.lk/?s={query}&post_type=product"
    
    try:
        resp = await client.get(search_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".product")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one(".woocommerce-loop-product__title") or item.select_one(".product-title")
            price_el = item.select_one(".price")
            link_el = item.select_one("a")

            if not title_el or not price_el or not link_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": link_el.get("href", ""),
                "source": "geniusmobile.lk"
            })
        return listings
    except Exception:
        return []

async def _scrape_idealz(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    query = f"{brand} {model}".strip().replace(" ", "+")
    search_url = f"https://idealz.lk/?s={query}&post_type=product"
    
    try:
        resp = await client.get(search_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".product")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one(".product-title") or item.select_one(".woocommerce-loop-product__title")
            price_el = item.select_one(".price")
            link_el = item.select_one("a")

            if not title_el or not price_el or not link_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": link_el.get("href", ""),
                "source": "idealz.lk"
            })
        return listings
    except Exception:
        return []

async def _scrape_greenware(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    query = f"{brand} {model}".strip().replace(" ", "+")
    search_url = f"https://greenware.lk/?s={query}&post_type=product"
    
    try:
        resp = await client.get(search_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".product")
            
        listings = []
        for item in items[:max_results]:
            title_el = item.select_one(".product-title") or item.select_one(".woocommerce-loop-product__title")
            price_el = item.select_one(".price")
            link_el = item.select_one("a")

            if not title_el or not price_el or not link_el:
                continue

            price = _parse_price(price_el.get_text(strip=True))
            if price is None or price <= 0:
                continue

            listings.append({
                "title": title_el.get_text(strip=True),
                "price": price,
                "url": link_el.get("href", ""),
                "source": "greenware.lk"
            })
        return listings
    except Exception:
        return []

async def _scrape_daraz(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    # Daraz usually requires JS rendering or specific API, but we attempt basic scraping
    query = f"{brand} {model}".strip().replace(" ", "+")
    search_url = f"https://www.daraz.lk/catalog/?q={query}"
    
    try:
        resp = await client.get(search_url)
        resp.raise_for_status()
        # Daraz data is usually inside a script tag window.pageData, parsing might fail with BS4.
        # Fallback to catching exceptions and returning []
        return []
    except Exception:
        return []

async def _scrape_fb_marketplace(client: httpx.AsyncClient, brand: str, model: str, max_results: int = 8) -> list[dict]:
    # FB Marketplace requires auth and JS rendering for accurate results.
    # Basic attempt (likely to return empty due to protections)
    return []

async def _ai_filter_listings(listings: list[dict], query: str) -> list[dict]:
    if not listings:
        return []
    
    import os
    import json
    import google.generativeai as genai
    
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        return listings
        
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        genai_model = genai.GenerativeModel("gemini-3.5-flash")
        
        titles_with_ids = {i: l["title"] for i, l in enumerate(listings)}
        
        prompt = (
            f"I have a list of scraped product titles from a search for '{query}'.\n"
            "Many of these might be unrelated accessories like cables, buds, cases, covers, protectors, or parts.\n"
            "Return a JSON array containing ONLY the integer IDs of the listings that are actually selling the complete mobile phone/device itself.\n"
            f"Here are the listings: {json.dumps(titles_with_ids)}"
        )
        
        response = await genai_model.generate_content_async(prompt, generation_config={"response_mime_type": "application/json"})
        valid_ids = json.loads(response.text)
        
        if not isinstance(valid_ids, list):
            return listings
            
        filtered = [listings[i] for i in valid_ids if 0 <= i < len(listings)]
        return filtered
    except Exception as e:
        print(f"AI Listing Filter failed: {e}")
        return listings


def _filter_listings(listings: list[dict], query: str) -> list[dict]:
    if not listings:
        return []

    # Rule 1: Negative Keywords
    negative_keywords = {"parts", "display", "battery", "cover", "casing", "screen", "motherboard", "charger", "lcd", "touch", "housing", "back glass"}
    filtered_1 = []
    for l in listings:
        title_lower = l["title"].lower()
        if not any(kw in title_lower for kw in negative_keywords):
            filtered_1.append(l)
    
    if not filtered_1:
        filtered_1 = listings
        
    # Rule 2: Title Matching (Extra words)
    query_lower = query.lower()
    extra_modifiers = {"pro", "max", "plus", "ultra"}
    allowed_modifiers = {mod for mod in extra_modifiers if mod in query_lower.split()}
    forbidden_modifiers = extra_modifiers - allowed_modifiers

    filtered_2 = []
    for l in filtered_1:
        title_words = set(re.findall(r'[a-z]+', l["title"].lower()))
        if not any(mod in title_words for mod in forbidden_modifiers):
            filtered_2.append(l)

    if not filtered_2:
        filtered_2 = filtered_1

    # Rule 3: Outlier Rejection (IQR)
    if len(filtered_2) < 4:
        return filtered_2
        
    prices = sorted(l["price"] for l in filtered_2)
    q1_idx = len(prices) // 4
    q3_idx = (len(prices) * 3) // 4
    q1 = prices[q1_idx]
    q3 = prices[q3_idx]
    iqr = q3 - q1
    
    # If IQR is 0 (many duplicate prices), we might just keep them.
    # We add a small buffer to avoid filtering identical prices when IQR=0
    lower_bound = q1 - (1.5 * iqr) if iqr > 0 else q1 * 0.5
    upper_bound = q3 + (1.5 * iqr) if iqr > 0 else q3 * 1.5
    
    filtered_3 = [l for l in filtered_2 if lower_bound <= l["price"] <= upper_bound]
    
    if not filtered_3:
        filtered_3 = filtered_2
        
    return filtered_3


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
            _scrape_patpat(client, brand, model),
            _scrape_lifemobile(client, brand, model),
            _scrape_geniusmobile(client, brand, model),
            _scrape_idealz(client, brand, model),
            _scrape_greenware(client, brand, model),
            _scrape_daraz(client, brand, model),
            _scrape_fb_marketplace(client, brand, model),
            return_exceptions=True
        )

    listings = []
    for res in results:
        if isinstance(res, list):
            listings.extend(res)

    # Apply AI-based Filtering first
    listings = await _ai_filter_listings(listings, query)

    # Apply Rules-based Filtering (Negative keywords & IQR)
    listings = _filter_listings(listings, query)

    # Sort listings by price
    listings.sort(key=lambda x: x["price"])

    prices = [l["price"] for l in listings]
    
    if not prices:
        import os
        import google.generativeai as genai
        
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                genai_model = genai.GenerativeModel("gemini-3.5-flash")
                prompt = (
                    f"You are a mobile phone market expert in Sri Lanka. "
                    f"Estimate the current average secondhand market price of a {brand} {model} in Sri Lankan Rupees (LKR). "
                    f"Return ONLY a numeric value without commas or currency symbols (e.g., 145000)."
                )
                response = await genai_model.generate_content_async(prompt)
                
                # Strip out any formatting Gemini might have returned
                import re
                digits = re.sub(r"[^\d.]", "", response.text)
                estimated_price = float(digits) if digits else 0
                
                if estimated_price > 0:
                    listings.append({
                        "title": f"Gemini AI Estimated Price for {brand} {model}",
                        "price": estimated_price,
                        "url": "#",
                        "source": "Gemini AI"
                    })
                    prices = [estimated_price]
            except Exception as e:
                print(f"Gemini fallback failed: {e}")
                
    return {
        "query": query,
        "listings": listings,
        "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None,
        "avg_price": round(sum(prices) / len(prices), 2) if prices else None,
        "error": None,
    }
