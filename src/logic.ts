import {analyzeImpressum,extractLinks,findImpressumLink,knownPaths,type Befund} from './analyze';
import {DISCLAIMER,NORM_STAND,Q,STAND,allgemeineHinweise,pflichtfelder,scope} from './pflicht';
import {FetchBlocked,dohResolver,parsePublicUrl,safeFetchHtml,type Deps,type Page} from './safeFetch';
export const MAX_PAGES=6;
export type Ampel='gruen'|'gelb'|'rot';
export type Feld=Befund&{bezeichnung:string;norm:string;geltung:string};
const KERN=['name','anschrift','email','schnelle_kontaktaufnahme'];
function ampelFor(felder:Feld[],gefunden:boolean):{ampel:Ampel;begruendung:string}{
 if(!gefunden)return {ampel:'rot',begruendung:'Keine Impressum-Seite gefunden (Fußzeilen-Link und übliche Pfade geprüft).'};
 const fehlt=felder.filter(f=>f.status==='nicht_erkennbar');
 if(fehlt.some(f=>f.id==='anschrift'||f.id==='email'))return {ampel:'rot',begruendung:`Grundangaben nicht erkennbar: ${fehlt.map(f=>f.bezeichnung).join('; ')}.`};
 const offen=felder.filter(f=>KERN.includes(f.id)&&f.status==='selbst_pruefen');
 if(fehlt.length||offen.length)return {ampel:'gelb',begruendung:[fehlt.length?`Nicht erkennbar: ${fehlt.map(f=>f.bezeichnung).join('; ')}.`:'',offen.length?`Selbst prüfen: ${offen.map(f=>f.bezeichnung).join('; ')}.`:''].filter(Boolean).join(' ')};
 return {ampel:'gruen',begruendung:'Alle automatisch prüfbaren Grundangaben sind im Text erkennbar. Bedingte Angaben (selbst_pruefen) trotzdem durchgehen.'};}
export async function checkImpressum(args:{url:string},deps:Deps={fetch:(...a)=>fetch(...a),resolve:dohResolver()}){
 const start=parsePublicUrl(args.url);const cache=new Map<string,true>();let abrufe=0;
 const get=async(u:URL):Promise<Page|null>=>{if(abrufe>=MAX_PAGES)return null;abrufe++;return safeFetchHtml(u,deps,cache);};
 let impressum:Page|null=null;let gefunden_ueber='';
 const first=await get(start);
 if(!first||!first.html)throw new FetchBlocked(`Startseite nicht abrufbar (HTTP ${first?.status??'–'} oder kein HTML).`);
 const firstAn=analyzeImpressum(first.html,first.url);
 const pathIsImpressum=/impressum|imprint/i.test(new URL(first.url).pathname);
 if(pathIsImpressum&&firstAn.sieht_wie_impressum_aus){impressum=first;gefunden_ueber='Angegebene URL ist die Impressum-Seite.';}
 else{
  const link=findImpressumLink(extractLinks(first.html,first.url),first.url);
  if(link){const p=await get(new URL(link)).catch(e=>{if(e instanceof FetchBlocked)return null;throw e;});if(p?.html){impressum=p;gefunden_ueber='Link mit „Impressum“/„Imprint“ auf der Startseite.';}}
  if(!impressum)for(const path of knownPaths){if(abrufe>=MAX_PAGES)break;const p=await get(new URL(path,first.url)).catch(e=>{if(e instanceof FetchBlocked)return null;throw e;});
   if(p?.html&&analyzeImpressum(p.html,p.url).sieht_wie_impressum_aus){impressum=p;gefunden_ueber=`Üblicher Pfad ${path} (kein Impressum-Link auf der Startseite erkannt – Erreichbarkeit selbst prüfen).`;break;}}
  if(!impressum&&/angaben\s+gem(?:ä|ae)ß\s+§\s*5/i.test(first.html)){impressum=first;gefunden_ueber='Impressum-Angaben stehen direkt auf der angegebenen Seite.';}
 }
 const meta=new Map(pflichtfelder.map(p=>[p.id,p]));
 const felder:Feld[]=impressum?analyzeImpressum(impressum.html,impressum.url).befunde.map(b=>({...b,bezeichnung:meta.get(b.id)!.bezeichnung,norm:meta.get(b.id)!.norm,geltung:meta.get(b.id)!.geltung})):[];
 const {ampel,begruendung}=ampelFor(felder,!!impressum);
 const host=new URL(first.url).hostname;
 return {url:start.href,host,impressum_gefunden:!!impressum,impressum_url:impressum?.url??'',gefunden_ueber:impressum?gefunden_ueber:'Nicht gefunden.',ampel,ampel_begruendung:begruendung,
  felder,kernfelder:KERN,zusammenfassung:{gefunden:felder.filter(f=>f.status==='gefunden').length,nicht_erkennbar:felder.filter(f=>f.status==='nicht_erkennbar').length,selbst_pruefen:felder.filter(f=>f.status==='selbst_pruefen').length,nicht_einschlaegig:felder.filter(f=>f.status==='nicht_einschlaegig').length},
  abgerufene_seiten:abrufe,geprueft_am:new Date().toISOString().slice(0,10),stand:STAND,norm_stand:NORM_STAND,allgemeine_hinweise:allgemeineHinweise,quellen:Object.values(Q),hinweis:DISCLAIMER,scope};}
