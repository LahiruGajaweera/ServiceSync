import urllib.request
import json

base_url = "http://localhost:8000"

# 1. Login to get token
login_data = json.dumps({
    "username": "admin@servicesync.com",
    "password": "password"
}).encode("utf-8")

req = urllib.request.Request(f"{base_url}/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        token = json.loads(resp.read())["access_token"]
except Exception as e:
    login_data = json.dumps({
        "username": "admin@servicesync.com",
        "password": "admin123"
    }).encode("utf-8")
    req = urllib.request.Request(f"{base_url}/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        token = json.loads(resp.read())["access_token"]

# 2. Test search
req = urllib.request.Request(f"{base_url}/inventory/?search=test")
req.add_header("Authorization", f"Bearer {token}")
try:
    with urllib.request.urlopen(req) as resp:
        print(f"Status: {resp.status}")
        data = json.loads(resp.read())
        print(json.dumps(data, indent=2)[:500])
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())
