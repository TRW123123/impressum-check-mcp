import {describe,it,expect} from 'vitest';
import {parsePublicUrl,isPrivateIp,safeFetchHtml,dohResolver,FetchBlocked,LIMITS,USER_AGENT} from '../src/safeFetch';
import {mockDeps} from './helpers';
describe('SSRF: statische URL-Prüfung',()=>{
 it.each(['file:///etc/passwd','ftp://example.de/','javascript:alert(1)','data:text/html,hi','gopher://example.de','http://user:pw@example.de/','https://user@example.de/','http://localhost/','http://LOCALHOST./','http://127.0.0.1/','http://127.1/','http://2130706433/','http://0x7f.0.0.1/','http://0177.0.0.1/','http://[::1]/','http://[::ffff:127.0.0.1]/','http://[fe80::1]/','http://[fd00::1]/','http://169.254.169.254/latest/meta-data/','http://10.0.0.1/','http://172.16.5.4/','http://192.168.178.1/','http://100.64.0.1/','http://0.0.0.0/','http://metadata.google.internal/','http://intranet/','http://drucker.local/','http://example.de:8080/','https://example.de:22/','http://router.home/'])('lehnt %s ab',u=>expect(()=>parsePublicUrl(u)).toThrow(FetchBlocked));
 it('ergänzt https:// und entfernt den Anker',()=>{expect(parsePublicUrl('www.example.de/#x').href).toBe('https://www.example.de/');expect(parsePublicUrl('http://example.de:80/a').href).toBe('http://example.de/a');});
 it.each([['10.1.2.3',true],['8.8.8.8',false],['::ffff:10.0.0.1',true],['64:ff9b::a00:1',true],['2002:a00:1::',true],['2001:db8::1',true],['fec0::1',true],['ff02::1',true],['2001:0::1',true],['2a00:1450:4001:80b::200e',false],['::',true],['198.18.0.1',true],['224.0.0.1',true],['93.184.215.14',false]] as const)('isPrivateIp(%s) = %s',(ip,priv)=>expect(isPrivateIp(ip)).toBe(priv));
});
describe('SSRF: DNS, Redirects, Limits',()=>{
 const u=(s:string)=>new URL(s);
 it('lehnt Domains ab, die auf private IPs zeigen (auch gemischt)',async()=>{
  for(const ips of [['10.0.0.5'],['93.184.215.14','127.0.0.1'],['fd00::5'],['169.254.169.254']]){const {deps,calls}=mockDeps({'https://evil.example.de/':{html:'x'}},{'evil.example.de':ips});await expect(safeFetchHtml(u('https://evil.example.de/'),deps)).rejects.toThrow(/private/);expect(calls).toHaveLength(0);}
 });
 it('lehnt nicht auflösbare Domains ab',async()=>{const {deps}=mockDeps({},{'nx.example.de':[]});await expect(safeFetchHtml(u('https://nx.example.de/'),deps)).rejects.toThrow(/nicht auflösbar/);});
 it('prüft Redirect-Ziele erneut (IP, privater DNS, file:)',async()=>{
  for(const loc of ['http://169.254.169.254/latest/meta-data/','https://intern.example.de/','file:///etc/passwd','http://[::1]/','https://x:y@example.de/']){
   const {deps,calls}=mockDeps({'https://ok.example.de/':{status:302,headers:{location:loc}}},{'intern.example.de':['192.168.0.10']});
   await expect(safeFetchHtml(u('https://ok.example.de/'),deps)).rejects.toThrow(FetchBlocked);expect(calls).toHaveLength(1);}
 });
 it('folgt höchstens 3 Redirects',async()=>{const r:Record<string,{status:number;headers:Record<string,string>}>={};for(let i=0;i<5;i++)r[`https://a.example.de/${i}`]={status:301,headers:{location:`/${i+1}`}};const {deps,calls}=mockDeps(r);await expect(safeFetchHtml(u('https://a.example.de/0'),deps)).rejects.toThrow(/Weiterleitungen/);expect(calls).toHaveLength(4);});
 it('folgt erlaubten Redirects und setzt User-Agent und redirect=manual',async()=>{const {deps,calls}=mockDeps({'http://a.example.de/':{status:301,headers:{location:'https://www.a.example.de/'}},'https://www.a.example.de/':{html:'<p>Hallo</p>'}});const p=await safeFetchHtml(u('http://a.example.de/'),deps);expect(p.url).toBe('https://www.a.example.de/');expect(p.html).toContain('Hallo');const h=calls[0].init!.headers as Record<string,string>;expect(h['user-agent']).toBe(USER_AGENT);expect(calls[0].init!.redirect).toBe('manual');});
 it('bricht bei zu großem Body ab (Header und Stream)',async()=>{
  const {deps}=mockDeps({'https://big.example.de/':{html:'x',headers:{'content-length':String(LIMITS.maxBytes+1)}}});await expect(safeFetchHtml(u('https://big.example.de/'),deps)).rejects.toThrow(/größer/);
  const chunk=new Uint8Array(500_000);let n=0;const body=new ReadableStream<Uint8Array>({pull(c){if(n++<5)c.enqueue(chunk);else c.close();}});
  const m=mockDeps({'https://big2.example.de/':{body}});await expect(safeFetchHtml(u('https://big2.example.de/'),m.deps)).rejects.toThrow(/größer/);
 });
 it('bricht nach Timeout ab',async()=>{const old=LIMITS.timeoutMs;LIMITS.timeoutMs=50;try{const {deps}=mockDeps({});deps.fetch=((_u:string,init:RequestInit)=>new Promise((_r,rej)=>init.signal!.addEventListener('abort',()=>rej(new Error('abort'))))) as unknown as typeof fetch;await expect(safeFetchHtml(u('https://slow.example.de/'),deps)).rejects.toThrow(/Zeitüberschreitung/);}finally{LIMITS.timeoutMs=old;}});
 it('liefert für Nicht-HTML leeren Text',async()=>{const {deps}=mockDeps({'https://a.example.de/x.pdf':{html:'%PDF',headers:{'content-type':'application/pdf'}}});expect((await safeFetchHtml(u('https://a.example.de/x.pdf'),deps)).html).toBe('');});
 it('DoH-Resolver liest A- und AAAA-Antworten',async()=>{const f=(async(url:string)=>new Response(JSON.stringify({Status:0,Answer:url.includes('type=A&')||url.endsWith('type=A')?[{type:5,data:'cname.'},{type:1,data:'93.184.215.14'}]:[{type:28,data:'2606:2800:21f:cb07:6820:80da:af6b:8b2c'}]}))) as unknown as typeof fetch;expect(await dohResolver(f)('example.de')).toEqual(['93.184.215.14','2606:2800:21f:cb07:6820:80da:af6b:8b2c']);});
 it('DoH-Fehler führt zur Ablehnung',async()=>{const f=(async()=>new Response('x',{status:500})) as unknown as typeof fetch;await expect(dohResolver(f)('example.de')).rejects.toThrow(FetchBlocked);});
});
