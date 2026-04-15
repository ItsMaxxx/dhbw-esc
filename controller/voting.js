// voting.js - Steuert Tabs, Stimmenzähler und das Absenden der Votes

let session = { loggedIn: false };
let singers = [];
let viewerVotes = {}; // singerId -> points (nur Zuschauer)
let votingState = { votingOpen: false, resultsVisible: false };
let currentTab = "voting";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Session laden
    try {
        const sessionRes = await fetch("/api/check-session");
        session = await sessionRes.json();
    } catch (e) {
        console.error("Session-Check fehlgeschlagen:", e);
    }

    // 2. Voting-State laden
    try {
        const stateRes = await fetch("/api/admin/state");
        if (stateRes.ok) votingState = await stateRes.json();
    } catch (e) {
        console.error("State-Check fehlgeschlagen:", e);
    }

    // 3. Admin-Tab-Button sichtbar machen (vor initTabs, damit der Listener sitzt)
    if (session.loggedIn && session.user?.role === "admin") {
        const adminBtn = document.getElementById("tab-btn-admin");
        if (adminBtn) adminBtn.classList.remove("hidden");
    }

    initTabs();

    // 4. Sänger laden
    try {
        const singerRes = await fetch("/api/singers");
        if (singerRes.ok) {
            singers = await singerRes.json();
        } else {
            showError("Sänger konnten nicht geladen werden.");
        }
    } catch (e) {
        console.error("Sänger-Request fehlgeschlagen:", e);
        showError("Verbindungsfehler beim Laden der Sänger.");
    }

    renderVotingTab();

    const submitBtn = document.getElementById("submit-votes");
    if (submitBtn) submitBtn.addEventListener("click", submitVotes);

    // 5. Admin-Tab initialisieren
    if (session.loggedIn && session.user?.role === "admin") {
        initAdminTab();
    }

    // 6. SSE-Verbindung aufbauen für Echtzeit-Updates
    initSSE();
});

function initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;
            currentTab = target;

            document.querySelectorAll(".tab-btn").forEach((b) => {
                b.classList.toggle("active", b === btn);
            });
            document.querySelectorAll(".tab-content").forEach((c) => {
                const show = c.id === `tab-${target}`;
                c.classList.toggle("active", show);
                c.classList.toggle("hidden", !show);
            });

            if (target === "results") {
                loadResults();
            }
        });
    });
}

// ---------- Voting-Tab ----------

function renderVotingTab() {
    const list = document.getElementById("singer-list");
    const loginRequired = document.getElementById("login-required");
    const header = document.getElementById("voting-header");
    const submitWrapper = document.getElementById("submit-wrapper");

    list.innerHTML = "";

    if (!session.loggedIn || !session.user) {
        loginRequired.classList.remove("hidden");
        header.classList.add("hidden");
        submitWrapper.classList.add("hidden");
        for (const s of singers) list.appendChild(buildReadOnlyRow(s));
        return;
    }

    loginRequired.classList.add("hidden");
    const role = session.user.role;

    // Admin sieht kein Voting-Formular
    if (role === "admin") {
        header.classList.add("hidden");
        submitWrapper.classList.add("hidden");
        return;
    }

    // Voting noch nicht gestartet
    if (!votingState.votingOpen) {
        header.classList.add("hidden");
        submitWrapper.classList.add("hidden");
        const li = document.createElement("li");
        li.className = "info-msg";
        li.textContent = "Das Voting hat noch nicht begonnen! Bitte warte auf den Admin.";
        list.appendChild(li);
        for (const s of singers) list.appendChild(buildReadOnlyRow(s));
        return;
    }

    header.classList.remove("hidden");
    submitWrapper.classList.remove("hidden");

    if (role === "viewer") {
        document.getElementById("voting-title").textContent =
            "Deine Stimmen verteilen";
        document.getElementById("voting-info").textContent =
            `Du hast insgesamt 20 Stimmen. Verteile sie beliebig auf die Sänger. Für dein eigenes Land (${session.user.country || "-"}) kannst du nicht abstimmen.`;
        document.getElementById("vote-counter-max").textContent = "20";

        for (const s of singers) {
            const isOwn =
                session.user.country &&
                s.landcode &&
                session.user.country.toString().toUpperCase() ===
                    s.landcode.toString().toUpperCase();
            list.appendChild(buildViewerRow(s, isOwn));
        }
        updateViewerCounter();
    } else if (role === "jury") {
        document.getElementById("voting-title").textContent =
            `Jury-Voting (${session.user.country || ""})`;
        document.getElementById("voting-info").textContent =
            "Vergib ESC-Punkte: 1-8, 10, 12. Jeder Punktewert darf nur einmal vergeben werden.";
        document.querySelector(".vote-counter").classList.add("hidden");

        for (const s of singers) list.appendChild(buildJuryRow(s));
        updateJuryValidation();
    } else {
        loginRequired.classList.remove("hidden");
        header.classList.add("hidden");
        submitWrapper.classList.add("hidden");
    }
}

