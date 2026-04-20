// voting.js - Steuert Tabs und das Absenden der Votes
// Viewer: freie Verteilung von bis zu 10 Punkten, kumulativ über mehrere Abgaben.
// Jury:   einmalige Abgabe des kompletten ESC-Schemas (1-8, 10, 12).

let userSession = { loggedIn: false };
let singers = [];
let votingState = { votingOpen: false, resultsVisible: false };
let currentTab = "voting";

// Viewer: bereits in der DB vergebene Punkte (fix) vs. jetzt neu hinzugefügte (editierbar)
let viewerUsed = {};
let viewerAdding = {};
let viewerMax = 10;

// Jury: true = bereits abgestimmt, Formular gesperrt
let juryHasVoted = false;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Session laden
    try {
        const sessionRes = await fetch("/api/check-session");
        userSession = await sessionRes.json();
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
    if (userSession.loggedIn && userSession.user?.role === "admin") {
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

    // 5. Eigenen Vote-Status laden (bereits vergebene Punkte bzw. Jury-hasVoted)
    await loadMyStatus();

    renderVotingTab();

    const submitBtn = document.getElementById("submit-votes");
    if (submitBtn) submitBtn.addEventListener("click", submitVotes);

    // 6. Admin-Tab initialisieren
    if (userSession.loggedIn && userSession.user?.role === "admin") {
        initAdminTab();
    }

    // 7. SSE-Verbindung aufbauen für Echtzeit-Updates
    initSSE();
});

// ---------- Eigener Vote-Status ----------

async function loadMyStatus() {
    if (!userSession.loggedIn || !userSession.user) return;
    const role = userSession.user.role;
    if (role !== "viewer" && role !== "jury") return;

    try {
        const res = await fetch("/api/vote/my-status");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        if (data.role === "viewer") {
            viewerUsed = {};
            for (const v of data.votes || []) viewerUsed[v.singerId] = v.points;
            viewerAdding = {};
            viewerMax = data.max || 10;
        } else if (data.role === "jury") {
            juryHasVoted = !!data.hasVoted;
        }
    } catch (e) {
        console.error("my-status-Request fehlgeschlagen:", e);
    }
}

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
    const counter = document.getElementById("vote-counter");

    list.innerHTML = "";
    if (counter) counter.classList.add("hidden");
    clearMessages();

    if (!userSession.loggedIn || !userSession.user) {
        loginRequired.classList.remove("hidden");
        header.classList.add("hidden");
        submitWrapper.classList.add("hidden");
        for (const s of singers) list.appendChild(buildReadOnlyRow(s));
        return;
    }

    loginRequired.classList.add("hidden");
    const role = userSession.user.role;

    // Admin sieht kein Voting-Formular, aber die Sängerliste
    if (role === "admin") {
        header.classList.add("hidden");
        submitWrapper.classList.add("hidden");
        if (votingState.votingOpen) {
            const li = document.createElement("li");
            li.className = "info-msg";
            li.textContent = "Als Admin kannst du nicht abstimmen.";
            list.appendChild(li);
        }
        for (const s of singers) list.appendChild(buildReadOnlyRow(s));
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

    if (role !== "viewer" && role !== "jury") {
        loginRequired.classList.remove("hidden");
        header.classList.add("hidden");
        submitWrapper.classList.add("hidden");
        return;
    }

    header.classList.remove("hidden");

    const ownCountry = userSession.user.country || "";
    // Jury bekommt als country den Ländernamen ("Germany"), Viewer den Landcode ("DE")
    const matchesOwn = role === "jury"
        ? (s) => s.country && s.country.toString().toUpperCase() === ownCountry.toString().toUpperCase()
        : (s) => s.landcode && s.landcode.toString().toUpperCase() === ownCountry.toString().toUpperCase();

    if (role === "viewer") {
        renderViewerForm(list, submitWrapper, counter, ownCountry, matchesOwn);
    } else {
        renderJuryForm(list, submitWrapper, ownCountry, matchesOwn);
    }
}

// ---- Viewer-Modus (frei verteilen, kumulativ) ----

