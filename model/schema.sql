-- Schema für die ESC-Voting-Datenbank (SQLite)
-- Wird von model/database.js automatisch ausgeführt, wenn die DB-Datei fehlt.

-- Länder (inkl. Flaggen-Pfad und Telefon-Vorwahl)
CREATE TABLE IF NOT EXISTS country (
    id        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    country   TEXT    NOT NULL,
    landcode  TEXT,
    land_bild TEXT,
    vorwahl   TEXT,
    UNIQUE (id)
);

-- Jury- und Admin-Login (country = 0 bedeutet Admin)
CREATE TABLE IF NOT EXISTS login_data_jury (
    country   INTEGER      NOT NULL PRIMARY KEY,
    jury_mail VARCHAR(255),
    password  VARCHAR(255)
);

-- Viewer-Accounts (Selbstregistrierung)
CREATE TABLE IF NOT EXISTS login_data_user (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name         TEXT    NOT NULL,
    last_name          TEXT    NOT NULL,
    email              TEXT    NOT NULL UNIQUE,
    phone_prefix       TEXT,
    phone_number       TEXT,
    birth_date         TEXT,
    gender             TEXT,
    country_code       TEXT    NOT NULL,
    password           TEXT    NOT NULL,
    is_over_18         INTEGER NOT NULL,
    accepted_terms     INTEGER NOT NULL,
    created_at         TEXT    DEFAULT (datetime('now')),
    updated_at         TEXT,
    is_verified        INTEGER DEFAULT 0,
    verify_token       TEXT,
    reset_token        TEXT,
    reset_token_expiry INTEGER
);

-- Teilnehmende Sänger (ein Eintrag pro Land)
CREATE TABLE IF NOT EXISTS singer (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id  INTEGER NOT NULL UNIQUE,
    singer_name TEXT    NOT NULL,
    song_name   TEXT    NOT NULL,
    FOREIGN KEY (country_id) REFERENCES country(id)
);

-- Jury-Votes (pro Land genau 10 Punkte-Vergaben)
CREATE TABLE IF NOT EXISTS vote_jury (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    jury_country TEXT    NOT NULL,
    singer_id    INTEGER NOT NULL,
    points       INTEGER NOT NULL CHECK (points IN (1,2,3,4,5,6,7,8,10,12)),
    created_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (jury_country, singer_id),
    UNIQUE (jury_country, points),
    FOREIGN KEY (singer_id) REFERENCES singer(id)
);

-- Viewer-Votes
CREATE TABLE IF NOT EXISTS vote_user (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    viewer_id  INTEGER NOT NULL,
    singer_id  INTEGER NOT NULL,
    points     INTEGER NOT NULL CHECK (points >= 0 AND points <= 20),
    created_at TEXT    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (viewer_id, singer_id),
    FOREIGN KEY (viewer_id) REFERENCES login_data_user(id),
    FOREIGN KEY (singer_id) REFERENCES singer(id)
);

-- Seed: Länder
INSERT INTO country (id, country, landcode, land_bild, vorwahl) VALUES
    (11, 'Deutschland',            'DE',  '/assets/images/flags/de.png', '+49'),
    (12, 'Frankreich',              'FR',  '/assets/images/flags/fr.png', '+33'),
    (13, 'Italien',                 'IT',  '/assets/images/flags/it.png', '+39'),
    (16, 'Schweden',                'SE',  '/assets/images/flags/se.png', '+46'),
    (17, 'Vereinigtes Königreich',  'UK',  '/assets/images/flags/uk.png', '+44'),
    (18, 'Norwegen',                'NO',  '/assets/images/flags/no.png', '+47'),
    (19, 'Portugal',                'PT',  '/assets/images/flags/pt.png', '+351'),
    (21, 'Österreich',              'AT',  '/assets/images/flags/at.png', '+43'),
    (22, 'Griechenland',            'GR',  '/assets/images/flags/gr.png', '+30'),
    (38, 'Zypern',                  'CY',  '/assets/images/flags/cy.jpg', '+357'),
    (39, 'Ukraine',                 'UA',  '/assets/images/flags/ua.jpg', '+380'),
    (40, 'Tschechien',              'CZ',  '/assets/images/flags/cz.jpg', '+420'),
    (41, 'Serbien',                 'RS',  '/assets/images/flags/rs.jpg', '+381'),
    (42, 'Schweiz',                 'CH',  '/assets/images/flags/ch.jpg', '+41'),
    (43, 'San Marino',              'SM',  '/assets/images/flags/sm.jpg', '+378'),
    (44, 'Rumänien',                'RO',  '/assets/images/flags/ro.jpg', '+40'),
    (45, 'Polen',                   'PL',  '/assets/images/flags/pl.jpg', '+48'),
    (46, 'Montenegro',              'ME',  '/assets/images/flags/me.jpg', '+382'),
    (47, 'Moldau',                  'MD',  '/assets/images/flags/md.png', '+373'),
    (48, 'Malta',                   'MT',  '/assets/images/flags/mt.jpg', '+356'),
    (49, 'Luxemburg',               'LU',  '/assets/images/flags/lu.jpg', '+352'),
    (50, 'Litauen',                 'LT',  '/assets/images/flags/lt.jpg', '+370'),
    (51, 'Lettland',                'LV',  '/assets/images/flags/lv.jpg', '+371'),
    (52, 'Kroatien',                'HR',  '/assets/images/flags/hr.jpg', '+385'),
    (53, 'Israel',                  'IL',  '/assets/images/flags/il.jpg', '+972'),
    (54, 'Georgien',                'GE',  '/assets/images/flags/ge.jpg', '+995'),
    (55, 'Finnland',                'FI',  '/assets/images/flags/fi.jpg', '+358'),
    (56, 'Estland',                 'EE',  '/assets/images/flags/ee.png', '+372'),
    (57, 'Dänemark',                'DK',  '/assets/images/flags/dk.jpg', '+45'),
    (58, 'Bulgarien',               'BG',  '/assets/images/flags/bg.jpg', '+359'),
    (59, 'Belgien',                 'BE',  '/assets/images/flags/be.jpg', '+32'),
    (60, 'Australien',              'AU',  '/assets/images/flags/au.jpg', '+61'),
    (61, 'Aserbaidschan',           'AZ',  '/assets/images/flags/az.jpg', '+994'),
    (62, 'Armenien',                'AM',  '/assets/images/flags/am.jpg', '+374'),
    (63, 'Albanien',                'AL',  '/assets/images/flags/al.jpg', '+355');