function buildReadOnlyRow(singer) {
    const li = document.createElement("li");
    li.className = "singer-row";
    li.innerHTML = baseRowHtml(singer);
    return li;
}

function buildViewerRow(singer, isOwn) {
    const li = document.createElement("li");
    li.className = "singer-row" + (isOwn ? " disabled" : "");
    li.innerHTML =
        baseRowHtml(singer) +
        `<div class="vote-controls">${
            isOwn
                ? '<span class="own-country">dein Land</span>'
                : `
                <button class="vote-btn minus" type="button" aria-label="weniger">-</button>
                <input type="number" class="vote-input" min="0" max="20" value="0" />
                <button class="vote-btn plus" type="button" aria-label="mehr">+</button>
            `
        }</div>`;

    if (!isOwn) {
        const input = li.querySelector(".vote-input");
        li.querySelector(".minus").addEventListener("click", () =>
            changeViewerVote(singer.singer_id, -1, input),
        );
        li.querySelector(".plus").addEventListener("click", () =>
            changeViewerVote(singer.singer_id, +1, input),
        );
        input.addEventListener("input", () =>
            onViewerInputChange(singer.singer_id, input),
        );
    }
    return li;
}

function buildJuryRow(singer) {
    const li = document.createElement("li");
    li.className = "singer-row";
    const options = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1]
        .map((p) => `<option value="${p}">${p}</option>`)
        .join("");
    li.innerHTML =
        baseRowHtml(singer) +
        `<div class="vote-controls">
            <select class="jury-select" data-singer-id="${singer.singer_id}">
                <option value="">-</option>
                ${options}
            </select>
        </div>`;
    li.querySelector(".jury-select").addEventListener(
        "change",
        updateJuryValidation,
    );
    return li;
}

function baseRowHtml(singer) {
    const flag = singer.land_bild
        ? `<img src="${escapeAttr(singer.land_bild)}" alt="${escapeAttr(singer.landcode || "")}" class="flag" />`
        : `<span class="flag flag-placeholder"></span>`;
    return `
        ${flag}
        <span class="landcode">${escapeHtml(singer.landcode || "")}</span>
        <span class="singer-name">${escapeHtml(singer.singer_name)}</span>
        <span class="song-name">${escapeHtml(singer.song_name)}</span>
    `;
}

function changeViewerVote(singerId, delta, input) {
    let current = parseInt(input.value, 10);
    if (!Number.isFinite(current)) current = 0;
    let next = current + delta;
    if (next < 0) next = 0;
    if (next > 20) next = 20;
    input.value = next;
    viewerVotes[singerId] = next;
    updateViewerCounter();
}

function onViewerInputChange(singerId, input) {
    let val = parseInt(input.value, 10);
    if (!Number.isFinite(val) || val < 0) val = 0;
    if (val > 20) val = 20;
    input.value = val;
    viewerVotes[singerId] = val;
    updateViewerCounter();
}

function updateViewerCounter() {
    let total = 0;
    for (const v of Object.values(viewerVotes)) total += v || 0;
    document.getElementById("vote-counter-value").textContent = total;

    const counter = document.querySelector(".vote-counter");
    counter.classList.toggle("over", total > 20);

    const submitBtn = document.getElementById("submit-votes");
    submitBtn.disabled = total !== 20;
}

