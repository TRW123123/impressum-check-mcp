# Impressum-Check (MCP-Server)

Remote-MCP-Server für lokale Betriebe und Handwerk: Sind die üblichen Pflichtangaben nach § 5 Digitale-Dienste-Gesetz (DDG) im Impressum einer Website erkennbar? Ampel plus Checkliste je Feld, mit Norm, Stand-Datum und Quellen.

**Keine Rechtsberatung, kein Abmahn-Schutz, keine Garantie für Vollständigkeit.** Das Tool erkennt Angaben per Mustererkennung im Text. Ob sie inhaltlich stimmen und welche bedingten Pflichten gelten, prüft es nicht. Kein Abgleich mit dem Handelsregister oder anderen Registern.

- Registry-Name (vorbereitet, nicht eingereicht): `de.ki-automatisieren/impressum-check`
- Website: https://www.ki-automatisieren.de
- Entwickler: KI-Automatisieren (Safak Tepecik)
- Lizenz: MIT
- Transport: Streamable HTTP, JSON-RPC 2.0 auf `POST /mcp`; `GET /health`; Protokollversionen 2025-03-26, 2025-06-18, 2025-11-25

## Status

**Öffentliche Preview (kostenlos, Netlify Function, gleicher Code):** `https://impressum-check-mcp.netlify.app/mcp` – am 12.11.2026 per curl geprüft (health, initialize, tools/list, tools/call positiv und negativ, SSRF-Ziele wie localtest.me, 10.0.0.1.nip.io, [::1], 2130706433 abgelehnt). Manueller Deploy, nicht mit GitHub verknüpft.

Version 0.1.0, gebaut und getestet am 12.11.2026. Lokal mit `wrangler dev` geprüft. **Noch kein Production-Deploy**; die URL in `server.json` (`https://impressum-mcp.ki-automatisieren.de/mcp`) ist nur ein Vorschlag und existiert noch nicht.

## Tools

| Tool | Zweck |
|---|---|
| `check_impressum` | Eingabe `url` (Startseite oder Impressum-Seite). Sucht den Impressum-Link auf der Startseite, sonst `/impressum`, `/impressum.html`, `/imprint`, `/de/impressum` (höchstens 6 Abrufe). Ausgabe: `ampel` (gruen/gelb/rot), `felder` mit Status `gefunden` / `nicht_erkennbar` / `selbst_pruefen` / `nicht_einschlaegig`, `impressum_url`, `gefunden_ueber`, `stand`, `norm_stand`, `quellen`, `hinweis`. Gefundene Namen, Adressen, Nummern werden **nicht** zurückgegeben. |
| `get_impressum_pflichtangaben` | Die Pflichtfeld-Tabelle (§ 5 Abs. 1 Nr. 1–8 DDG, dazu § 36 VSBG als Hinweis) mit Norm, Geltung (immer/bedingt), Erläuterung und Quellen. Ruft nichts ab. |

### Ampel

- **rot**: keine Impressum-Seite gefunden, oder Anschrift bzw. E-Mail nicht erkennbar
- **gelb**: andere Pflichtangabe nicht erkennbar (z. B. Register bei GmbH, Vertretungsberechtigte, zweiter Kontaktweg) oder Kernfeld nur „selbst prüfen“
- **gruen**: alle automatisch prüfbaren Grundangaben erkennbar; bedingte Angaben trotzdem selbst durchgehen

## Pflichtangaben (Stand 12.11.2026)

