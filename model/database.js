import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { styleText } from "node:util";

const dbPath = path.resolve(process.env.DB_PATH);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "schema.sql");

// Falls die DB-Datei fehlt: aus schema.sql neu anlegen
const dbExisted = fs.existsSync(dbPath);
if (!dbExisted) {
  console.log(styleText("blue", `Keine DB unter ${dbPath} gefunden – wird aus schema.sql neu angelegt.`));
}

// Verbindung zur Datenbank herstellen (CREATE, falls noch nicht vorhanden)
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error(styleText("red","Fehler bei der Verbindung zur SQLite-Datenbank: " + err.message));
  } else {
    if (!dbExisted) {
      try {
        const schemaSql = fs.readFileSync(schemaPath, "utf8");
        // sqlite3's Database#exec führt mehrere Statements hintereinander aus
        const runSchema = db["exec"].bind(db);
        runSchema(schemaSql, (initErr) => {
          if (initErr) console.error(styleText("red", "Fehler beim Initialisieren aus schema.sql: " + initErr.message));
          else console.log(styleText("green", "Neue SQLite-Datenbank erfolgreich aus schema.sql initialisiert."));
        });
      } catch (e) {
        console.error(styleText("red", "schema.sql konnte nicht gelesen werden: " + e.message));
      }
    } else {
      console.log(styleText("green","Stabile SQLite-Verbindung zur existierenden esc-database.db hergestellt!"));
    }
    // Idempotente Migration: Spalten für Passwort-Reset anlegen, falls noch nicht vorhanden
    db.all(`PRAGMA table_info(login_data_user)`, [], (pragmaErr, columns) => {
      if (pragmaErr) {
        console.error(styleText("red", "Fehler bei PRAGMA table_info: " + pragmaErr.message));
        return;
      }
      const columnNames = columns.map((c) => c.name);
      if (!columnNames.includes("reset_token")) {
        db.run(`ALTER TABLE login_data_user ADD COLUMN reset_token TEXT`, (e) => {
          if (e) console.error(styleText("red", "Fehler beim Hinzufügen von reset_token: " + e.message));
          else console.log(styleText("green", "Spalte reset_token zu login_data_user hinzugefügt."));
        });
      }
      if (!columnNames.includes("reset_token_expiry")) {
        db.run(`ALTER TABLE login_data_user ADD COLUMN reset_token_expiry INTEGER`, (e) => {
          if (e) console.error(styleText("red", "Fehler beim Hinzufügen von reset_token_expiry: " + e.message));
          else console.log(styleText("green", "Spalte reset_token_expiry zu login_data_user hinzugefügt."));
        });
      }
    });

    // Idempotente Migration: login_data_jury.country von Ländername auf country.id (INTEGER) umstellen
    // Admin hat keinen country-Eintrag und bekommt country = 0
    db.all(`PRAGMA table_info(login_data_jury)`, [], (pragmaErr, columns) => {
      if (pragmaErr) return;
      const countryCol = columns.find(c => c.name === "country");
      if (countryCol && countryCol.type === "TEXT") {
        db.serialize(() => {
          db.run(`CREATE TABLE IF NOT EXISTS login_data_jury_new (
            country   INTEGER NOT NULL PRIMARY KEY,
            jury_mail VARCHAR(255),
            password  VARCHAR(255)
          )`, (e) => { if (e) console.error(styleText("red", "Migration jury (CREATE): " + e.message)); });

          db.run(`INSERT INTO login_data_jury_new (country, jury_mail, password)
            SELECT COALESCE((SELECT id FROM country WHERE country.country = login_data_jury.country), 0),
                   jury_mail, password
            FROM login_data_jury`, (e) => { if (e) console.error(styleText("red", "Migration jury (INSERT): " + e.message)); });

          db.run(`DROP TABLE login_data_jury`, (e) => { if (e) console.error(styleText("red", "Migration jury (DROP): " + e.message)); });

          db.run(`ALTER TABLE login_data_jury_new RENAME TO login_data_jury`, (e) => {
            if (e) console.error(styleText("red", "Migration jury (RENAME): " + e.message));
            else console.log(styleText("green", "Migration login_data_jury.country → INTEGER abgeschlossen."));
          });
        });
      }
    });
  }
});


// Query für: Jury-Login
export const getJuryUser = (email, password) => {
    return new Promise((resolve, reject) => {
        console.log(styleText("blue", `DB-Abfrage für Jury-Login gestartet: E-Mail = ${email}`));

        const query = `
            SELECT CASE WHEN j.country = 0 THEN 'Admin' ELSE c.country END AS country
            FROM login_data_jury j
            LEFT JOIN country c ON c.id = j.country
            WHERE j.jury_mail = ? AND j.password = ?`;

        db.get(query, [email, password], (err, row) => {
            if (err) {
                console.error(styleText("red", "DB-Fehler beim Login-Select: " + err.message));
                reject(err);
            } else {
                if (row) {
                    console.log(styleText("green", `Match in DB gefunden! Land: ${row.country}`));
                } else {
                    console.log(styleText("red", `Keine Übereinstimmung in DB für: ${email}`));
                }
                resolve(row);
            }
        });
    });
};

