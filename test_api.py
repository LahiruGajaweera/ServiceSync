import urllib.request
import json

data = {
    "name": "nimeshlahiru",
    "email": "",
    "phone_number": "0729661087",
    "specializations": "logic board"
}

req = urllib.request.Request(
    'http://localhost:8000/api/v1/admin/technicians',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print("Success:", response.read())
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode('utf-8'))
