import { styleText } from "node:util";
import {
    getAllSingers,
    deleteViewerVotes,
    insertViewerVote,
    deleteJuryVotes,
    insertJuryVote,
    getViewerPointsPerSinger,
    getJuryPointsPerSinger,
    deleteAllVotes,
} from "./database.js";

// Klassisches ESC-Punkteschema (1-8, 10, 12, jeder Wert nur einmal)
const ALLOWED_POINTS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 12]);

// Alle Sänger inkl. Länderdaten für Voting-/Results-Tab holen
export const fetchAllSingers = async () => {
    try {
        return await getAllSingers();
    } catch (err) {
        console.error(styleText("red", "Fehler in fetchAllSingers: " + err.message));
        throw err;
    }
};

// Gemeinsame Validierung für Viewer- und Jury-Votes
function validateVotes(rawVotes, ownSingerIds) {
    if (!Array.isArray(rawVotes)) {
        return { error: "Ungültige Vote-Daten." };
    }
    const cleaned = [];
    const usedPoints = new Set();
    const usedSingers = new Set();
    for (const v of rawVotes) {
        const singerId = Number(v.singerId);
        const points = Number(v.points);
        if (!Number.isInteger(singerId) || !Number.isInteger(points)) {
            return { error: "Ungültige Vote-Daten." };
        }
        if (!ALLOWED_POINTS.has(points)) {
            return { error: "Ungültige Punktzahl. Erlaubt: 1–8, 10, 12." };
        }
        if (usedPoints.has(points)) {
            return { error: `Punktewert ${points} wurde doppelt vergeben.` };
        }
        if (usedSingers.has(singerId)) {
            return { error: "Ein Sänger darf nur einmal bewertet werden." };
        }
        if (ownSingerIds.has(singerId)) {
            return { error: "Du kannst nicht für dein eigenes Land abstimmen." };
        }
        usedPoints.add(points);
        usedSingers.add(singerId);
        cleaned.push({ singerId, points });
    }
    if (cleaned.length !== ALLOWED_POINTS.size) {
        return { error: `Bitte alle ${ALLOWED_POINTS.size} Punktewerte (1-8, 10, 12) vergeben.` };
    }
    return { cleaned };
}

// Viewer-Votes speichern: alte Abgabe wird überschrieben
export const submitViewerVotes = async (viewerId, viewerLandcode, rawVotes) => {
    try {
        const singers = await getAllSingers();
        const ownSingerIds = new Set(
            viewerLandcode
                ? singers
                      .filter(s => (s.landcode || "").toUpperCase() === viewerLandcode.toUpperCase())
                      .map(s => s.singer_id)
                : []
        );

        const { error, cleaned } = validateVotes(rawVotes, ownSingerIds);
        if (error) return { success: false, message: error };

        await deleteViewerVotes(viewerId);
        for (const v of cleaned) {
            await insertViewerVote(viewerId, v.singerId, v.points);
        }

        console.log(styleText("green", `Viewer ${viewerId} hat ${cleaned.length} Bewertungen gespeichert.`));
        return { success: true };
    } catch (err) {
        console.error(styleText("red", "Fehler in submitViewerVotes: " + err.message));
        return { success: false, message: "Interner Serverfehler beim Speichern der Stimmen." };
    }
};

// Jury-Votes speichern: alte Abgabe dieses Jury-Landes wird überschrieben
export const submitJuryVotes = async (juryCountry, rawVotes) => {
    try {
        if (!juryCountry) {
            return { success: false, message: "Kein Jury-Land in der Session." };
        }

        const singers = await getAllSingers();
        const ownSingerIds = new Set(
            singers.filter(s => s.country === juryCountry).map(s => s.singer_id)
        );

        const { error, cleaned } = validateVotes(rawVotes, ownSingerIds);
        if (error) return { success: false, message: error };

        await deleteJuryVotes(juryCountry);
        for (const v of cleaned) {
            await insertJuryVote(juryCountry, v.singerId, v.points);
        }

        console.log(styleText("green", `Jury "${juryCountry}" hat ${cleaned.length} Bewertungen gespeichert.`));
        return { success: true };
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

// Finale Punkte pro Sänger: Jury- und Viewer-Punkte direkt aufsummiert
export const calculateResults = async () => {
    try {
        const [singers, juryRows, viewerRows] = await Promise.all([
            getAllSingers(),
            getJuryPointsPerSinger(),
            getViewerPointsPerSinger(),
        ]);

        const juryMap = new Map(juryRows.map(r => [r.singer_id, r.jury_points || 0]));
        const viewerMap = new Map(viewerRows.map(r => [r.singer_id, r.viewer_points || 0]));

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
