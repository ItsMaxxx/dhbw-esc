# agents.md

## Was ist das?
Abstimmungsportal für den DHBW-internen Eurovision Cat Contest (ESC-Parodie).
Stack: Node.js + Express + SQLite, Vanilla JS/HTML/CSS, kein Build-Step.

## Rollen
| Rolle | Zugang | Funktion |
|---|---|---|
| Viewer | Selbstregistrierung + E-Mail-Verifikation | Bis zu 20 Punkte frei auf Sänger verteilen |
| Jury | Fester DB-Login (Klartext-Passwort) | ESC-Punkte 1–8, 10, 12 vergeben |
| Admin | Jury-Login mit `country = "Admin"` | Voting starten, Ergebnisse freigeben, Reset |

## Datenfluss Voting
1. Admin startet Voting → SSE-Broadcast an alle Clients
2. Viewer verteilen bis zu 20 Rohpunkte (nicht auf eigenes Land)
3. Jury vergibt ESC-Punkte – jeder Wert und jeder Sänger nur einmal
4. Admin gibt Ergebnisse frei → SSE-Broadcast
5. Viewer-Rohpunkte werden pro Herkunftsland in ESC-Punkte umgerechnet (Rang 1 = 12, Rang 2 = 10, dann 8/7/6/5/4/3/2/1)
6. Gesamtpunktzahl = Jury-Punkte + umgerechnete Viewer-Punkte

## Datenbank-Schema (SQLite)
- `viewer_users`: id, first_name, last_name, email, password (bcrypt), country_code, is_verified, verify_token
- `jury_login_data`: jury_mail, password (Klartext), country
- `singer`: id, singer_name, song_name, country_id
- `country`: id, country, landcode, land_bild
- `viewer_vote`: viewer_id, singer_id, points
- `jury_vote`: jury_country, singer_id, points

## Echtzeit (SSE)
- Endpoint: `GET /api/events`
- Events: `state` (Voting-Status geändert), `votes` (neue Stimme abgegeben)
- Heartbeat alle 25 Sekunden; beim Verbinden wird der aktuelle State sofort gesendet

## Sicherheit
- Viewer: bcrypt (10 Runden) + E-Mail-Verifikation via Crypto-Token
- XSS-Schutz: `escapeHtml()` im Client-JS für alle dynamisch eingefügten Inhalte
- Session: `httpOnly`, kein `maxAge`, `secure: false` (lokales HTTP)
- Kein CSRF-Schutz (internes Tool)

## Was nicht ohne Absprache geändert werden sollte
- Jury-Punkte-Schema (1–8, 10, 12) – ESC-Standard
- Viewer-Maximum von 20 Punkten
- Umrechnungslogik Viewer → ESC-Punkte (12/10/8/7/6/5/4/3/2/1 pro Land)
- Jury-Passwörter Klartext lassen
