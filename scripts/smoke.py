"""Non-destructive HTTP smoke check. Does not create orders or decrement stock."""
import urllib.request,json,os
base=os.getenv('BASE_URL','http://localhost:3000')
for path in ['/health','/ready','/api/products','/api/stores']:
    with urllib.request.urlopen(base+path,timeout=10) as response:
        assert response.status==200
        json.load(response)
print('PASS: liveness, readiness, catalog and stores respond')
