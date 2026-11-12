// SSRF-sicherer Abruf öffentlicher Webseiten.
// - nur http/https, nur Ports 80/443, keine Zugangsdaten in der URL
// - Hostnamen werden vor JEDEM Abruf (auch nach Redirects) per DNS-over-HTTPS aufgelöst;
//   private, Loopback-, Link-Local-, CGNAT-, Metadata-, Multicast- und reservierte Adressen werden abgelehnt
// - Redirects manuell, höchstens 3; Timeout und Größenlimit je Abruf
// - nichts wird gespeichert oder geloggt
export const USER_AGENT='ImpressumCheckMCP/0.1 (+https://www.ki-automatisieren.de; Pflichtangaben-Textprüfung, ruft nur wenige Seiten ab)';
export const LIMITS={timeoutMs:8000,maxBytes:1_500_000,maxRedirects:3};
export class FetchBlocked extends Error{}
export type Resolver=(host:string)=>Promise<string[]>;
export type Deps={fetch:typeof fetch;resolve:Resolver};

const blockedHostnames=/^(localhost|localhost\.localdomain|ip6-localhost|ip6-loopback|metadata|metadata\.google\.internal|instance-data)$|\.(localhost|local|internal|intranet|lan|home|corp|arpa|test|invalid|example)$/i;