function renderViewerForm(list, submitWrapper, counter, ownCountry, matchesOwn) {
    const usedTotal = sumUsed();
    const remaining = Math.max(0, viewerMax - usedTotal);
    const fullyUsed = remaining === 0;

    document.getElementById("voting-title").textContent = "Deine Stimmen verteilen";
    document.getElementById("voting-info").textContent = fullyUsed
        ? `Du hast bereits alle ${viewerMax} Stimmen vergeben. Eine Änderung ist nicht möglich.`
        : `Du hast ${viewerMax} Stimmen und kannst sie frei auf die Sänger verteilen. Bereits vergebene Stimmen sind fixiert. Für dein eigenes Land (${ownCountry || "-"}) kannst du nicht abstimmen.`;

    document.getElementById("vote-counter-max").textContent = viewerMax;
    counter.classList.remove("hidden");

    for (const s of singers) {
        list.appendChild(buildViewerRow(s, matchesOwn(s), fullyUsed));
    }

    submitWrapper.classList.toggle("hidden", fullyUsed);
    updateViewerCounter();
}

function renderJuryForm(list, submitWrapper, ownCountry, matchesOwn) {
    document.getElementById("voting-title").textContent = `Jury-Voting (${ownCountry})`;

    if (juryHasVoted) {
        document.getElementById("voting-info").textContent =
            "Du hast bereits abgestimmt. Eine Änderung der Stimmen ist nicht möglich.";
        submitWrapper.classList.add("hidden");
        const li = document.createElement("li");
        li.className = "info-msg";
        li.textContent = "Deine Jury-Wertung wurde gespeichert und ist endgültig.";
        list.appendChild(li);
        for (const s of singers) list.appendChild(buildReadOnlyRow(s));
        return;
    }

    document.getElementById("voting-info").textContent =
        `Vergib alle ESC-Punkte: 1-8, 10, 12. Jeder Punktewert muss genau einmal vergeben werden. Für dein eigenes Land (${ownCountry || "-"}) kannst du nicht abstimmen. Achtung: Die Abgabe ist endgültig und kann danach nicht mehr geändert werden.`;

    submitWrapper.classList.remove("hidden");

    for (const s of singers) {
        list.appendChild(buildJuryRow(s, matchesOwn(s)));
    }
    updateJuryValidation();
}

function buildReadOnlyRow(singer) {
    const li = document.createElement("li");
    li.className = "singer-row";
    li.innerHTML = baseRowHtml(singer);
    return li;
}

function buildViewerRow(singer, isOwn, locked) {
    const li = document.createElement("li");
    li.className = "singer-row" + (isOwn ? " disabled" : "");
    const used = viewerUsed[singer.singer_id] || 0;
    const usedCls = used === 0 ? "vote-used zero" : "vote-used";

    let controls;
    if (isOwn) {
        controls = '<span class="own-country">dein Land</span>';
    } else if (locked) {
        // Formular gesperrt: nur noch Used-Badge
        controls = `<span class="${usedCls}" title="Bereits vergeben">${used}</span>`;
    } else {
        controls = `
            <span class="${usedCls}" title="Bereits vergeben">${used}</span>
            <button class="vote-btn minus" type="button" aria-label="weniger">-</button>
            <input type="number" class="vote-input" min="0" max="${viewerMax}" value="0" data-singer-id="${singer.singer_id}" />
            <button class="vote-btn plus" type="button" aria-label="mehr">+</button>
        `;
    }

    li.innerHTML = baseRowHtml(singer) + `<div class="vote-controls">${controls}</div>`;

    if (!isOwn && !locked) {
        const input = li.querySelector(".vote-input");
        li.querySelector(".minus").addEventListener("click", () =>
            changeViewerAdding(singer.singer_id, -1, input),
        );
        li.querySelector(".plus").addEventListener("click", () =>
            changeViewerAdding(singer.singer_id, +1, input),
        );
        input.addEventListener("input", () =>
            onViewerInputChange(singer.singer_id, input),
        );
    }
    return li;
}