-- Seed: Sänger
INSERT INTO singer (id, country_id, singer_name, song_name) VALUES
    (1,  11, 'Tommy Neunziger',            'Schnurr für Deutschland'),
    (2,  12, 'Édith Miauf',                'Je ne regrette purr'),
    (3,  13, 'Signor Micio Bellavita',     'Miao, Amore Mio'),
    (6,  16, 'Purreen',                    'Scratch-Tattoo'),
    (7,  17, 'Sir Whiskers',               'Tea and Tuna'),
    (8,  18, 'Alexander Katzbak',          'Fairytale (of a Full Bowl)'),
    (9,  19, 'Salvador Schnurral',         'Amar pelos dois (Liebe für zwei Näpfe)'),
    (11, 21, 'Kätzchen Mozart',            'Meow bei Nacht'),
    (12, 22, 'Ailuros Olympia',            'Opa, Katze!'),
    (13, 38, 'Aphrodite Pawlos',           'Ela'),
    (14, 39, 'Kitten Zelenska',            'Stefania'),
    (15, 40, 'Kocour Praha',               'Zlatá Pracka'),
    (16, 41, 'Maca Beogradska',            'Volim te Mjauu'),
    (17, 42, 'Chätzli Helvetia',           'Röschti & Ronron'),
    (18, 43, 'Gatto Titano',               'Sotto il Monte Titano'),
    (19, 44, 'Pisici din Transilvania',    'Dracula''s Purr'),
    (20, 45, 'Kocur Warszawski',           'Polska Kocurada'),
    (21, 46, 'Mačak Lovćen',               'Na Vrh Vrha'),
    (22, 47, 'Pisica Chișinău',            'Dragostea din Blană'),
    (23, 48, 'Bella Pawrapa',              'Fuq il-Baħar'),
    (24, 49, 'Félix de Luxembourg',        'Le Grand Chat du Nord'),
    (25, 50, 'Katinas Kazlauskas',         'Saulutė ir Kailis'),
    (26, 51, 'Kaķis Baumanis',             'Priecīgs Kaķis'),
    (27, 52, 'Mačak Bauk',                 'Marija Bistrica Meow'),
    (28, 53, 'Neta Pawrovich',             'Toy (Just a Whisker)'),
    (29, 54, 'Tbilisi Meowveli',           'Mravaljameow'),
    (30, 55, 'Kissa Metalhead',            'Purr Hard or Go Home'),
    (31, 56, 'Miisu Tamm',                 'Talvine Kass'),
    (32, 57, 'Lars Pawsen',                'Hygge med Halen'),
    (33, 58, 'Kotka Plovdiva',             'Roses and Whiskers'),
    (34, 59, 'Jacques le Félin',           'Chocolat & Ronron'),
    (35, 60, 'Whisker Downunder',          'G''Day, Let Me Purr'),
    (36, 61, 'Kəklik Pawt',                'Baku Purrfection'),
    (37, 62, 'Purryan Mirzoyan',           'Meow Along the Ararat'),
    (38, 63, 'Mjaush Kelmendi',            'Kënga e Macës');

-- Test-Admin (Passwort im Klartext, siehe CLAUDE.md – bitte nach dem ersten Login ändern)
INSERT INTO login_data_jury (country, jury_mail, password) VALUES
    (0, 'admin@dhbw-esc.de.com', 'MyAdminPassword!');

-- Jury-Accounts (Passwort im Klartext, siehe CLAUDE.md – Platzhalter, bitte ändern)
-- Schema: jury.<landcode>@dhbw-esc.de / Jury<LANDCODE>_2026!
INSERT INTO login_data_jury (country, jury_mail, password) VALUES
    (11, 'jury.de@dhbw-esc.de', 'JuryDE_2026!'),
    (12, 'jury.fr@dhbw-esc.de', 'JuryFR_2026!'),
    (13, 'jury.it@dhbw-esc.de', 'JuryIT_2026!'),
    (17, 'jury.uk@dhbw-esc.de', 'JuryUK_2026!'),
    (21, 'jury.at@dhbw-esc.de', 'JuryAT_2026!'),
    (60, 'jury.au@dhbw-esc.de', 'JuryAU_2026!');