| Angabe | Norm | Gilt |
|---|---|---|
| Name | § 5 Abs. 1 Nr. 1 DDG | immer |
| Anschrift der Niederlassung | § 5 Abs. 1 Nr. 1 DDG | immer |
| Rechtsform, Vertretungsberechtigte (Kapital nur wenn angegeben) | § 5 Abs. 1 Nr. 1 DDG | juristische Personen |
| E-Mail-Adresse | § 5 Abs. 1 Nr. 2 DDG | immer |
| weitere schnelle Kontaktangabe (z. B. Telefon) | § 5 Abs. 1 Nr. 2 DDG | immer |
| Aufsichtsbehörde | § 5 Abs. 1 Nr. 3 DDG | zulassungspflichtige Tätigkeit (Handwerk laut HWK Düsseldorf: bevollm. Bezirksschornsteinfeger, Büchsenmacher) |
| Register und Registernummer | § 5 Abs. 1 Nr. 4 DDG | wenn eingetragen |
| Kammer, Berufsbezeichnung, Staat, Berufsrecht | § 5 Abs. 1 Nr. 5 DDG | reglementierte Berufe (Handwerk laut ZDH: Gesundheitshandwerke) |
| USt-IdNr. / Wirtschafts-IdNr. | § 5 Abs. 1 Nr. 6 DDG | wenn vorhanden |
| Abwicklung/Liquidation | § 5 Abs. 1 Nr. 7 DDG | AG, KGaA, GmbH in Abwicklung |
| Sitzland, Regulierungsbehörden | § 5 Abs. 1 Nr. 8 DDG | audiovisuelle Mediendienste |
| Verbraucherschlichtung | § 36 VSBG | je nach Betrieb (Ausnahme Abs. 3: bis zehn Beschäftigte) |

Norm-Stand: DDG vom 6. Mai 2024 (BGBl. 2024 I Nr. 149); laut gesetze-im-internet.de am 12.11.2026 zuletzt geändert durch Art. 26 Abs. 2 G v. 25.3.2026 I Nr. 81 (Änderung durch Art. 1 G v. 12.5.2026 I Nr. 138 textlich nachgewiesen).

## Quellen (live geprüft am 12.11.2026)

- § 5 DDG: https://www.gesetze-im-internet.de/ddg/__5.html
- DDG mit Standangabe: https://www.gesetze-im-internet.de/ddg/BJNR0950B0024.html
- § 36 VSBG: https://www.gesetze-im-internet.de/vsbg/__36.html
- ZDH, Praxis Recht – Impressumspflicht: https://www.zdh.de/ueber-uns/fachbereich-organisation-und-recht/praxis-recht-/-leitfaeden/praxis-recht-impressumspflicht/
- HWK Düsseldorf, Impressumspflicht: https://www.hwk-duesseldorf.de/artikel/web-impressum-31,0,1113.html

## Sicherheit (SSRF) und Datenschutz

- Nur `http`/`https`, nur Ports 80 und 443, keine URLs mit Benutzer/Passwort.
- Hostnamen wie `localhost`, `*.local`, `*.internal`, `metadata.google.internal` und Hosts ohne Punkt werden abgelehnt.
- Vor **jedem** Abruf, auch nach jedem Redirect, wird der Host per DNS-over-HTTPS (Cloudflare, kostenlos, ohne Schlüssel) aufgelöst. Zeigt eine A/AAAA-Adresse auf ein privates, Loopback-, Link-Local-, CGNAT-, Metadata-, Multicast-, Doku- oder reserviertes Netz (IPv4 und IPv6, inkl. IPv4-mapped, NAT64, 6to4), wird nicht abgerufen.
- Redirects manuell, höchstens 3; 8 s Timeout je Abruf; Body höchstens 1,5 MB; nur HTML wird ausgewertet; höchstens 6 Seitenabrufe pro Prüfung.
- User-Agent: `ImpressumCheckMCP/0.1 (+https://www.ki-automatisieren.de; …)`.
- Rate-Limit pro Isolate: 120 Anfragen/Minute/IP, davon höchstens 10 `check_impressum`. IPs werden nicht geloggt.
- Geloggt werden nur Tool-Name, Erfolg und Dauer. Seiteninhalte werden nur im Speicher verarbeitet und nicht gespeichert.
- Bekannte Grenze: Zwischen DNS-Prüfung und Abruf löst die Laufzeit den Namen erneut auf (DNS-Rebinding mit sehr kurzer TTL ist theoretisch möglich). Cloudflare Workers erreichen private Netze ohnehin nicht direkt; auf anderen Laufzeiten zusätzlich Egress-Regeln setzen.

## Entwicklung

```bash
npm install
npm run typecheck
npm test
npm run secret-scan
npm run dev      # wrangler dev auf 127.0.0.1:8794
npm run smoke    # health, initialize, tools/list, tools/call +/- (prüft eine eigene Domain live)
```

Kein `route` in `wrangler.toml`: Production-Deploy und Custom Domain erst nach Freigabe.
