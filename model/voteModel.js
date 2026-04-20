import { styleText } from "node:util";
import {
    getAllSingers,
    insertViewerVote,
    getViewerVotesByUser,
    deleteJuryVotes,
    insertJuryVote,
    hasJuryVoted,
    getViewerPointsPerCountryAndSinger,
    getJuryPointsPerSinger,
    deleteAllVotes,
} from "./database.js";

// Viewer: frei verteilbares Budget, kumulativ über mehrere Abgaben
const MAX_VIEWER_POINTS_TOTAL = 10;

// Jury: klassisches ESC-Punkteschema (1-8, 10, 12, jeder Wert nur einmal)
const ALLOWED_JURY_POINTS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 12]);
const ESC_RANKS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];

// Alle Sänger inkl. Länderdaten für Voting-/Results-Tab holen
export const fetchAllSingers = async () => {
    try {
        return await getAllSingers();
    } catch (err) {
        console.error(styleText("red", "Fehler in fetchAllSingers: " + err.message));
        throw err;
    }
};

// Eigenen Viewer-Status holen (bereits vergebene Punkte pro Sänger + Gesamtsumme)
export const getViewerStatus = async (viewerId) => {
    const rows = await getViewerVotesByUser(viewerId);
    const votes = rows.map(r => ({ singerId: r.singer_id, points: r.points || 0 }));
    const total = votes.reduce((s, v) => s + v.points, 0);
    return { votes, total, max: MAX_VIEWER_POINTS_TOTAL };
};

// Prüfen ob die Jury dieses Landes schon abgestimmt hat
export const getJuryStatus = async (juryCountry) => {
    if (!juryCountry) return { hasVoted: false };
    return { hasVoted: await hasJuryVoted(juryCountry) };
};

// Viewer-Votes speichern: kumulativ – bestehende Abgabe bleibt, neue Punkte werden addiert
export const submitViewerVotes = async (viewerId, viewerLandcode, rawVotes) => {
    try {
        if (!Array.isArray(rawVotes)) {
            return { success: false, message: "Ungültige Vote-Daten." };
        }

        const singers = await getAllSingers();
        const ownSingerIds = new Set(
            viewerLandcode
                ? singers
                      .filter(s => (s.landcode || "").toUpperCase() === viewerLandcode.toUpperCase())
                      .map(s => s.singer_id)
                : []
        );

        // Eingaben validieren und aggregieren
        const cleaned = [];
        const seen = new Set();
        let addedTotal = 0;
        for (const v of rawVotes) {
            const singerId = Number(v.singerId);
            const points = Number(v.points);
            if (!Number.isInteger(singerId) || !Number.isInteger(points)) {
                return { success: false, message: "Ungültige Vote-Daten." };
            }
            if (points < 0 || points > MAX_VIEWER_POINTS_TOTAL) {
                return { success: false, message: `Stimmen pro Sänger müssen zwischen 0 und ${MAX_VIEWER_POINTS_TOTAL} liegen.` };
            }
            if (seen.has(singerId)) {
                return { success: false, message: "Ein Sänger darf nur einmal in der Abgabe vorkommen." };
            }
            if (ownSingerIds.has(singerId) && points > 0) {
                return { success: false, message: "Du kannst nicht für dein eigenes Land abstimmen." };
            }
            seen.add(singerId);
            if (points > 0) {
                addedTotal += points;
                cleaned.push({ singerId, points });
            }
        }

        if (addedTotal === 0) {
            return { success: false, message: "Bitte verteile mindestens eine Stimme." };
        }

        // Budget prüfen (Bereits-vergeben + Neu dürfen Max nicht überschreiten)
        const existing = await getViewerVotesByUser(viewerId);
        const existingTotal = existing.reduce((s, r) => s + (r.points || 0), 0);
        if (existingTotal + addedTotal > MAX_VIEWER_POINTS_TOTAL) {
            const remaining = MAX_VIEWER_POINTS_TOTAL - existingTotal;
            return { success: false, message: `Nur noch ${remaining} Stimme(n) verfügbar.` };
        }

        for (const v of cleaned) {
            await insertViewerVote(viewerId, v.singerId, v.points);
        }

        console.log(styleText("green", `Viewer ${viewerId} hat ${addedTotal} zusätzliche Stimmen vergeben (gesamt: ${existingTotal + addedTotal}/${MAX_VIEWER_POINTS_TOTAL}).`));
        return { success: true, status: await getViewerStatus(viewerId) };
    } catch (err) {
        console.error(styleText("red", "Fehler in submitViewerVotes: " + err.message));
        return { success: false, message: "Interner Serverfehler beim Speichern der Stimmen." };
    }
};

