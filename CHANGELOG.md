# Changelog

## 0.1.0 – 2026-11-12
- Erste Version: Tools `check_impressum` und `get_impressum_pflichtangaben`.
- Pflichtangaben live geprüft am 12.11.2026: § 5 DDG und Standangabe (gesetze-im-internet.de), § 36 VSBG, ZDH „Praxis Recht – Impressumspflicht“, HWK Düsseldorf.
- SSRF-Schutz: nur http/https auf Port 80/443, keine Zugangsdaten in URLs, DNS-over-HTTPS-Prüfung vor jedem Abruf und nach jedem Redirect (private, Loopback-, Link-Local-, CGNAT-, Metadata-, Multicast- und Doku-Netze gesperrt), max. 3 Redirects, 8 s Timeout, 1,5 MB Limit, max. 6 Seitenabrufe pro Prüfung.
- Rate-Limit: 120 Anfragen/Minute/IP allgemein, 10 `check_impressum`/Minute/IP.
- Kein Registerabgleich, keine Rückgabe gefundener Personen- oder Registerdaten, nichts gespeichert.
- Netlify-Preview: https://impressum-check-mcp.netlify.app/mcp (kostenloser Plan, manueller Deploy).
- Streamable-HTTP-JSON-RPC nach dem Muster von standkosten-rechner/passbild-regel-check; Netlify-Adapter überschreibt cf-connecting-ip immer mit der Netlify-Client-IP.