function updateJuryValidation() {
    const selects = document.querySelectorAll(".jury-select");
    const counts = {};
    let filled = 0;

    selects.forEach((s) => {
        const v = s.value;
        if (v !== "") {
            filled++;
            counts[v] = (counts[v] || 0) + 1;
        }
    });

    let hasDuplicate = false;
    selects.forEach((s) => {
        const v = s.value;
        const dup = v !== "" && counts[v] > 1;
        s.classList.toggle("duplicate", dup);
        if (dup) hasDuplicate = true;
    });

    document.getElementById("submit-votes").disabled =
        filled === 0 || hasDuplicate;
}

async function submitVotes() {
    const errorEl = document.getElementById("vote-error");
    const successEl = document.getElementById("vote-success");
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    if (!session.loggedIn || !session.user) return;

    let endpoint;
    let body;

    if (session.user.role === "viewer") {
        endpoint = "/api/vote/viewer";
        const votes = Object.entries(viewerVotes)
            .filter(([, p]) => (p || 0) > 0)
            .map(([singerId, points]) => ({
                singerId: Number(singerId),
                points: Number(points),
            }));
        body = { votes };
    } else if (session.user.role === "jury") {
        endpoint = "/api/vote/jury";
        const votes = [];
        document.querySelectorAll(".jury-select").forEach((s) => {
            if (s.value !== "") {
                votes.push({
                    singerId: Number(s.dataset.singerId),
                    points: Number(s.value),
                });
            }
        });
        body = { votes };
    } else {
        return;
    }

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok && data.success) {
            successEl.textContent = "Stimmen erfolgreich gespeichert!";
            successEl.classList.remove("hidden");
        } else {
            errorEl.textContent = data.message || "Fehler beim Speichern.";
            errorEl.classList.remove("hidden");
        }
    } catch (e) {
        console.error("Submit fehlgeschlagen:", e);
        errorEl.textContent = "Verbindungsfehler beim Absenden.";
        errorEl.classList.remove("hidden");
    }
}

function showError(msg) {
    const list = document.getElementById("singer-list");
    list.innerHTML = `<li class="error-msg">${escapeHtml(msg)}</li>`;
}

// ---------- Results-Tab ----------

async function loadResults() {
    const list = document.getElementById("results-list");
    list.innerHTML = `<li class="loading">Lade Ergebnisse…</li>`;

    // State neu laden, damit Änderungen durch Admin sichtbar werden
    try {
        const stateRes = await fetch("/api/admin/state");
        if (stateRes.ok) votingState = await stateRes.json();
    } catch (e) { /* ignore */ }

    if (!votingState.resultsVisible) {
        list.innerHTML = `<li class="info-msg">Die Ergebnisse wurden noch nicht freigegeben.</li>`;
        return;
    }

    try {
        const res = await fetch("/api/results");
        const data = await res.json();
        if (!res.ok) {
            list.innerHTML = `<li class="error-msg">${escapeHtml(
                data.message || "Fehler beim Laden.",
            )}</li>`;
            return;
        }

        const sorted = [...data].sort(
            (a, b) =>
                b.jury_points + b.viewer_points -
                (a.jury_points + a.viewer_points),
        );

        list.innerHTML = "";
        for (const r of sorted) {
            const li = document.createElement("li");
            li.className = "singer-row results-row";
            const flag = r.land_bild
                ? `<img src="${escapeAttr(r.land_bild)}" alt="${escapeAttr(r.landcode || "")}" class="flag" />`
                : `<span class="flag flag-placeholder"></span>`;
            li.innerHTML = `
                ${flag}
                <span class="landcode">${escapeHtml(r.landcode || "")}</span>
                <span class="singer-name">${escapeHtml(r.singer_name)}</span>
                <span class="song-name">${escapeHtml(r.song_name)}</span>
                <span class="points-col"><span class="label">Jury</span>${r.jury_points}</span>
                <span class="points-col"><span class="label">Voting</span>${r.viewer_points}</span>
                <span class="points-col total"><span class="label">Total</span>${r.jury_points + r.viewer_points}</span>
            `;
            list.appendChild(li);
        }
        if (sorted.length === 0) {
            list.innerHTML = `<li class="info-msg">Noch keine Ergebnisse verfügbar.</li>`;
        }
    } catch (e) {
        console.error("Results-Request fehlgeschlagen:", e);
        list.innerHTML = `<li class="error-msg">Verbindungsfehler beim Laden der Ergebnisse.</li>`;
    }
}

// ---------- Admin-Tab ----------

