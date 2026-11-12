// HTML → Text und Erkennung der Pflichtangaben. Gibt nur Status zurück, nie die gefundenen Werte.
const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß',sect:'§',commat:'@',period:'.',ndash:'–',mdash:'—',shy:''};
export function decodeEntities(s:string){return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e:string)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return Number.isFinite(n)&&n>0&&n<0x110000?String.fromCodePoint(n):m;}return entities[e]??m;});}
export function htmlToText(html:string){
 return decodeEntities(html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|tr|h[1-6]|section|footer|address|td|dd|dt)>/gi,'\n').replace(/<[^>]+>/g,' '))
  .replace(/[ \t\u00a0]+/g,' ').replace(/\s*\n\s*/g,'\n').trim();}
export type Link={href:string;text:string};
export function extractLinks(html:string,base:string):Link[]{
 const out:Link[]=[];const re=/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;let m:RegExpExecArray|null;let n=0;
 while((m=re.exec(html))&&n++<3000){const href=m[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);if(!href)continue;
  const raw=decodeEntities((href[1]??href[2]??href[3]??'').trim());const title=m[1].match(/\b(?:title|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const text=(htmlToText(m[2])+' '+(title?.[1]??title?.[2]??'')).trim();
  if(/^(mailto|tel):/i.test(raw)){out.push({href:raw,text});continue;}
  try{const u=new URL(raw,base);if(u.protocol==='http:'||u.protocol==='https:'){u.hash='';out.push({href:u.href,text});}}catch{/* ungültiger Link */}}
 return out;}
const impressumWord=/impressum|imprint|legal[\s-]?notice|anbieterkennzeichnung|site[\s-]?notice/i;
/** Sucht einen Impressum-Link (Linktext oder Pfad) auf derselben Website. */
export function findImpressumLink(links:Link[],base:string):string|null{
 const b=new URL(base);const site=(h:string)=>h.replace(/^www\./,'').toLowerCase();
 const cands=links.filter(l=>/^https?:/i.test(l.href)).filter(l=>{try{return site(new URL(l.href).hostname)===site(b.hostname);}catch{return false;}});
 const byText=cands.filter(l=>impressumWord.test(l.text));const byPath=cands.filter(l=>impressumWord.test(new URL(l.href).pathname));
 const pick=[...byText,...byPath].find(l=>new URL(l.href).href.replace(/\/$/,'')!==b.href.replace(/\/$/,''));
 return pick?pick.href:null;}
export const knownPaths=['/impressum','/impressum.html','/imprint','/de/impressum'];

export type Status='gefunden'|'nicht_erkennbar'|'selbst_pruefen'|'nicht_einschlaegig';
export type Befund={id:string;status:Status;erkannt_an:string};
const juristischI=/(?:\bg?gmbh|\bug\s*\(haftungsbeschränkt\)|\bunternehmergesellschaft|\baktiengesellschaft|\bkgaa|\be\.\s?g\.|\beingetragene genossenschaft|\be\.\s?v\.|\beingetragener verein)/i;
const juristischC=/\b(?:AG|SE|UG|KGaA)\b/;
const registerI=/(?:\be\.\s?k(?:fm|fr)?\.|\beingetragene[rs]? kauf(?:mann|frau)|\bohg\b|\boffene handelsgesellschaft|\bkommanditgesellschaft|\bpartg|\bpartnerschaftsgesellschaft|\begbr\b)/i;
const registerC=/\b(?:KG|OHG|PartG|eGbR)\b/;
export function detectRechtsform(text:string){const j=juristischI.test(text)||juristischC.test(text);return {juristisch:j,registerpflichtig:j||registerI.test(text)||registerC.test(text)};}
export function analyzeImpressum(html:string,base:string){
 const text=htmlToText(html);const links=extractLinks(html,base);const t=text;
 const hasMailto=links.some(l=>/^mailto:/i.test(l.href));const hasTel=links.some(l=>/^tel:/i.test(l.href));
 const email=hasMailto||/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(t)||/[\w.+-]+\s*(?:\[at\]|\(at\)|\{at\}| at |\[ät\])\s*[\w-]+(?:\s*(?:\.|\[dot\]|\(dot\)|\[punkt\]|\(punkt\))\s*[\w-]+)+/i.test(t);
 const phoneNum=/(?:\+49|0049|\(?0\d{2,5}\)?)[\s\/().-]*\d[\d\s\/().-]{4,}\d/;
 const tel=hasTel||new RegExp(String.raw`(tel(?:efon)?|fon|phone|mobil|handy|fax)\.?\s*:?\s*`+phoneNum.source,'i').test(t)||/(?:\+49|0049)[\s\/().-]*\d[\d\s\/().-]{6,}\d/.test(t);
 const messenger=/whatsapp|\bsignal\b|telegram|threema/i.test(t)||links.some(l=>/^https?:\/\/(wa\.me|api\.whatsapp\.com|t\.me|signal\.me|threema\.id)\//i.test(l.href));
 const formular=/kontaktformular|contact form/i.test(t)||/<form\b/i.test(html);
 const plzOrt=/(?:^|[\s,])(?:D-)?\d{5}\s+[A-ZÄÖÜ][\wäöüß.\-]+/m.test(t);
 const strasse=/[A-Za-zÄÖÜäöüß.\-]{2,}(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|damm|ufer|chaussee|steig|pfad|markt|hof|berg|feld|tor|graben|kamp|wall|zeile|park|garten|anger|winkel|brücke|stieg)\s*\d+\s?[a-zA-Z]?\b/i.test(t)||/\b(?:Straße|Strasse|Str\.|Weg|Platz|Allee|Gasse|Ring|Am|An der|Auf der|Im|In der|Zum|Zur)\s+[A-ZÄÖÜ][\wäöüß.\-]*(?:\s+[A-ZÄÖÜ][\wäöüß.\-]*)?\s+\d+\s?[a-zA-Z]?\b/.test(t);
 const nurPostfach=/postfach\s*\d+/i.test(t)&&!strasse;
 const rf=detectRechtsform(t);
 const name=/angaben\s+gem(?:ä|ae)ß\s+§\s*5|anbieter(?:in)?\s*:|inhaber(?:in)?\s*:?|\binh\.|betreiber(?:in)?\s*:|verantwortlich|firma\s*:|vertreten\s+durch|geschäftsführ/i.test(t)||rf.registerpflichtig||/\bGbR\b/.test(t);
 const vertretung=/vertreten\s+durch|vertretungsberechtigt|geschäftsführ(?:er|erin|ung)|\bGF\b|vorstand|managing director/i.test(t);
 const register=/(handels|genossenschafts|vereins|partnerschafts|gesellschafts)register|registergericht|amtsgericht|register(?:nummer|eintrag)|\bHR\s?[AB]\s*[\d\s]{2,}|\b(?:GnR|VR|PR|GsR)\s*\d+/i.test(t);
 const ust=/\bDE\s?\d{3}\s?\d{3}\s?\d{3}\b/.test(t)||/ust\.?[\s-]*id|umsatzsteuer[\s-]*identifikations|wirtschafts[\s-]*identifikations|w[\s-]*idnr/i.test(t);
 const aufsicht=/aufsichtsbehörde/i.test(t);const kammer=/(handwerks|ärzte|zahnärzte|rechtsanwalts|steuerberater|architekten|ingenieur)kammer|berufsbezeichnung|berufsrechtliche/i.test(t);
 const schlichtung=/verbraucherschlichtung|streitbeilegung|schlichtungsstelle|streitschlichtung/i.test(t);
 const liquidation=/in\s+liquidation|in\s+abwicklung|\bi\.\s?L\./i.test(t);
 const b=(id:string,ok:boolean,an:string,sonst:Status='nicht_erkennbar',sonstAn='Nicht im Text erkannt.'):Befund=>ok?{id,status:'gefunden',erkannt_an:an}:{id,status:sonst,erkannt_an:sonstAn};
 const befunde:Befund[]=[
  b('name',name,'Hinweis auf Anbieterangabe erkannt (z. B. „Angaben gemäß § 5“, „Inhaber“, Rechtsform). Name selbst prüfen.'),
  nurPostfach?{id:'anschrift',status:'nicht_erkennbar',erkannt_an:'Nur ein Postfach erkannt, keine Straße mit Hausnummer.'}:b('anschrift',plzOrt&&strasse,'Postleitzahl mit Ort und Straße mit Hausnummer erkannt.','nicht_erkennbar',plzOrt||strasse?'Anschrift nur teilweise erkannt (PLZ/Ort oder Straße fehlt).':'Nicht im Text erkannt.'),
  rf.juristisch?b('rechtsform_vertretung',vertretung,'Rechtsform einer juristischen Person und Vertretungsberechtigte erkannt.','nicht_erkennbar','Rechtsform einer juristischen Person erkannt, aber keine Vertretungsberechtigten (z. B. „Geschäftsführer“, „vertreten durch“).'):{id:'rechtsform_vertretung',status:'nicht_einschlaegig',erkannt_an:'Keine Rechtsform einer juristischen Person erkannt. Falls doch (z. B. GmbH, UG), selbst prüfen.'},
  b('email',email,'E-Mail-Adresse oder mailto-Link erkannt.'),
  !tel&&!formular&&messenger?{id:'schnelle_kontaktaufnahme',status:'selbst_pruefen',erkannt_an:'Nur ein Messenger-Kontakt (z. B. WhatsApp) erkannt, keine Telefonnummer und kein Kontaktformular. Ob das genügt, selbst prüfen.'}:b('schnelle_kontaktaufnahme',tel||formular,tel?'Telefonnummer oder tel-Link erkannt.':'Kontaktformular-Hinweis erkannt (keine Telefonnummer).'),
  register?{id:'register',status:'gefunden',erkannt_an:'Registerangabe erkannt (kein Abgleich mit einem Register).'}:rf.registerpflichtig?{id:'register',status:'nicht_erkennbar',erkannt_an:'Rechtsform mit Registereintrag erkannt, aber keine Register- oder Registernummer-Angabe.'}:{id:'register',status:'selbst_pruefen',erkannt_an:'Keine Registerangabe und keine eintragungspflichtige Rechtsform erkannt. Falls eingetragen: Register und Nummer angeben.'},
  b('aufsichtsbehoerde',aufsicht,'Angabe zur Aufsichtsbehörde erkannt.','selbst_pruefen','Nur nötig bei zulassungspflichtiger Tätigkeit: selbst prüfen.'),
  b('kammer_beruf',kammer,'Kammer- oder Berufsrechtsangabe erkannt.','selbst_pruefen','Nur nötig bei reglementierten Berufen (z. B. Gesundheitshandwerke): selbst prüfen.'),
  b('ust_id',ust,'USt-IdNr. oder Wirtschafts-IdNr. erkannt.','selbst_pruefen','Keine USt-IdNr./W-IdNr. erkannt. Angeben, falls vorhanden: selbst prüfen.'),
  b('abwicklung',liquidation,'Hinweis auf Abwicklung/Liquidation erkannt.','selbst_pruefen','Nur bei Kapitalgesellschaften in Abwicklung oder Liquidation: selbst prüfen.'),
  {id:'audiovisuell',status:'selbst_pruefen',erkannt_an:'Nur bei audiovisuellen Mediendiensten: selbst prüfen.'},
  b('verbraucherschlichtung',schlichtung,'Hinweis zur Verbraucherschlichtung erkannt.','selbst_pruefen','Kein Hinweis erkannt. § 36 VSBG greift je nach Betrieb (Ausnahme bis zehn Beschäftigte für Abs. 1 Nr. 1): selbst prüfen.')
 ];
 return {befunde,rechtsform:rf,textLaenge:text.length,sieht_wie_impressum_aus:impressumWord.test(t)||/angaben\s+gem(?:ä|ae)ß\s+§\s*5/i.test(t)};}