function v4ToInt(ip:string){const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return null;return ((p[0]<<24)>>>0)+(p[1]<<16)+(p[2]<<8)+p[3];}
const v4Blocks:[string,number][]=[['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]];
export function isPrivateV4(ip:string){const n=v4ToInt(ip);if(n===null)return true;return v4Blocks.some(([base,bits])=>{const b=v4ToInt(base)!;const mask=bits===0?0:(~0<<(32-bits))>>>0;return ((n&mask)>>>0)===((b&mask)>>>0);});}
function expandV6(ip:string):number[]|null{
 let s=ip.toLowerCase().replace(/^\[|\]$/g,'');if(s.includes('%'))return null;
 let tail:number[]=[];const v4=s.match(/(\d+\.\d+\.\d+\.\d+)$/);
 if(v4){const n=v4ToInt(v4[1]);if(n===null)return null;tail=[n>>>16,n&0xffff];s=s.slice(0,-v4[1].length).replace(/:$/,'::').replace(/:::$/,'::');if(s.endsWith('::')&&!s.slice(0,-2).includes('::')){/* ok */}}
 const parts=s.split('::');if(parts.length>2)return null;
 const head=parts[0]?parts[0].split(':').filter(x=>x!==''):[];const rest=parts.length===2&&parts[1]?parts[1].split(':').filter(x=>x!==''):[];
 const fill=8-tail.length-head.length-rest.length;if(fill<0||(parts.length===1&&fill!==0))return null;
 const all=[...head,...Array(parts.length===2?fill:0).fill('0'),...rest].map(h=>/^[0-9a-f]{1,4}$/.test(h)?parseInt(h,16):NaN);
 const out=[...all,...tail];return out.length===8&&out.every(n=>Number.isInteger(n))?out:null;}
export function isPrivateV6(ip:string){
 const w=expandV6(ip);if(!w)return true;
 if(w.every(x=>x===0))return true; // ::
 if(w.slice(0,7).every(x=>x===0)&&w[7]===1)return true; // ::1
 const v4of=(a:number,b:number)=>`${a>>8}.${a&255}.${b>>8}.${b&255}`;
 if(w.slice(0,5).every(x=>x===0)&&w[5]===0xffff)return isPrivateV4(v4of(w[6],w[7])); // ::ffff:a.b.c.d
 if(w.slice(0,6).every(x=>x===0))return true; // veraltete ::a.b.c.d
 if(w[0]===0x64&&w[1]===0xff9b)return isPrivateV4(v4of(w[6],w[7])); // NAT64
 if(w[0]===0x2002)return isPrivateV4(v4of(w[1],w[2])); // 6to4
 if((w[0]&0xfe00)===0xfc00)return true; // fc00::/7
 if((w[0]&0xffc0)===0xfe80)return true; // fe80::/10
 if((w[0]&0xffc0)===0xfec0)return true; // site-local
 if((w[0]&0xff00)===0xff00)return true; // multicast
 if(w[0]===0x2001&&w[1]===0x0db8)return true; // Doku
 if(w[0]===0x2001&&w[1]<0x0200)return true; // 2001::/23 IETF-Protokolle inkl. Teredo
 if(w[0]===0x0100&&w[1]===0&&w[2]===0&&w[3]===0)return true; // discard
 return false;}
export const isIpV4=(h:string)=>/^\d+\.\d+\.\d+\.\d+$/.test(h);
export const isIpV6=(h:string)=>h.includes(':');
export function isPrivateIp(ip:string){return isIpV4(ip)?isPrivateV4(ip):isIpV6(ip)?isPrivateV6(ip):true;}

/** Normalisiert und prüft eine Nutzer-URL statisch (ohne DNS). Wirft FetchBlocked mit verständlicher Meldung. */
export function parsePublicUrl(raw:string):URL{
 let s=raw.trim();if(/[\u0000-\u001f\s]/.test(s))throw new FetchBlocked('URL enthält Leer- oder Steuerzeichen.');
 if(!/^[a-z][a-z0-9+.-]*:/i.test(s))s='https://'+s;
 let u:URL;try{u=new URL(s);}catch{throw new FetchBlocked('Ungültige URL. Beispiel: https://www.example.de');}
 if(u.protocol!=='http:'&&u.protocol!=='https:')throw new FetchBlocked('Nur http- und https-Adressen sind erlaubt.');
 if(u.username||u.password)throw new FetchBlocked('URLs mit Zugangsdaten (Benutzer/Passwort) werden nicht abgerufen.');
 if(u.port&&!((u.protocol==='http:'&&u.port==='80')||(u.protocol==='https:'&&u.port==='443')))throw new FetchBlocked('Nur die Standard-Ports 80 und 443 sind erlaubt.');
 const host=u.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'');
 if(!host)throw new FetchBlocked('URL ohne Hostnamen.');
 if(isIpV4(host)||isIpV6(host)){if(isPrivateIp(host))throw new FetchBlocked('Private, lokale oder reservierte IP-Adressen werden nicht abgerufen.');}
 else{if(!host.includes('.')||blockedHostnames.test(host))throw new FetchBlocked('Dieser Hostname ist nicht öffentlich und wird nicht abgerufen.');
  if(!/^[a-z0-9.-]+$/i.test(host)||host.split('.').some(l=>!l||l.length>63))throw new FetchBlocked('Ungültiger Hostname.');}
 u.hash='';return u;}

/** DNS-over-HTTPS (Cloudflare, kostenlos, kein Schlüssel). Liefert A- und AAAA-Adressen. */
export function dohResolver(f:typeof fetch=fetch):Resolver{
 return async host=>{const ips:string[]=[];
  for(const type of ['A','AAAA']){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),4000);
   try{const r=await f(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,{headers:{accept:'application/dns-json'},signal:ctl.signal});
    if(!r.ok)throw new FetchBlocked('DNS-Auflösung fehlgeschlagen.');
    const j=await r.json() as {Status?:number;Answer?:{type:number;data:string}[]};
    for(const a of j.Answer??[])if((a.type===1&&type==='A')||(a.type===28&&type==='AAAA'))ips.push(a.data);
   }catch(e){if(e instanceof FetchBlocked)throw e;throw new FetchBlocked('DNS-Auflösung fehlgeschlagen oder zu langsam.');}finally{clearTimeout(t);}}
  return ips;};}

