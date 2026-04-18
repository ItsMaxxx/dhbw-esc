document.querySelectorAll(".select-wrapper select").forEach((select) => {
  let isOpen = false;

  select.addEventListener("mousedown", () => {
    if (isOpen) {
      select.closest(".select-wrapper").classList.remove("is-open");
      isOpen = false;
    } else {
      isOpen = true;
      select.closest(".select-wrapper").classList.add("is-open");
    }
  });

  select.addEventListener("change", () => {
    select.closest(".select-wrapper").classList.remove("is-open");
    isOpen = false;
  });

  select.addEventListener("blur", () => {
    select.closest(".select-wrapper").classList.remove("is-open");
    isOpen = false;
  });

  select.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Enter") {
      select.closest(".select-wrapper").classList.remove("is-open");
      isOpen = false;
    }
  });
});

// Bidirektionale Maps für Auto-Auswahl (landcode ↔ vorwahl)
let landcodeZuVorwahl = new Map();
let vorwahlZuLandcode = new Map();
let erlaubteWerte = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/api/countries");
    const laender = await res.json();

    const countrySelect = document.getElementById("countryCode");
    const prefixSelect = document.getElementById("phonePrefix");
    const laendercodes = new Set();
    const vorwahlen = new Set();

    for (const c of laender) {
      laendercodes.add(c.landcode);
      countrySelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${c.landcode}">${c.country} (${c.landcode})</option>`
      );
      if (c.vorwahl) {
        vorwahlen.add(c.vorwahl);
        landcodeZuVorwahl.set(c.landcode, c.vorwahl);
        vorwahlZuLandcode.set(c.vorwahl, c.landcode);
        prefixSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${c.vorwahl}">${c.vorwahl} (${c.landcode})</option>`
        );
      }
    }

    erlaubteWerte = { laendercodes, vorwahlen };

    // Auto-Auswahl: Landcode → Vorwahl
    countrySelect.addEventListener("change", () => {
      prefixSelect.value = landcodeZuVorwahl.get(countrySelect.value) || "";
    });

    // Auto-Auswahl: Vorwahl → Landcode
    prefixSelect.addEventListener("change", () => {
      countrySelect.value = vorwahlZuLandcode.get(prefixSelect.value) || "";
    });

  } catch (err) {
    console.error("Fehler beim Laden der Länder:", err);
  }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phonePrefix = document.getElementById("phonePrefix").value;
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  const birthDate = document.getElementById("birthDate").value;
  const gender = document.getElementById("gender").value;
  const countryCode = document.getElementById("countryCode").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const isOver18 = document.getElementById("chkOver18").checked;
  const acceptedTerms = document.getElementById("chkTerms").checked;

  const errorMsg = document.getElementById("signup-error-message");
  errorMsg.classList.add("hidden");
  errorMsg.textContent = "";

  const pruefung = validateUserData(
    { firstName, lastName, email, phonePrefix, phoneNumber, birthDate, gender, countryCode, password, confirmPassword },
    true,
    erlaubteWerte
  );
  if (!pruefung.ok) {
    errorMsg.textContent = pruefung.meldung;
    errorMsg.classList.remove("hidden");
    return;
  }

  if (!isOver18 || !acceptedTerms) {
    errorMsg.textContent = "Du musst mindestens 18 Jahre alt sein und die Nutzungsbedingungen akzeptieren.";
    errorMsg.classList.remove("hidden");
    return;
  }

  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName, lastName, email, phonePrefix, phoneNumber,
        birthDate, gender, countryCode, password, confirmPassword, isOver18, acceptedTerms,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      window.location.href = "/login";
    } else {
      errorMsg.textContent = data.message || "Registrierung fehlgeschlagen.";
      errorMsg.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Fehler bei Sign-up:", err);
    errorMsg.textContent = "Verbindungsfehler zum Server.";
    errorMsg.classList.remove("hidden");
  }
});