function initAdminTab() {
    updateAdminBadges();

    document.getElementById("btn-start-voting").addEventListener("click", async () => {
        const info = document.getElementById("admin-start-info");
        try {
            const res = await fetch("/api/admin/start-voting", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                votingState.votingOpen = true;
                info.textContent = "Voting wurde gestartet!";
                info.className = "admin-info success";
                updateAdminBadges();
            } else {
                info.textContent = data.message || "Fehler.";
                info.className = "admin-info error";
            }
        } catch (e) {
            info.textContent = "Verbindungsfehler.";
            info.className = "admin-info error";
        }
    });

    document.getElementById("btn-show-results").addEventListener("click", async () => {
        const info = document.getElementById("admin-show-info");
        try {
            const res = await fetch("/api/admin/show-results", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                votingState.resultsVisible = true;
                info.textContent = "Ergebnisse wurden freigegeben!";
                info.className = "admin-info success";
                updateAdminBadges();
            } else {
                info.textContent = data.message || "Fehler.";
                info.className = "admin-info error";
            }
        } catch (e) {
            info.textContent = "Verbindungsfehler.";
            info.className = "admin-info error";
        }
    });

    document.getElementById("btn-clear-votes").addEventListener("click", async () => {
        const info = document.getElementById("admin-clear-info");
        if (!confirm("Wirklich alle Votes löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
        try {
            const res = await fetch("/api/admin/clear-votes", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                info.textContent = "Alle Votes wurden gelöscht.";
                info.className = "admin-info success";
            } else {
                info.textContent = data.message || "Fehler.";
                info.className = "admin-info error";
            }
        } catch (e) {
            info.textContent = "Verbindungsfehler.";
            info.className = "admin-info error";
        }
    });

    document.getElementById("btn-reset-state").addEventListener("click", async () => {
        const info = document.getElementById("admin-reset-info");
        if (!confirm("Voting und Ergebnisse wirklich zurücksetzen? Voting und Results-Anzeige werden gesperrt.")) return;
        try {
            const res = await fetch("/api/admin/reset-state", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                votingState.votingOpen = false;
                votingState.resultsVisible = false;
                info.textContent = "Status wurde zurückgesetzt.";
                info.className = "admin-info success";
                updateAdminBadges();
            } else {
                info.textContent = data.message || "Fehler.";
                info.className = "admin-info error";
            }
        } catch (e) {
            info.textContent = "Verbindungsfehler.";
            info.className = "admin-info error";
        }
    });
}

function updateAdminBadges() {
    const badgeVoting = document.getElementById("badge-voting");
    const badgeResults = document.getElementById("badge-results");
    if (badgeVoting) {
        badgeVoting.textContent = votingState.votingOpen ? "läuft" : "gestoppt";
        badgeVoting.className = "admin-state-badge " + (votingState.votingOpen ? "on" : "off");
    }
    if (badgeResults) {
        badgeResults.textContent = votingState.resultsVisible ? "sichtbar" : "gesperrt";
        badgeResults.className = "admin-state-badge " + (votingState.resultsVisible ? "on" : "off");
    }
}

// ---------- SSE ----------

function initSSE() {
    const sse = new EventSource("/api/events");

    // State-Änderung durch Admin (Voting starten, Ergebnisse freigeben, Reset)
    sse.addEventListener("state", (e) => {
        const newState = JSON.parse(e.data);
        votingState = newState;

        // Voting-Tab neu rendern (z.B. Formular einblenden wenn Voting gestartet)
        renderVotingTab();

        // Admin-Badges aktualisieren
        if (session.loggedIn && session.user?.role === "admin") {
            updateAdminBadges();
        }

        // Ergebnisse nachladen wenn Results-Tab offen und gerade freigegeben
        if (currentTab === "results") {
            loadResults();
        }
    });

    // Jemand hat abgestimmt → Ergebnisse im Results- oder Admin-Tab aktualisieren
    sse.addEventListener("votes", () => {
        if (currentTab === "results" && votingState.resultsVisible) {
            loadResults();
        }
        if (currentTab === "admin" && session.loggedIn && session.user?.role === "admin") {
            loadResults();
        }
    });
}

// ---------- Helpers ----------

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(
        /[&<>"']/g,
        (ch) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[ch],
    );
}

function escapeAttr(str) {
    return escapeHtml(str);
}