function buildJuryRow(singer, isOwn) {
    const li = document.createElement("li");
    li.className = "singer-row" + (isOwn ? " disabled" : "");
    const options = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1]
        .map((p) => `<option value="${p}">${p}</option>`)
        .join("");
    li.innerHTML =
        baseRowHtml(singer) +
        `<div class="vote-controls">${
            isOwn
                ? '<span class="own-country">dein Land</span>'
                : `<select class="vote-select" data-singer-id="${singer.singer_id}">
                <option value="">-</option>
                ${options}
            </select>`
        }</div>`;
    if (!isOwn) {
        li.querySelector(".vote-select").addEventListener(
            "change",
            updateJuryValidation,
        );
    }
    return li;
}

// ---- Viewer-Helper (kumulatives Budget) ----

function changeViewerAdding(singerId, delta, input) {
    const current = viewerAdding[singerId] || 0;
    const remaining = viewerMax - sumUsed() - sumAdding();
    let next = current + delta;
    if (next < 0) next = 0;
    if (delta > 0 && remaining <= 0) next = current;
    if (next > current + remaining) next = current + remaining;
    viewerAdding[singerId] = next;
    input.value = next;
    updateViewerCounter();
}

function onViewerInputChange(singerId, input) {
    let val = parseInt(input.value, 10);
    if (!Number.isFinite(val) || val < 0) val = 0;
    const current = viewerAdding[singerId] || 0;
    const remaining = viewerMax - sumUsed() - sumAdding();
    const maxAllowed = current + remaining;
    if (val > maxAllowed) val = maxAllowed;
    viewerAdding[singerId] = val;
    input.value = val;
    updateViewerCounter();
}

function sumUsed() {
    return Object.values(viewerUsed).reduce((s, v) => s + (v || 0), 0);
}

function sumAdding() {
    return Object.values(viewerAdding).reduce((s, v) => s + (v || 0), 0);
}

function updateViewerCounter() {
    const used = sumUsed();
    const adding = sumAdding();
    const remaining = Math.max(0, viewerMax - used - adding);

    document.getElementById("vote-counter-used").textContent = used;
    document.getElementById("vote-counter-adding").textContent = adding;
    document.getElementById("vote-counter-remaining").textContent = remaining;

    const counter = document.getElementById("vote-counter");
    counter.classList.toggle("over", used + adding > viewerMax);

    const submitBtn = document.getElementById("submit-votes");
    if (submitBtn) submitBtn.disabled = adding === 0;
}

function baseRowHtml(singer) {
    return `
        ${flagHtml(singer)}
        <span class="landcode">${escapeHtml(singer.landcode || "")}</span>
        <span class="singer-name">${escapeHtml(singer.singer_name)}</span>
        <span class="song-name">${escapeHtml(singer.song_name)}</span>
    `;
}

function updateJuryValidation() {
    const selects = document.querySelectorAll(".vote-select");
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

    // Alle 10 Punktewerte (1-8, 10, 12) müssen vergeben werden
    const complete = filled === 10 && !hasDuplicate;
    const submitBtn = document.getElementById("submit-votes");
    submitBtn.disabled = !complete;

    const errorEl = document.getElementById("vote-error");
    if (!complete && filled > 0) {
        errorEl.textContent = hasDuplicate
            ? "Jeder Punktewert darf nur einmal vergeben werden."
            : `Bitte alle 10 Punktewerte vergeben (${filled}/10).`;
        errorEl.classList.remove("hidden");
    } else {
        errorEl.classList.add("hidden");
    }
}

function clearMessages() {
    const errorEl = document.getElementById("vote-error");
    const successEl = document.getElementById("vote-success");
    if (errorEl) errorEl.classList.add("hidden");
    if (successEl) successEl.classList.add("hidden");
}