// Query für: Viewer-Login (Suche nach E-Mail und Passwort-Hash)
export const getViewerByEmailForLogin = (email) => {
    return new Promise((resolve, reject) => {
        console.log(styleText("blue", `DB-Abfrage für Viewer-Login (Suche nach Hash): ${email}`));
        const query = `SELECT id, first_name, last_name, email, country_code, password, is_verified FROM login_data_user WHERE email = ?`;
        db.get(query, [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Query für: Neuer Viewer-User anlegen
export const createViewerUser = (userData, hashedPassword, verifyToken) => {
    return new Promise((resolve, reject) => {
        // is_verified fix auf 0
        const query = `
            INSERT INTO login_data_user
            (first_name, last_name, email, phone_prefix, phone_number, birth_date, gender, country_code, password, is_over_18, accepted_terms, is_verified, verify_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `;
        const params = [
            userData.firstName, userData.lastName, userData.email, userData.phonePrefix, userData.phoneNumber,
            userData.birthDate, userData.gender, userData.countryCode,
            hashedPassword, // Gehashtes Passwort
            userData.isOver18 ? 1 : 0, userData.acceptedTerms ? 1 : 0,
            verifyToken     // Der E-Mail Token
        ];

        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

// NEU: User über Token suchen
export const getViewerByToken = (token) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT id, email FROM login_data_user WHERE verify_token = ?`;
        db.get(query, [token], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// NEU: Account aktivieren
export const verifyViewerAccount = (userId) => {
    return new Promise((resolve, reject) => {
        const query = `UPDATE login_data_user SET is_verified = 1, verify_token = NULL WHERE id = ?`;
        db.run(query, [userId], function(err) {
            if (err) reject(err);
            else resolve(true);
        });
    });
};

// Query: Viewer-Profil anhand ID laden
export const getViewerById = (id) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT id, first_name, last_name, email, phone_prefix, phone_number, birth_date, gender, country_code FROM login_data_user WHERE id = ?`;
        db.get(query, [id], (err, row) => {
            if (err) reject(err); else resolve(row);
        });
    });
};

// Query: Viewer-Profil aktualisieren (mit oder ohne neues Passwort)
export const updateViewerUser = (id, data, hashedPassword) => {
    return new Promise((resolve, reject) => {
        let query, params;
        if (hashedPassword) {
            query = `UPDATE login_data_user SET first_name=?, last_name=?, email=?, phone_prefix=?, phone_number=?, birth_date=?, gender=?, country_code=?, password=? WHERE id=?`;
            params = [data.firstName, data.lastName, data.email, data.phonePrefix || null, data.phoneNumber || null, data.birthDate || null, data.gender || null, data.countryCode, hashedPassword, id];
        } else {
            query = `UPDATE login_data_user SET first_name=?, last_name=?, email=?, phone_prefix=?, phone_number=?, birth_date=?, gender=?, country_code=? WHERE id=?`;
            params = [data.firstName, data.lastName, data.email, data.phonePrefix || null, data.phoneNumber || null, data.birthDate || null, data.gender || null, data.countryCode, id];
        }
        db.run(query, params, function(err) {
            if (err) reject(err); else resolve(this.changes);
        });
    });
};

// Query: Alle Sänger inkl. Länderdaten (für Voting- und Results-Tab)
export const getAllSingers = () => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT
                s.id          AS singer_id,
                s.singer_name AS singer_name,
                s.song_name   AS song_name,
                c.id          AS country_id,
                c.country     AS country,
                c.landcode    AS landcode,
                c.land_bild   AS land_bild
            FROM singer s
            JOIN country c ON s.country_id = c.id
            ORDER BY c.country ASC
        `;
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error(styleText("red", "DB-Fehler bei getAllSingers: " + err.message));
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
};

// Query: Alle Viewer-Votes eines Users löschen (Überschreiben bei erneuter Abgabe)
export const deleteViewerVotes = (viewerId) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM vote_user WHERE viewer_id = ?`, [viewerId], function (err) {
            if (err) reject(err); else resolve(this.changes);
        });
    });
};

// Query: Einen Viewer-Vote einfügen
export const insertViewerVote = (viewerId, singerId, points) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO vote_user (viewer_id, singer_id, points) VALUES (?, ?, ?)`,
            [viewerId, singerId, points],
            function (err) { if (err) reject(err); else resolve(this.lastID); }
        );
    });
};

// Query: Alle Jury-Votes eines Jury-Landes löschen
export const deleteJuryVotes = (juryCountry) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM vote_jury WHERE jury_country = ?`, [juryCountry], function (err) {
            if (err) reject(err); else resolve(this.changes);
        });
    });
};

