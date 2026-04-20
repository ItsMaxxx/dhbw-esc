# DHBW Eurovision Cat Contest – Voting Portal

Ein vollständiges Abstimmungsportal für den DHBW-internen Eurovision Cat Contest (ESC-Parodie). Viewer können sich registrieren und abstimmen, Jury-Mitglieder haben einen separaten Login, und ein Admin steuert den gesamten Ablauf in Echtzeit.

---

## Quickstart

```bash
git clone <repository-url>
cd dhbw-esc
npm install
# .env anlegen (siehe Abschnitt Umgebungsvariablen)
npm start
```

Der Server läuft dann unter `http://localhost:3000` (oder dem in `.env` gesetzten Port).

---

## Inhaltsverzeichnis

- [Funktionsübersicht](#funktionsübersicht)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Umgebungsvariablen (.env)](#umgebungsvariablen-env)
- [Starten der Anwendung](#starten-der-anwendung)
- [Docker-Deployment](#docker-deployment)
- [Cloudflare Tunnel (Production)](#cloudflare-tunnel-production)
- [Jury- und Admin-Accounts einrichten](#jury--und-admin-accounts-einrichten)
- [Projektstruktur](#projektstruktur)
- [Voting-Ablauf](#voting-ablauf)
- [Bekannte Einschränkungen](#bekannte-einschränkungen)
- [Routen & API](#routen--api)
- [Verwendete Technologien](#verwendete-technologien)

---

## Funktionsübersicht

| Feature | Beschreibung |
|---------|-------------|
| **Viewer-Registrierung** | Selbstregistrierung mit E-Mail-Verifizierung und bcrypt-Passwort-Hashing |
| **Rollen-Login** | Getrennte Logins für Viewer, Jury und Admin |
| **Viewer-Profil** | Eingeloggte Viewer können Profildaten (Name, E-Mail, Telefon, Geburtsdatum, Geschlecht, Land) einsehen, ändern und den Account löschen |
| **Viewer-Voting** | Freie Verteilung von bis zu 20 Punkten auf beliebig viele Sänger (kein eigenes Land) |
| **Jury-Voting** | Klassisches ESC-Schema: einmalige Vergabe von 1–8, 10 und 12 Punkten |
| **Admin-Steuerung** | Voting starten, Ergebnisse freigeben, Status zurücksetzen, alle Votes löschen |
| **Echtzeit-Updates** | Server-Sent Events (SSE) – alle Clients werden sofort über Statusänderungen informiert |
| **Ergebnisberechnung** | Viewer-Rohstimmen werden pro Herkunftsland in ESC-Punkte (12/10/8/…/1) umgerechnet und mit den Jury-Punkten summiert |
| **Doppelte Validierung** | Alle Formulareingaben werden client- und serverseitig geprüft (Format, Länge, DB-Whitelist für Land und Vorwahl) |
| **Auto-Auswahl Landcode↔Vorwahl** | Im Signup- und Profilformular wird bei Wahl eines Landes automatisch die passende Telefonvorwahl gesetzt – und umgekehrt |
| **Rate Limiting** | Login- und Signup-Endpunkte sind gegen Brute-Force geschützt (max. 100 bzw. 60 Versuche pro IP / 5 Minuten) |

---

## Voraussetzungen

| Software | Mindestversion | Windows (winget) | macOS (Homebrew) |
|----------|---------------|-----------------|-----------------|
| **Node.js** | 18.x oder höher | `winget install OpenJS.NodeJS` | `brew install node` |
| **npm** | wird mit Node.js mitgeliefert | – | – |
| **Git** | beliebig | `winget install Git.Git` | `brew install git` |

Außerdem wird ein **Gmail-Konto** mit aktivierter **2-Faktor-Authentifizierung** benötigt, um E-Mail-Verifizierungen versenden zu können (siehe [Umgebungsvariablen](#umgebungsvariablen-env)).

Für den Docker-Betrieb wird zusätzlich benötigt:

| Software | Windows (winget) | macOS (Homebrew) |
|----------|-----------------|-----------------|
| **Docker** | `winget install Docker.DockerDesktop` | `brew install --cask docker` |

---

## Installation

```bash
# 1. Repository klonen
git clone <repository-url>
cd dhbw-esc

# 2. Abhängigkeiten installieren
npm install

# 3. .env-Datei anlegen (siehe nächsten Abschnitt)
```

---

## Umgebungsvariablen (.env)

Im Projektstamm muss eine Datei namens `.env` angelegt werden. Diese Datei wird **nicht** im Repository versioniert und muss lokal erstellt werden.

Vorlage – Datei `.env` im Projektstamm anlegen:

```env
APP_PORT=<zu_öffnender_Port>
BASE_URL=<öffentliche_URL_für_E-Mail-Links>
SESSION_SECRET=<langer_zufaelliger_string_min_32_zeichen>
GMAIL_EMAIL=<deine_gmail_adresse@gmail.com>
GMAIL_APP_PASSWORD=<16_zeichen_google_app_passwort>
CLOUDFLARED_TUNNEL_TOKEN=<cloudflare_tunnel_token>
```

### Beschreibung der Variablen

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `APP_PORT` | ja | Port, auf dem der Express-Server lauscht (Standard ist `3000`) |
| `BASE_URL` | nein | Öffentliche Basis-URL für Links in E-Mails (Verifizierung, Passwort-Reset). Fällt ohne Angabe auf `http://localhost:3000` zurück. Für Production: `https://www.dhbw-esc.de`. |
| `SESSION_SECRET` | ja | Geheimer Schlüssel zum Signieren von Sessions. Muss ein langer, zufälliger String sein (mind. 32 Zeichen). |
| `GMAIL_EMAIL` | ja | Gmail-Adresse, von der die Verifizierungs-E-Mails versendet werden. |
| `GMAIL_APP_PASSWORD` | ja | 16-stelliges Google App-Passwort (kein normales Kontopasswort). |
| `CLOUDFLARED_TUNNEL_TOKEN` | nur für Production | Token des Cloudflare-Tunnels, wird vom `tunnel`-Container in `docker-compose.yml` gelesen (siehe [Cloudflare Tunnel](#cloudflare-tunnel-production)). |

### Gmail App-Passwort erstellen

1. Google-Konto öffnen → **Sicherheit**
2. **2-Faktor-Authentifizierung** aktivieren (falls noch nicht geschehen)
3. Unter Sicherheit → **App-Passwörter** → Neue App hinzufügen
4. Den generierten 16-stelligen Code als `GMAIL_APP_PASSWORD` ohne Leerzeichen eintragen

> **Achtung:** Die `.env`-Datei enthält sensible Zugangsdaten und darf niemals in ein öffentliches Repository eingecheckt werden. Deshalb wird sie von der .gitignore ignoriert.

---

## Starten der Anwendung

```bash
npm start
```

Der Server ist anschließend unter `http://localhost:<APP_PORT>` erreichbar (Standard: `http://localhost:3000`).

Beim Start prüft die Anwendung automatisch, ob alle Umgebungsvariablen gesetzt sind. Fehlt eine Variable, wird der Prozess mit einer Fehlermeldung beendet.

---

## Docker-Deployment

> Wenn Node.js und npm global installiert sind, reicht `npm start` zum Ausführen der Anwendung. Andernfalls kann die App über Docker betrieben werden – einzige Voraussetzung ist dann eine laufende Docker-Installation.

Das Projekt enthält `Dockerfile`, `docker-compose.yml` und `.dockerignore`. Der empfohlene Weg ist **Docker Compose**, da darüber auch der Cloudflare-Tunnel mitgestartet wird.

### Mit Docker Compose (empfohlen)

```bash
# Container bauen und im Hintergrund starten
docker compose up -d --build

# Logs anschauen
docker compose logs -f app
docker compose logs -f tunnel

# Status prüfen
docker compose ps

# Stoppen
docker compose down
```

Nach Code-Änderungen das Image neu bauen:

```bash
docker compose up -d --build
```

Die `.env` im Projektstamm wird automatisch eingelesen – darin müssen alle Pflichtvariablen und (für Production) `CLOUDFLARED_TUNNEL_TOKEN` gesetzt sein.

### Nur das App-Image ohne Compose

```bash
docker build -t dhbw-esc .
docker run -p 3000:3000 --env-file .env dhbw-esc
```

### Hinweise zu den Containern

- Das Dockerfile basiert auf **`node:22-bookworm-slim`** und kompiliert `sqlite3` beim Build aus Source (`--build-from-source=sqlite3`). Der erste Build dauert dadurch 2–3 Minuten; nachfolgende Builds sind durch Layer-Caching deutlich schneller.
- `.dockerignore` schließt das lokale `node_modules/` aus, damit Windows-Binaries den Linux-Container nicht brechen (ELF-/GLIBC-Fehler bei `sqlite3`).
- Der `app`-Container bindet standardmäßig **keinen Port** nach außen, da der Zugriff über den Tunnel erfolgt. Für lokale Tests kann in `docker-compose.yml` temporär `ports: ["3000:3000"]` beim `app`-Service ergänzt werden.

---

## Cloudflare Tunnel (Production)

Für den Produktivbetrieb wird ein [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) verwendet. Der Tunnel-Container baut von innen eine Verbindung zu Cloudflare auf – es ist **kein Port-Forwarding und kein eigenes SSL-Zertifikat** nötig. HTTPS und DNS werden von Cloudflare übernommen.

Produktionsadressen:

- `https://dhbw-esc.de`
- `https://www.dhbw-esc.de`

### Einmalige Einrichtung

1. In Cloudflare Zero Trust → **Networks → Tunnels** einen Tunnel anlegen (Connector-Typ: Cloudflared).
2. Den angezeigten Token kopieren und in die `.env` als `CLOUDFLARED_TUNNEL_TOKEN` eintragen.
3. Unter **Public Hostname** des Tunnels zwei Einträge anlegen:

   | Hostname | Service |
   |----------|---------|
   | `dhbw-esc.de` | `http://app:3000` |
   | `www.dhbw-esc.de` | `http://app:3000` |

   `app` ist dabei der im `docker-compose.yml` definierte Container-Name – Cloudflare kommuniziert über das Docker-Netzwerk intern mit dem App-Container.
4. Cloudflare legt den passenden CNAME im DNS automatisch an (`<tunnel-id>.cfargotunnel.com`). Existierende A-/AAAA-/CNAME-Einträge für denselben Namen müssen vorher entfernt werden.

### Betrieb

```bash
docker compose up -d --build
docker compose logs -f tunnel
```

In den Tunnel-Logs sollten vier `Registered tunnel connection`-Zeilen auftauchen – dann ist der Tunnel aktiv.

### Sicherheit

- Der Tunnel-Token ist ein Geheimnis und liegt ausschließlich in `.env` (nicht versioniert). Gerät er ins Log oder ein Chat, sollte der Tunnel in Cloudflare gelöscht und neu angelegt werden.
- Sessions verwenden weiterhin `secure: false`, da Cloudflare HTTPS terminiert und intern HTTP mit dem Container spricht. Soll `secure: true` aktiviert werden, muss in `app.js` zusätzlich `app.set('trust proxy', 1)` gesetzt werden, damit Express den `X-Forwarded-Proto`-Header respektiert.

---

## Jury- und Admin-Accounts einrichten

Jury- und Admin-Accounts werden **nicht** über die Web-Oberfläche angelegt, sondern direkt in der SQLite-Datenbank (`model/esc-database.db`). Die Passwörter werden dort im Klartext gespeichert.

Beispiel mit dem SQLite-CLI:

```bash
sqlite3 model/esc-database.db
```

```sql
-- Jury-Mitglied hinzufügen
INSERT INTO login_data_jury (jury_mail, password, country)
VALUES ('jury-deutschland@example.com', 'sicheresPasswort', 'Germany');

-- Admin hinzufügen (country muss exakt "Admin" sein)
INSERT INTO login_data_jury (jury_mail, password, country)
VALUES ('admin@example.com', 'sicheresPasswort', 'Admin');
```

Der Login für Jury und Admin erfolgt anschließend über dieselbe Login-Seite wie für Viewer.

> **Hinweis:** Die Datenbank (`esc-database.db`) liegt bereits im Repository und enthält das fertige Schema. Sie wird beim Start **nicht** automatisch neu angelegt – die Datei muss vorhanden sein.

---

## Projektstruktur

```
dhbw-esc/
├── assets/
│   ├── css/                     # Stylesheets (pro Seite + globale Stile)
│   ├── images/
│   │   ├── flags/               # Flaggen-Icons der teilnehmenden Länder
│   │   └── *.png                # Logo und weitere Bilder
│   └── js/                      # Client-seitiges JavaScript (auth, voting, …)
├── controller/
│   ├── app.js                   # Express-Server – Routen, Middleware, API-Endpunkte
│   ├── auth.js                  # Client-JS (per Route ausgeliefert): Session-Check und Weiterleitungslogik
│   ├── cookie.js                # Client-JS: Cookie-Banner-Steuerung
│   ├── login.js                 # Client-JS: Login-Formular
│   ├── signup.js                # Client-JS: Signup-Formular inkl. Dropdown-Befüllung und Auto-Auswahl
│   ├── user.js                  # Client-JS: Profil laden, bearbeiten, Account löschen
│   ├── validate_userdata.js     # Client-JS: Gemeinsame Eingabevalidierung (Signup & Profil)
│   └── voting.js                # Client-JS: Voting-Oberfläche und SSE-Listener
│   (Die JS-Dateien hier werden nicht statisch serviert, sondern über explizite /js/<datei>.js-Routen.)
├── model/
│   ├── authModel.js             # Registrierung, Login, E-Mail-Verifizierung
│   ├── database.js              # Alle SQLite-Datenbankabfragen
│   ├── esc-database.db          # SQLite-Datenbankdatei
│   ├── mailer.js                # E-Mail-Versand via Nodemailer/Gmail
│   └── voteModel.js             # Voting-Logik & Ergebnisberechnung
├── view/
│   ├── dhbw-esc.html            # Startseite
│   ├── login.html               # Login (Viewer & Jury)
│   ├── signup.html              # Registrierung für Viewer
│   ├── voting.html              # Abstimmungsseite (Viewer, Jury & Ergebnisse)
│   ├── user.html                # Viewer-Profilseite (Daten ändern, Account löschen)
│   ├── news/                    # News-Artikel (statische HTML-Seiten)
│   │   ├── vienna-watch-alongs-2026.html
│   │   ├── non-stop-hits-2026.html
│   │   ├── vienna-guide-2026.html
│   │   └── fan-favorites-2026.html
│   └── rechtliches/             # Impressum, Datenschutz, AGB, Cookie-Richtlinie
├── .env                         # Umgebungsvariablen (nicht versioniert)
├── .dockerignore                # Dateien, die nicht ins Docker-Image kopiert werden
├── CLAUDE.md                    # Hinweise für Claude Code
├── agents.md                    # Allgemeines KI-Kontext-Dokument
├── Dockerfile                   # Docker-Konfiguration (App-Container)
├── docker-compose.yml           # Compose-Setup: App + Cloudflare-Tunnel
└── package.json                 # Abhängigkeiten & Skripte
```

---

## Voting-Ablauf

### Rollen

| Rolle | Zugang | Funktion |
|-------|--------|----------|
| **Viewer** | Selbstregistrierung + E-Mail-Verifizierung | Stimmen frei verteilen |
| **Jury** | Fester Login in der Datenbank | ESC-Punkte vergeben |
| **Admin** | Sonderfall des Jury-Logins (`country = "Admin"`) | Voting steuern |

### Ablauf (chronologisch)

1. **Admin startet das Voting** → `POST /api/admin/start-voting`
   - Alle verbundenen Clients werden per SSE sofort informiert.
   - Die Voting-Oberfläche wird für Viewer und Jury freigeschaltet.

2. **Viewer geben ihre Stimmen ab** → `POST /api/vote/viewer`
   - Bis zu **20 Punkte** können frei auf beliebig viele Sänger verteilt werden.
   - Eine Abstimmung für das eigene Heimatland ist gesperrt.
   - Wiederholte Abgabe überschreibt die vorherige.

3. **Jury vergibt ihre Punkte** → `POST /api/vote/jury`
   - Klassisches ESC-Schema: **1, 2, 3, 4, 5, 6, 7, 8, 10, 12** Punkte.
   - Jeder Punktewert und jeder Sänger darf nur einmal verwendet werden.
   - Wiederholte Abgabe überschreibt die vorherige.

4. **Admin gibt die Ergebnisse frei** → `POST /api/admin/show-results`
   - Ab diesem Moment können alle Nutzer die Rangliste einsehen.

### Ergebnisberechnung

Die Gesamtpunktzahl eines Sängers setzt sich zusammen aus:

- **Jury-Punkte:** direkte Summe aller vergebenen ESC-Punkte aller Jury-Länder.
- **Viewer-Punkte:** Die Rohstimmen werden *pro Herkunftsland* nach Höhe sortiert. Das Land mit den meisten Rohstimmen erhält 12 Punkte, Platz 2 erhält 10, dann 8, 7, 6, 5, 4, 3, 2, 1 – analog zum echten ESC-Telefonvoting.

---

## Bekannte Einschränkungen

| Einschränkung | Details |
|---------------|---------|
| **Voting-Status ist flüchtig** | `votingOpen` und `resultsVisible` werden nur im Arbeitsspeicher gehalten. Ein Server-Neustart setzt den Status zurück – laufende Abstimmungen müssen danach neu gestartet werden. |
| **Datenbank muss existieren** | Die SQLite-Datei wird beim Start nicht automatisch angelegt. Die mitgelieferte `model/esc-database.db` muss vorhanden bleiben. |
| **Jury-Passwörter im Klartext** | Passwörter in `login_data_jury` werden nicht gehasht gespeichert – bewusste Vereinfachung für den internen Einsatz. |
| **E-Mail-Links hängen an `BASE_URL`** | Links in Verifizierungs- und Passwort-Reset-Mails werden aus `BASE_URL` gebaut. Ist die Variable nicht gesetzt, zeigen die Links auf `http://localhost:3000` und sind für externe Empfänger nicht erreichbar. |

---

## Routen & API

### Seiten

| Route | Beschreibung |
|-------|-------------|
| `GET /` | Startseite |
| `GET /login` | Login-Seite |
| `GET /signup` | Registrierungsseite |
| `GET /voting` | Abstimmungsseite |
| `GET /impressum` | Impressum |
| `GET /datenschutz` | Datenschutzerklärung |
| `GET /cookie-richtlinie` | Cookie-Richtlinie |
| `GET /agb` | Allgemeine Geschäftsbedingungen |
| `GET /user` | Viewer-Profilseite (nur eingeloggte Viewer) |
| `GET /news/vienna-watch-alongs-2026` | News-Artikel |
| `GET /news/non-stop-hits-2026` | News-Artikel |
| `GET /news/vienna-guide-2026` | News-Artikel |
| `GET /news/fan-favorites-2026` | News-Artikel |

### Auth-API

| Methode | Route | Beschreibung |
|---------|-------|-------------|
| `GET` | `/api/check-session` | Prüft, ob eine aktive Session vorhanden ist |
| `GET` | `/api/countries` | Alle Länder mit Landcode und Vorwahl (für Dropdowns und Whitelist-Validierung) |
| `POST` | `/api/signup` | Neuen Viewer-Account registrieren |
| `GET` | `/api/verify?token=<token>` | E-Mail-Adresse verifizieren und Account freischalten |
| `POST` | `/api/login` | Einloggen (Viewer, Jury oder Admin) |
| `POST` | `/api/logout` | Session beenden und ausloggen |

### User-API

Alle User-Endpunkte erfordern eine aktive Viewer-Session.

| Methode | Route | Beschreibung |
|---------|-------|-------------|
| `GET` | `/api/user/profile` | Viewer-Profil laden |
| `POST` | `/api/user/update` | Viewer-Profil aktualisieren (inkl. optionalem Passwort-Wechsel) |
| `DELETE` | `/api/user/delete` | Viewer-Account und alle zugehörigen Votes löschen |

### Voting-API

| Methode | Route | Beschreibung | Zugriff |
|---------|-------|-------------|---------|
| `GET` | `/api/singers` | Alle Sänger inkl. Länderdaten laden | öffentlich |
| `GET` | `/api/events` | SSE-Stream für Echtzeit-Statusupdates | öffentlich |
| `GET` | `/api/admin/state` | Aktuellen Voting-Status abfragen | öffentlich |
| `POST` | `/api/vote/viewer` | Viewer-Stimmen abgeben | Viewer (eingeloggt) |
| `POST` | `/api/vote/jury` | Jury-Punkte abgeben | Jury (eingeloggt) |
| `GET` | `/api/results` | Ergebnisse abrufen | Admin immer, sonst nur nach Freigabe |

### Admin-API

Alle Admin-Endpunkte erfordern eine aktive Session mit `role = "admin"`.

| Methode | Route | Beschreibung |
|---------|-------|-------------|
| `POST` | `/api/admin/start-voting` | Voting starten (alle Clients per SSE benachrichtigen) |
| `POST` | `/api/admin/show-results` | Ergebnisse für alle freigeben |
| `POST` | `/api/admin/reset-state` | Voting-Status zurücksetzen (`votingOpen` + `resultsVisible` → false) |
| `POST` | `/api/admin/clear-votes` | Alle abgegebenen Stimmen aus der Datenbank löschen |

---

## Verwendete Technologien

| Paket | Zweck |
|-------|-------|
| [Express](https://expressjs.com) | Web-Framework |
| [express-session](https://github.com/expressjs/session) | Session-Management |
| [sqlite3](https://github.com/TryGhost/node-sqlite3) | Datenbank |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Passwort-Hashing |
| [nodemailer](https://nodemailer.com) | E-Mail-Versand |
| [dotenv](https://github.com/motdotla/dotenv) | Umgebungsvariablen |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | Rate Limiting auf Login- und Signup-Endpunkten |
| SSE (native) | Echtzeit-Push vom Server an alle Clients |
