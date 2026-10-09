import http.server,urllib.parse,sys
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/report?'):
            open(sys.argv[1]+'/report.txt','a').write(urllib.parse.unquote(self.path[8:])+'\n'); self.send_response(204); self.end_headers(); return
        super().do_GET()
    def log_message(self,*a): pass
http.server.ThreadingHTTPServer(('127.0.0.1',8768),lambda *a,**k:H(*a,directory=sys.argv[1],**k)).serve_forever()
