import { styleText } from "node:util";
import {
    getAllSingers,
    getCountryByLandcode,
    deleteViewerVotes,
    insertViewerVote,
    deleteJuryVotes,
    insertJuryVote,
    getViewerVoteSumsPerCountry,
    getJuryPointsPerSinger,
    deleteAllVotes,
} from "./database.js";

// Klassisches ESC-Punkteschema (Top 10 eines Landes → 12, 10, 8, ..., 1)
const ESC_POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];
const ALLOWED_JURY_POINTS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 12]);
const MAX_VIEWER_POINTS_TOTAL = 20;

// Alle Sänger inkl. Länderdaten für Voting-/Results-Tab holen
export const fetchAllSingers = async () => {
    try {
        return await getAllSingers();
    } catch (err) {
        console.error(styleText("red", "Fehler in fetchAllSingers: " + err.message));
        throw err;
    }
};

// Viewer-Votes speichern: alte Abgabe wird überschrieben
export const submitViewerVotes = async (viewerId, viewerLandcode, rawVotes) => {
    try {
        if (!Array.isArray(rawVotes)) {
            return { success: false, message: "Ungültige Vote-Daten." };
        }

        // Aggregieren + validieren
        const cleaned = [];
        const seen = new Set();
        let total = 0;
        for (const v of rawVotes) {
            const singerId = Number(v.singerId);
            const points = Number(v.points);
            if (!Number.isInteger(singerId) || !Number.isInteger(points)) {
                return { success: false, message: "Ungültige Vote-Daten." };
            }
            if (points < 0 || points > MAX_VIEWER_POINTS_TOTAL) {
                return { success: false, message: "Stimmen pro Sänger müssen zwischen 0 und 20 liegen." };
            }
            if (seen.has(singerId)) {
                return { success: false, message: "Ein Sänger darf nur einmal in der Abgabe vorkommen." };
            }
            seen.add(singerId);
            total += points;
            if (points > 0) cleaned.push({ singerId, points });
        }
        if (total === 0) {
            return { success: false, message: "Bitte verteile mindestens eine Stimme." };
        }
        if (total > MAX_VIEWER_POINTS_TOTAL) {
            return { success: false, message: `Insgesamt sind höchstens ${MAX_VIEWER_POINTS_TOTAL} Stimmen erlaubt.` };
        }

        // Sperre für das eigene Land (nur wenn landcode bekannt ist)
        if (viewerLandcode) {
            const ownCountry = await getCountryByLandcode(viewerLandcode);
            if (ownCountry) {
                const singers = await getAllSingers();
                const ownSingerIds = new Set(
                    singers.filter(s => s.country_id === ownCountry.id).map(s => s.singer_id)
                );
                for (const v of cleaned) {
                    if (ownSingerIds.has(v.singerId)) {
                        return { success: false, message: "Du kannst nicht für dein eigenes Land abstimmen." };
                    }
                }
            }
        }

        await deleteViewerVotes(viewerId);
        for (const v of cleaned) {
            await insertViewerVote(viewerId, v.singerId, v.points);
        }

        console.log(styleText("green", `Viewer ${viewerId} hat ${total} Stimmen auf ${cleaned.length} Sänger verteilt.`));
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

        if (cleaned.length === 0) {
            return { success: false, message: "Bitte vergib mindestens eine Bewertung." };
        }

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

// Finale Punkte pro Sänger: Jury-Summe + Zuschauer-Umrechnung (12/10/8/.../1 pro Voting-Land)
export const calculateResults = async () => {
    try {
        const singers = await getAllSingers();

        // 1. Jury-Punkte (direkt aufsummiert)
        const juryRows = await getJuryPointsPerSinger();
        const juryMap = new Map();
        for (const r of juryRows) {
            juryMap.set(r.singer_id, r.jury_points || 0);
        }

        // 2. Viewer-Rohstimmen pro Herkunftsland -> ESC-Punkte
        const viewerRaw = await getViewerVoteSumsPerCountry();
        const byVotingCountry = new Map();
        for (const r of viewerRaw) {
            if (!byVotingCountry.has(r.voting_country)) {
                byVotingCountry.set(r.voting_country, []);
            }
            byVotingCountry.get(r.voting_country).push({
                singerId: r.singer_id,
                raw: r.total_raw_points,
            });
        }

        const viewerMap = new Map();
        for (const [, list] of byVotingCountry) {
            // Absteigend nach Rohstimmen sortieren
            list.sort((a, b) => b.raw - a.raw);
            // Top-N bekommen ESC-Punkte (12, 10, 8, 7, ..., 1)
            for (let i = 0; i < list.length && i < ESC_POINTS.length; i++) {
                const id = list[i].singerId;
                viewerMap.set(id, (viewerMap.get(id) || 0) + ESC_POINTS[i]);
            }
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
