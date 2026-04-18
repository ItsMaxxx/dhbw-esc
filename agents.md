# agents.md

## Was ist das?
Abstimmungsportal für den DHBW-internen Eurovision Cat Contest (ESC-Parodie).
Stack: Node.js + Express + SQLite, Vanilla JS/HTML/CSS, kein Build-Step.
Noch nicht online, wird aber genau so gehostet.

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


## Was nicht ohne Absprache geändert werden sollte
- Jury-Punkte-Schema (1–8, 10, 12) – ESC-Standard
- Viewer-Maximum von 20 Punkten
- Umrechnungslogik Viewer → ESC-Punkte (12/10/8/7/6/5/4/3/2/1 pro Land)
- Jury-Passwörter Klartext lassen

Sicherheitsrisiken

  Hoch

  1. SQLite-Datenbank ist in Git versioniert - GEWOLLT
  model/esc-database.db ist explizit in .gitignore auskommentiert (# model/esc-database.db) und dadurch getrackt. Darin stehen echte E-Mail-Adressen, bcrypt-Hashes und
  alle Votes. Sobald das Repo geteilt wird, gehen diese Daten mit.

  2. Kein CSRF-Schutz
  Alle POST/DELETE-Endpunkte (inkl. clear-votes, start-voting, Account löschen) haben keinen CSRF-Token. Eine externe Seite könnte diese Aktionen auslösen, solange ein
  Admin/Viewer eine aktive Session hat.

  3. HTML-Injection in Verifikations-E-Mail
  In model/mailer.js:24 wird firstName unescaped direkt in HTML interpoliert:
  <h2>Hallo ${firstName},</h2>
  Wer sich mit <b>Böser Name</b> registriert, bricht das E-Mail-Layout. Mit aggressiverem Input könnten E-Mail-Clients Schaden nehmen.

  4. Kein Rate-Limiting auf Login/Signup
  /api/login und /api/signup haben keinerlei Drosselung. Brute-Force auf Viewer-Passwörter ist möglich.

  ---
  Mittel

  5. Verifikations-Token läuft nie ab
  verify_token wird gesetzt, aber nie mit einem Ablaufdatum versehen (model/database.js:86). Ein gestohlener Link ist unbegrenzt gültig.

  6. localhost:3000 hardcoded in mailer.js:17
  const verifyUrl = `http://localhost:3000/api/verify?token=${token}`;
  Auf jedem anderen Host (Docker, Synology, anderer Port) geht die Verifikation kaputt.

  7. Singer-IDs werden nicht gegen die DB validiert
  In voteModel.js wird geprüft ob Punkte korrekt sind, aber nicht ob die eingereichte singerId überhaupt existiert. Ein Client kann Votes für beliebige IDs eintragen.

  8. Keine Eingabelängen-Validierung
  firstName, lastName, email etc. haben serverseitig keine maxLength-Prüfung. Sehr lange Strings gehen direkt in die DB.

  ---
  Niedrig / Info

  9. Toter Code: getViewerUser() in database.js:45
  Diese Funktion vergleicht ein Klartext-Passwort mit einem bcrypt-Hash – das kann nie matchen. Sie wird nirgends mehr verwendet (Login läuft über
  getViewerByEmailForLogin), ist aber irreführend.

  10. Keine Security-Header
  Kein Content-Security-Policy, kein X-Frame-Options, kein X-Content-Type-Options. Für ein internes Tool unkritisch, aber leicht nachrüstbar mit helmet.

  11. Jury-Passwörter im Klartext (bekannt, absichtlich)
  Wird im README und agents.md dokumentiert – für ein rein internes Tool vertretbar.

  ---
  Größte Priorität wäre #1 (DB in Git) und #6 (hardcoded localhost), da die direkt beim nächsten Deployment brechen oder Daten leaken. Soll ich eines oder mehrere davon
  direkt fixen?
