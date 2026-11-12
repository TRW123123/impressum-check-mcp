import {describe,it,expect} from 'vitest';
import {analyzeImpressum,findImpressumLink,extractLinks,htmlToText,detectRechtsform} from '../src/analyze';
import {IMPRESSUM_GMBH,IMPRESSUM_EINZEL,IMPRESSUM_GMBH_LUECKEN,HOME} from './helpers';
const st=(html:string)=>Object.fromEntries(analyzeImpressum(html,'https://x.example.de/impressum').befunde.map(b=>[b.id,b.status]));
describe('Feld-Erkennung',()=>{
 it('vollständiges GmbH-Impressum',()=>{const s=st(IMPRESSUM_GMBH);expect(s).toMatchObject({name:'gefunden',anschrift:'gefunden',rechtsform_vertretung:'gefunden',email:'gefunden',schnelle_kontaktaufnahme:'gefunden',register:'gefunden',ust_id:'gefunden',aufsichtsbehoerde:'selbst_pruefen',kammer_beruf:'selbst_pruefen'});});
 it('Einzelunternehmen mit verschleierter E-Mail',()=>{const s=st(IMPRESSUM_EINZEL);expect(s).toMatchObject({name:'gefunden',anschrift:'gefunden',email:'gefunden',schnelle_kontaktaufnahme:'gefunden',register:'selbst_pruefen',rechtsform_vertretung:'nicht_einschlaegig',ust_id:'selbst_pruefen'});});
 it('GmbH ohne Geschäftsführer, Register und Telefon',()=>{const s=st(IMPRESSUM_GMBH_LUECKEN);expect(s).toMatchObject({anschrift:'gefunden',email:'gefunden',rechtsform_vertretung:'nicht_erkennbar',register:'nicht_erkennbar',schnelle_kontaktaufnahme:'nicht_erkennbar'});});
 it('nur Postfach gilt nicht als Anschrift',()=>expect(st('<p>Impressum: Firma X, Postfach 1234, 12345 Musterstadt, info@x.de</p>').anschrift).toBe('nicht_erkennbar'));
 it('mailto- und tel-Links zählen',()=>{const s=st('<p>Impressum</p><a href="mailto:a@b.de">Mail</a><a href="tel:+491234">Anrufen</a>');expect(s.email).toBe('gefunden');expect(s.schnelle_kontaktaufnahme).toBe('gefunden');});
 it('Kontaktformular zählt als zweiter Kontaktweg',()=>expect(st('<p>Impressum</p><p>Nutzen Sie unser Kontaktformular</p>').schnelle_kontaktaufnahme).toBe('gefunden'));
 it('Verbraucherschlichtung wird erkannt',()=>expect(st('<p>Wir sind nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>').verbraucherschlichtung).toBe('gefunden'));
 it('Skripte und Kommentare werden ignoriert, Entities dekodiert',()=>{expect(htmlToText('<script>var a="info@x.de"</script><!-- 12345 Ort --><p>Gr&uuml;&szlig;e&nbsp;&#x41;</p>')).toBe('Grüße A');expect(st('<script>var m="a@b.de"</script>').email).toBe('nicht_erkennbar');});
 it('Rechtsform-Erkennung ohne Fehltreffer bei normalen Wörtern',()=>{expect(detectRechtsform('Am Tag der offenen Tür sagen wir es')).toEqual({juristisch:false,registerpflichtig:false});expect(detectRechtsform('Muster UG (haftungsbeschränkt)').juristisch).toBe(true);expect(detectRechtsform('Max Muster e.K.').registerpflichtig).toBe(true);expect(detectRechtsform('Muster GmbH & Co. KG').juristisch).toBe(true);});
});
describe('Impressum-Link finden',()=>{
 it('nimmt den Footer-Link derselben Website, nicht fremde Hosts',()=>expect(findImpressumLink(extractLinks(HOME('/de/impressum/'),'https://www.x.example.de/'),'https://www.x.example.de/')).toBe('https://www.x.example.de/de/impressum/'));
 it('erkennt www und ohne www als dieselbe Website und /imprint im Pfad',()=>expect(findImpressumLink(extractLinks('<a href="https://x.example.de/imprint">Legal</a>','https://www.x.example.de/'),'https://www.x.example.de/')).toBe('https://x.example.de/imprint'));
 it('liefert null ohne passenden Link',()=>expect(findImpressumLink(extractLinks('<a href="/kontakt">Kontakt</a><a href="mailto:a@b.de">Impressum</a>','https://x.example.de/'),'https://x.example.de/')).toBeNull());
});
describe('Messenger als Kontaktweg',()=>{
 it('nur WhatsApp → selbst_pruefen, nicht gefunden',()=>expect(st('<p>Impressum</p><a href="https://wa.me/491234">WhatsApp</a>').schnelle_kontaktaufnahme).toBe('selbst_pruefen'));
});