// Query: Einen Jury-Vote einfügen
export const insertJuryVote = (juryCountry, singerId, points) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO vote_jury (jury_country, singer_id, points) VALUES (?, ?, ?)`,
            [juryCountry, singerId, points],
            function (err) { if (err) reject(err); else resolve(this.lastID); }
        );
    });
};

// Query: Alle Votes eines Viewers (pro Sänger aufsummiert) – für eigenen Status
export const getViewerVotesByUser = (viewerId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT singer_id, SUM(points) AS points
            FROM vote_user
            WHERE viewer_id = ?
            GROUP BY singer_id
        `;
        db.all(query, [viewerId], (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
        });
    });
};

// Query: Hat eine Jury (für dieses Land) bereits abgestimmt?
export const hasJuryVoted = (juryCountry) => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT 1 AS x FROM vote_jury WHERE jury_country = ? LIMIT 1`, [juryCountry], (err, row) => {
            if (err) reject(err); else resolve(!!row);
        });
    });
};

// Query: Viewer-Rohpunkte pro Herkunftsland und Sänger
// (für anschließende Umrechnung in ESC-Punkte pro Land analog zum echten Telefonvoting)
export const getViewerPointsPerCountryAndSinger = () => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT u.country_code AS country_code,
                   v.singer_id    AS singer_id,
                   SUM(v.points)  AS points
            FROM vote_user v
            JOIN login_data_user u ON v.viewer_id = u.id
            GROUP BY u.country_code, v.singer_id
        `;
        db.all(query, [], (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
        });
    });
};

// Query: Alle Votes löschen (Viewer + Jury)
export const deleteAllVotes = () => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM vote_user`, [], (err) => {
            if (err) return reject(err);
            db.run(`DELETE FROM vote_jury`, [], (err2) => {
                if (err2) reject(err2); else resolve(true);
            });
        });
    });
};

// Query: Viewer-Account und zugehörige Votes löschen
export const deleteViewerUser = (id) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM vote_user WHERE viewer_id = ?`, [id], (err) => {
            if (err) return reject(err);
            db.run(`DELETE FROM login_data_user WHERE id = ?`, [id], function (err2) {
                if (err2) reject(err2); else resolve(this.changes);
            });
        });
    });
};

// Query: Nur Länder die in login_data_jury vorkommen (exkl. Admin), mit Landcode und Vorwahl
export const getAllCountries = () => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT c.id, c.landcode, c.country, c.vorwahl
            FROM country c
            INNER JOIN login_data_jury j ON j.country = c.id
            ORDER BY c.country ASC
        `, [], (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
        });
    });
};

// Query: Prüfen ob ein Landcode in der DB existiert
export const countryCodeExists = (landcode) => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id FROM country WHERE landcode = ?`, [landcode], (err, row) => {
            if (err) reject(err); else resolve(!!row);
        });
    });
};

// Query: Prüfen ob eine Vorwahl in der DB existiert
export const vorwahlExists = (vorwahl) => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id FROM country WHERE vorwahl = ?`, [vorwahl], (err, row) => {
            if (err) reject(err); else resolve(!!row);
        });
    });
};

// Query: Reset-Token für einen Viewer (per E-Mail) setzen, inkl. Ablaufzeit (Unix-ms)
export const setResetToken = (email, token, expiry) => {
    return new Promise((resolve, reject) => {
        const query = `UPDATE login_data_user SET reset_token = ?, reset_token_expiry = ? WHERE email = ? AND is_verified = 1`;
        db.run(query, [token, expiry, email], function (err) {
            if (err) reject(err); else resolve(this.changes);
        });
    });
};

// Query: Viewer über Reset-Token finden (inkl. Ablaufdatum, Plausibilität prüft der Aufrufer)
export const getViewerByResetToken = (token) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT id, email, first_name, reset_token_expiry FROM login_data_user WHERE reset_token = ?`;
        db.get(query, [token], (err, row) => {
            if (err) reject(err); else resolve(row);
        });
    });
};

// Query: Passwort setzen und Reset-Token invalidieren (atomar pro Statement)
export const updatePasswordAndClearResetToken = (id, hashedPassword) => {
    return new Promise((resolve, reject) => {
        const query = `UPDATE login_data_user SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?`;
        db.run(query, [hashedPassword, id], function (err) {
            if (err) reject(err); else resolve(this.changes);
        });
    });
};

// Query: Jury-Punkte-Summen pro Sänger (alle Jury-Länder zusammen)
export const getJuryPointsPerSinger = () => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT singer_id, SUM(points) AS jury_points
            FROM vote_jury
            GROUP BY singer_id
        `;
        db.all(query, [], (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
        });
    });
};