// Jury-Votes speichern: einmalige Abgabe, danach gesperrt
export const submitJuryVotes = async (juryCountry, rawVotes) => {
    try {
        if (!juryCountry) {
            return { success: false, message: "Kein Jury-Land in der Session." };
        }

        if (await hasJuryVoted(juryCountry)) {
            return { success: false, message: "Du hast bereits abgestimmt und kannst deine Stimmen nicht mehr ändern." };
        }

        if (!Array.isArray(rawVotes)) {
            return { success: false, message: "Ungültige Vote-Daten." };
        }

        const cleaned = [];
        const usedPoints = new Set();
        const usedSingers = new Set();
        for (const v of rawVotes) {
            const singerId = Number(v.singerId);
            const points = Number(v.points);
            if (!Number.isInteger(singerId) || !Number.isInteger(points)) {
                return { success: false, message: "Ungültige Vote-Daten." };
            }
            if (!ALLOWED_JURY_POINTS.has(points)) {
                return { success: false, message: "Ungültige Punktzahl. Erlaubt: 1–8, 10, 12." };
            }
            if (usedPoints.has(points)) {
                return { success: false, message: `Punktewert ${points} wurde doppelt vergeben.` };
            }
            if (usedSingers.has(singerId)) {
                return { success: false, message: "Ein Sänger darf nur einmal bewertet werden." };
            }
            usedPoints.add(points);
            usedSingers.add(singerId);
            cleaned.push({ singerId, points });
        }
        if (cleaned.length !== ALLOWED_JURY_POINTS.size) {
            return { success: false, message: `Bitte alle ${ALLOWED_JURY_POINTS.size} Punktewerte (1-8, 10, 12) vergeben.` };
        }

        // Eigenes Land sperren
        const singers = await getAllSingers();
        const ownSingerIds = new Set(
            singers.filter(s => s.country === juryCountry).map(s => s.singer_id)
        );
        for (const v of cleaned) {
            if (ownSingerIds.has(v.singerId)) {
                return { success: false, message: "Du kannst nicht für dein eigenes Land abstimmen." };
            }
        }

        // Sicherheitshalber altes (theoretisch leeres) Set entfernen, dann einfügen
        await deleteJuryVotes(juryCountry);
        for (const v of cleaned) {
            await insertJuryVote(juryCountry, v.singerId, v.points);
        }

        console.log(styleText("green", `Jury "${juryCountry}" hat ${cleaned.length} Bewertungen gespeichert (endgültig).`));
        return { success: true, status: { hasVoted: true } };
    } catch (err) {
        console.error(styleText("red", "Fehler in submitJuryVotes: " + err.message));
        return { success: false, message: "Interner Serverfehler beim Speichern der Stimmen." };
    }
};

// Alle Votes löschen (Admin-Befehl)
export const clearAllVotes = async () => {
    try {
        await deleteAllVotes();
        console.log(styleText("green", "Alle Votes wurden vom Admin gelöscht."));
        return { success: true };
    } catch (err) {
        console.error(styleText("red", "Fehler in clearAllVotes: " + err.message));
        return { success: false, message: "Fehler beim Löschen der Votes." };
    }
};

// Finale Punkte pro Sänger:
// - Jury-Punkte: direkte Summe aller ESC-Punkte aller Jury-Länder
// - Viewer-Punkte: Rohstimmen werden pro Herkunftsland pro Sänger aufsummiert,
//   dann pro Land nach Höhe sortiert und in ESC-Punkte (12/10/8/7/6/5/4/3/2/1)
//   umgerechnet – analog zum echten ESC-Telefonvoting.
export const calculateResults = async () => {
    try {
        const [singers, juryRows, viewerRows] = await Promise.all([
            getAllSingers(),
            getJuryPointsPerSinger(),
            getViewerPointsPerCountryAndSinger(),
        ]);

        const juryMap = new Map(juryRows.map(r => [r.singer_id, r.jury_points || 0]));

        // Rohstimmen nach Herkunftsland gruppieren
        const byCountry = new Map();
        for (const r of viewerRows) {
            if (!byCountry.has(r.country_code)) byCountry.set(r.country_code, []);
            byCountry.get(r.country_code).push({ singerId: r.singer_id, points: r.points || 0 });
        }

        // Pro Herkunftsland: Sänger nach Rohpunkten sortieren und ESC-Punkte verteilen
        const viewerMap = new Map();
        for (const entries of byCountry.values()) {
            entries.sort((a, b) => b.points - a.points);
            entries.slice(0, ESC_RANKS.length).forEach((e, idx) => {
                const curr = viewerMap.get(e.singerId) || 0;
                viewerMap.set(e.singerId, curr + ESC_RANKS[idx]);
            });
        }

        return singers.map(s => ({
            singer_id: s.singer_id,
            singer_name: s.singer_name,
            song_name: s.song_name,
            country: s.country,
            landcode: s.landcode,
            land_bild: s.land_bild,
            jury_points: juryMap.get(s.singer_id) || 0,
            viewer_points: viewerMap.get(s.singer_id) || 0,
        }));
    } catch (err) {
        console.error(styleText("red", "Fehler in calculateResults: " + err.message));
        throw err;
    }
};
