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

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phonePrefix = document.getElementById("phonePrefix").value.trim();
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

  // Pflichtfeld-Check
  if (
    !firstName ||
    !lastName ||
    !email ||
    !countryCode ||
    !password ||
    !confirmPassword
  ) {
    errorMsg.textContent = "Bitte alle Pflichtfelder ausfüllen.";
    errorMsg.classList.remove("hidden");
    return;
  }

  // Passwort-Checks
  const passwordPattern = /^(?=.*[A-Z])(?=.*[!@#$%^&*()\-]).{8,}$/;
  if (!passwordPattern.test(password)) {
    errorMsg.textContent = "Passwort erfüllt die Anforderungen nicht.";
    errorMsg.classList.remove("hidden");
    return;
  }

  if (password !== confirmPassword) {
    errorMsg.textContent = "Passwörter stimmen nicht überein.";
    errorMsg.classList.remove("hidden");
    return;
  }

  if (!isOver18 || !acceptedTerms) {
    errorMsg.textContent =
      "Du musst mindestens 18 Jahre alt sein und die Nutzungsbedingungen akzeptieren.";
    errorMsg.classList.remove("hidden");
    return;
  }

  // Request an Backend schicken
  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phonePrefix,
        phoneNumber,
        birthDate,
        gender,
        countryCode,
        password,
        confirmPassword,
        isOver18,
        acceptedTerms,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Nach erfolgreicher Registrierung auf Login-Seite leiten
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
