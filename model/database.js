import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { styleText } from "node:util";

//Verzeichnispfade der E-Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "esc-database.db");

// Verbindung zur Datenbank herstellen
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(styleText("red","Fehler bei der Verbindung zur SQLite-Datenbank: " + err.message));
  } else {
    console.log(styleText("green","Stabile SQLite-Verbindung zur existierenden esc-database.db hergestellt!"));
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
  }
});


// Query für: Jury-Login
export const getJuryUser = (email, password) => {
    return new Promise((resolve, reject) => {
        console.log(styleText("blue", `DB-Abfrage für Jury-Login gestartet: E-Mail = ${email}`));

        const query = `SELECT country FROM login_data_jury WHERE jury_mail = ? AND password = ?`;

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

// Query: Viewer-Punkte-Summen pro Sänger (alle Viewer zusammen)
export const getViewerPointsPerSinger = () => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT singer_id, SUM(points) AS viewer_points
            FROM vote_user
            GROUP BY singer_id
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

// Query: Alle Länder mit Landcode und Vorwahl (für Dropdown-Befüllung und Validierung)
export const getAllCountries = () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, landcode, country, vorwahl FROM country ORDER BY country ASC`, [], (err, rows) => {
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
