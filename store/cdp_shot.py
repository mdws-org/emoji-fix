# /// script
# dependencies = ["websocket-client"]
# ///
import json, sys, time, base64, urllib.request, websocket
port, url, out, w, h = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
req = urllib.request.Request(f"http://127.0.0.1:{port}/json/new?{url}", method="PUT")
tab = json.load(urllib.request.urlopen(req))
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30, suppress_origin=True)
n = 0
def call(method, **params):
    global n; n += 1; ws.send(json.dumps({"id": n, "method": method, "params": params}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == n: return m.get("result", {})
call("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=1, mobile=False)
call("Page.reload"); time.sleep(5)
r = call("Page.captureScreenshot", format="png")
open(out, "wb").write(base64.b64decode(r["data"])); print("wrote", out)
