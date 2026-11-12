import type {Deps} from '../src/safeFetch';
export type Route={status?:number;html?:string;headers?:Record<string,string>;body?:ReadableStream<Uint8Array>};
/** Netz-Mock: URL → Antwort; DNS-Mock: Host → IPs. Unbekannte URLs liefern 404. */
export function mockDeps(routes:Record<string,Route>,dns:Record<string,string[]>={}){
 const calls:{url:string;init?:RequestInit}[]=[];
 const deps:Deps={
  fetch:(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);calls.push({url,init});const r=routes[url];
   if(!r)return new Response('not found',{status:404,headers:{'content-type':'text/html'}});
   return new Response(r.body??r.html??'',{status:r.status??200,headers:{'content-type':'text/html; charset=utf-8',...(r.headers??{})}});}) as typeof fetch,
  resolve:async host=>dns[host]??['93.184.215.14']};
 return {deps,calls};}
export const IMPRESSUM_GMBH=`<html><body><main><h1>Impressum</h1><p>Angaben gemäß § 5 DDG</p>
<p>Muster Sanitär GmbH<br>Musterstraße 12<br>12345 Musterstadt</p>
<p>Vertreten durch den Geschäftsführer: Max Mustermann</p>
<p>Telefon: 0123 456789<br>E-Mail: info&#64;muster-sanitaer.example.de</p>
<p>Registergericht: Amtsgericht Musterstadt, HRB 12345</p>
<p>Umsatzsteuer-Identifikationsnummer: DE123456789</p></main></body></html>`;
export const IMPRESSUM_EINZEL=`<h1>Impressum</h1><p>Inhaber: Erika Musterfrau, Malerbetrieb Musterfrau</p><p>Am Markt 3, 54321 Beispielort</p><p>Tel. +49 (0) 1234 / 56 78 90</p><p>Mail: kontakt [at] maler-musterfrau [dot] de</p>`;
export const IMPRESSUM_GMBH_LUECKEN=`<h1>Impressum</h1><p>Muster Bau GmbH, Bahnhofstraße 1, 12345 Musterstadt</p><p>E-Mail: bau@example.org</p>`;
export const HOME=(href='/impressum')=>`<html><body><nav><a href="/leistungen">Leistungen</a></nav><footer><a href="https://andere-seite.example.org/impressum">Fremd</a><a href="${href}">Impressum</a><a href="/datenschutz">Datenschutz</a></footer></body></html>`;
