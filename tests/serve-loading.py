"""Local-only loading QA: slow model delivery and optional HTTP failures."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, time
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8791);p.add_argument('--fail',default='');p.add_argument('--slow',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 def do_GET(self):
  if args.fail and self.path.endswith(args.fail):self.send_error(503,'Simulated asset failure');return
  super().do_GET()
 def copyfile(self,source,outputfile):
  if args.slow and self.path.endswith('.glb'):
   try:
    while data:=source.read(65536):outputfile.write(data);time.sleep(.08)
   except (BrokenPipeError,ConnectionResetError):pass
  else:super().copyfile(source,outputfile)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
