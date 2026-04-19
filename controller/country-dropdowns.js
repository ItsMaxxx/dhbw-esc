// Befüllt Land- und Vorwahl-Dropdowns aus /api/countries
// und setzt die bidirektionale Auto-Auswahl (Landcode ↔ Vorwahl).
// Genutzt von signup.js und user.js.
async function initCountryDropdowns(countrySelectId, prefixSelectId) {
    const res = await fetch("/api/countries");
    const laender = await res.json();

    const countrySelect = document.getElementById(countrySelectId);
    const prefixSelect = document.getElementById(prefixSelectId);
    const landcodeZuVorwahl = new Map();
    const vorwahlZuLandcode = new Map();

    for (const c of laender) {
        countrySelect.insertAdjacentHTML(
            "beforeend",
            `<option value="${c.landcode}">${c.country} (${c.landcode})</option>`
        );
        if (c.vorwahl) {
            landcodeZuVorwahl.set(c.landcode, c.vorwahl);
            vorwahlZuLandcode.set(c.vorwahl, c.landcode);
            prefixSelect.insertAdjacentHTML(
                "beforeend",
                `<option value="${c.vorwahl}">${c.vorwahl} (${c.landcode})</option>`
            );
        }
    }

    countrySelect.addEventListener("change", () => {
        prefixSelect.value = landcodeZuVorwahl.get(countrySelect.value) || "";
    });
    prefixSelect.addEventListener("change", () => {
        countrySelect.value = vorwahlZuLandcode.get(prefixSelect.value) || "";
    });
}

window.initCountryDropdowns = initCountryDropdowns;