export async function assertPublicHost(u:URL,deps:Deps,cache:Map<string,true>){
 const host=u.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
 if(cache.has(host))return;
 if(isIpV4(host)||isIpV6(host)){if(isPrivateIp(host))throw new FetchBlocked('Private, lokale oder reservierte IP-Adressen werden nicht abgerufen.');cache.set(host,true);return;}
 const ips=await deps.resolve(host);
 if(!ips.length)throw new FetchBlocked('Domain nicht auflösbar (keine A/AAAA-Einträge).');
 if(ips.some(isPrivateIp))throw new FetchBlocked('Domain zeigt auf eine private, lokale oder reservierte IP-Adresse und wird nicht abgerufen.');
 cache.set(host,true);}

export type Page={url:string;status:number;html:string};
async function readLimited(r:Response,max:number):Promise<string>{
 const reader=r.body?.getReader();if(!reader)return '';const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel().catch(()=>{});throw new FetchBlocked(`Seite größer als ${Math.round(max/1000)} kB, Abruf abgebrochen.`);}chunks.push(value);}}finally{try{reader.releaseLock();}catch{/* egal */}}
 const buf=new Uint8Array(size);let o=0;for(const c of chunks){buf.set(c,o);o+=c.byteLength;}
 const cs=(r.headers.get('content-type')??'').match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
 try{return new TextDecoder(cs&&cs!=='utf-8'&&cs!=='utf8'?cs:'utf-8').decode(buf);}catch{return new TextDecoder('utf-8').decode(buf);}}

/** Ruft eine öffentliche HTML-Seite ab; prüft jede Redirect-Station erneut. */
export async function safeFetchHtml(start:URL,deps:Deps,cache:Map<string,true>=new Map()):Promise<Page>{
 let url=parsePublicUrl(start.href);
 for(let hop=0;hop<=LIMITS.maxRedirects;hop++){
  await assertPublicHost(url,deps,cache);
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),LIMITS.timeoutMs);
  let r:Response;
  try{r=await deps.fetch(url.href,{method:'GET',redirect:'manual',signal:ctl.signal,headers:{'user-agent':USER_AGENT,accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1','accept-language':'de-DE,de;q=0.9'}});
  }catch{clearTimeout(t);throw new FetchBlocked(`Seite nicht erreichbar oder Zeitüberschreitung (${LIMITS.timeoutMs/1000} s).`);}
  try{
   if(r.status>=300&&r.status<400){const loc=r.headers.get('location');await r.body?.cancel().catch(()=>{});if(!loc)throw new FetchBlocked('Weiterleitung ohne Ziel.');
    if(hop===LIMITS.maxRedirects)throw new FetchBlocked(`Zu viele Weiterleitungen (mehr als ${LIMITS.maxRedirects}).`);
    url=parsePublicUrl(new URL(loc,url).href);continue;}
   const ct=(r.headers.get('content-type')??'').toLowerCase();
   if(r.ok&&ct&&!ct.includes('text/html')&&!ct.includes('application/xhtml')){await r.body?.cancel().catch(()=>{});return {url:url.href,status:r.status,html:''};}
   const len=Number(r.headers.get('content-length')??'0');if(len>LIMITS.maxBytes){await r.body?.cancel().catch(()=>{});throw new FetchBlocked(`Seite größer als ${Math.round(LIMITS.maxBytes/1000)} kB, Abruf abgebrochen.`);}
   if(!r.ok){await r.body?.cancel().catch(()=>{});return {url:url.href,status:r.status,html:''};}
   return {url:url.href,status:r.status,html:await readLimited(r,LIMITS.maxBytes)};
  }catch(e){if(e instanceof FetchBlocked)throw e;if(ctl.signal.aborted)throw new FetchBlocked(`Zeitüberschreitung beim Lesen (${LIMITS.timeoutMs/1000} s).`);throw new FetchBlocked('Seite konnte nicht gelesen werden.');}
  finally{clearTimeout(t);}
 }
 throw new FetchBlocked('Zu viele Weiterleitungen.');}
