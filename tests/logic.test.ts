import {describe,it,expect} from 'vitest';
import {checkImpressum,MAX_PAGES} from '../src/logic';
import {getPflichtangaben,pflichtfelder,Q,STAND} from '../src/pflicht';
import {mockDeps,HOME,IMPRESSUM_GMBH,IMPRESSUM_GMBH_LUECKEN} from './helpers';
const B='https://www.muster.example.de/';
describe('checkImpressum',()=>{
 it('findet das Impressum über den Footer-Link, Ampel grün, keine Personendaten im Ergebnis',async()=>{const {deps,calls}=mockDeps({[B]:{html:HOME()},[B+'impressum']:{html:IMPRESSUM_GMBH}});const r=await checkImpressum({url:'www.muster.example.de'},deps);
  expect(r.impressum_gefunden).toBe(true);expect(r.impressum_url).toBe(B+'impressum');expect(r.ampel).toBe('gruen');expect(r.abgerufene_seiten).toBe(2);expect(calls.map(c=>c.url)).toEqual([B,B+'impressum']);
  const j=JSON.stringify(r);for(const pii of ['Mustermann','HRB 12345','DE123456789','0123 456789','Musterstraße'])expect(j).not.toContain(pii);
  expect(r.hinweis).toContain('Keine Rechtsberatung');expect(r.hinweis).toContain('Abmahnungen');expect(r.stand).toBe(STAND);expect(r.quellen.map(q=>q.url)).toContain(Q.ddg5.url);expect(r.norm_stand).toContain('BGBl');expect(r.felder).toHaveLength(pflichtfelder.length);});
 it('nutzt übliche Pfade, wenn kein Link da ist',async()=>{const {deps}=mockDeps({[B]:{html:'<p>Willkommen</p>'},[B+'imprint']:{html:IMPRESSUM_GMBH}});const r=await checkImpressum({url:B},deps);expect(r.impressum_url).toBe(B+'imprint');expect(r.gefunden_ueber).toContain('/imprint');});
 it('direkte Impressum-URL wird ohne weiteren Abruf geprüft',async()=>{const {deps,calls}=mockDeps({[B+'impressum']:{html:IMPRESSUM_GMBH}});const r=await checkImpressum({url:B+'impressum'},deps);expect(calls).toHaveLength(1);expect(r.ampel).toBe('gruen');});
 it('kein Impressum → rot, höchstens MAX_PAGES Abrufe',async()=>{const {deps,calls}=mockDeps({[B]:{html:'<p>Nur Startseite</p>'}});const r=await checkImpressum({url:B},deps);expect(r.impressum_gefunden).toBe(false);expect(r.ampel).toBe('rot');expect(calls.length).toBeLessThanOrEqual(MAX_PAGES);});
 it('fehlende Register- und Vertretungsangaben → gelb',async()=>{const {deps}=mockDeps({[B]:{html:HOME()},[B+'impressum']:{html:IMPRESSUM_GMBH_LUECKEN}});const r=await checkImpressum({url:B},deps);expect(r.ampel).toBe('gelb');expect(r.zusammenfassung.nicht_erkennbar).toBe(3);});
 it('fehlende E-Mail → rot',async()=>{const {deps}=mockDeps({[B]:{html:HOME()},[B+'impressum']:{html:'<h1>Impressum</h1><p>Muster, Hauptstraße 1, 12345 Ort, Tel. 0123 456789</p>'}});expect((await checkImpressum({url:B},deps)).ampel).toBe('rot');});
 it('nicht abrufbare Startseite → Fehler',async()=>{const {deps}=mockDeps({});await expect(checkImpressum({url:B},deps)).rejects.toThrow(/nicht abrufbar/);});
 it('SSRF auch im Orchestrator: private Ziele werden vor jedem Abruf abgelehnt',async()=>{const {deps,calls}=mockDeps({},{'www.muster.example.de':['127.0.0.1']});await expect(checkImpressum({url:B},deps)).rejects.toThrow(/private/);expect(calls).toHaveLength(0);await expect(checkImpressum({url:'http://169.254.169.254/'},deps)).rejects.toThrow(/IP-Adressen/);});
});
describe('Pflichtangaben-Tabelle',()=>{
 it('jede Zeile hat Norm, Geltung und belegte Quellen',()=>{const t=getPflichtangaben();expect(t.pflichtfelder).toHaveLength(12);const known=Object.values(Q).map(q=>q.url);for(const f of t.pflichtfelder){expect(f.norm).toMatch(/^§ (5 Abs\. 1 Nr\. \d DDG|36 VSBG)$/);expect(f.quellen.length).toBeGreaterThan(0);for(const u of f.quellen)expect(known).toContain(u);}for(const q of t.quellen){expect(q.url.startsWith('https://')).toBe(true);expect(q.live_geprueft_am).toBe(STAND);}expect(t.hinweis).toContain('Handelsregister');});
 it('Kernfelder gelten immer, Register und Kammer nur bedingt',()=>{const g=Object.fromEntries(pflichtfelder.map(f=>[f.id,f.geltung]));expect(g).toMatchObject({name:'immer',anschrift:'immer',email:'immer',register:'bedingt',kammer_beruf:'bedingt',ust_id:'bedingt'});});
});
describe('Ampel bei Messenger-only',()=>{
 it('Kernfeld selbst_pruefen → gelb',async()=>{const {deps}=mockDeps({[B]:{html:HOME()},[B+'impressum']:{html:'<h1>Impressum</h1><p>Inhaber: X, Hauptstraße 1, 12345 Ort</p><p>info@x.de</p><a href="https://wa.me/49123">WhatsApp</a>'}});const r=await checkImpressum({url:B},deps);expect(r.ampel).toBe('gelb');expect(r.ampel_begruendung).toContain('Selbst prüfen');});
});