async function submitVotes() {
    const errorEl = document.getElementById("vote-error");
    const successEl = document.getElementById("vote-success");
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    if (!userSession.loggedIn || !userSession.user) return;
    const role = userSession.user.role;
    if (role !== "viewer" && role !== "jury") return;

    let endpoint;
    let body;

    if (role === "viewer") {
        endpoint = "/api/vote/viewer";
        const votes = Object.entries(viewerAdding)
            .filter(([, p]) => (p || 0) > 0)
            .map(([singerId, points]) => ({
                singerId: Number(singerId),
                points: Number(points),
            }));
        if (votes.length === 0) {
            errorEl.textContent = "Bitte verteile mindestens eine Stimme.";
            errorEl.classList.remove("hidden");
            return;
        }
        body = { votes };
    } else {
        endpoint = "/api/vote/jury";
        const votes = [];
        document.querySelectorAll(".vote-select").forEach((s) => {
            if (s.value !== "") {
                votes.push({
                    singerId: Number(s.dataset.singerId),
                    points: Number(s.value),
                });
            }
        });
        body = { votes };
    }

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok && data.success) {
            // Status aus Response übernehmen (kein Reload nötig)
            if (role === "viewer" && data.status) {
                viewerUsed = {};
                for (const v of data.status.votes || []) viewerUsed[v.singerId] = v.points;
                viewerAdding = {};
                viewerMax = data.status.max || viewerMax;
            } else if (role === "jury") {
                juryHasVoted = true;
            }

            renderVotingTab();

            const successAfter = document.getElementById("vote-success");
            successAfter.textContent = "Stimmen erfolgreich gespeichert!";
            successAfter.classList.remove("hidden");
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
            li.innerHTML = `
                ${flagHtml(r)}
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

    adminAction({
        btnId: "btn-start-voting",
        infoId: "admin-start-info",
        endpoint: "/api/admin/start-voting",
        successText: "Voting wurde gestartet!",
        onSuccess: () => { votingState.votingOpen = true; updateAdminBadges(); },
    });

    adminAction({
        btnId: "btn-show-results",
        infoId: "admin-show-info",
        endpoint: "/api/admin/show-results",
        successText: "Ergebnisse wurden freigegeben!",
        onSuccess: () => { votingState.resultsVisible = true; updateAdminBadges(); },
    });

    adminAction({
        btnId: "btn-clear-votes",
        infoId: "admin-clear-info",
        endpoint: "/api/admin/clear-votes",
        confirmMsg: "Wirklich alle Votes löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
        successText: "Alle Votes wurden gelöscht.",
    });

    adminAction({
        btnId: "btn-stop-voting",
        infoId: "admin-stop-info",
        endpoint: "/api/admin/stop-voting",
        confirmMsg: "Voting wirklich stoppen? Nutzer können dann nicht mehr abstimmen.",
        successText: "Voting wurde gestoppt.",
        onSuccess: () => { votingState.votingOpen = false; updateAdminBadges(); },
    });

    adminAction({
        btnId: "btn-hide-results",
        infoId: "admin-hide-info",
        endpoint: "/api/admin/hide-results",
        confirmMsg: "Ergebnisse wirklich verbergen?",
        successText: "Ergebnisse wurden verborgen.",
        onSuccess: () => { votingState.resultsVisible = false; updateAdminBadges(); },
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
    sse.addEventListener("state", async (e) => {
        const newState = JSON.parse(e.data);
        votingState = newState;

        // Eigenen Status neu laden – nach Admin-Reset/Clear können Votes weg sein
        await loadMyStatus();

        // Voting-Tab neu rendern (z.B. Formular einblenden wenn Voting gestartet)
        renderVotingTab();

        // Admin-Badges aktualisieren
        if (userSession.loggedIn && userSession.user?.role === "admin") {
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
        if (currentTab === "admin" && userSession.loggedIn && userSession.user?.role === "admin") {
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

function flagHtml(s) {
    return s.land_bild
        ? `<img src="${escapeHtml(s.land_bild)}" alt="${escapeHtml(s.landcode || "")}" class="flag" />`
        : `<span class="flag flag-placeholder"></span>`;
}

async function adminAction({ btnId, infoId, endpoint, confirmMsg, successText, onSuccess }) {
    const info = document.getElementById(infoId);
    document.getElementById(btnId).addEventListener("click", async () => {
        if (confirmMsg && !confirm(confirmMsg)) return;
        try {
            const res = await fetch(endpoint, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                info.textContent = successText;
                info.className = "admin-info success";
                if (onSuccess) onSuccess();
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
