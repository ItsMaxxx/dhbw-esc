// Custom-Styling für die select-wrapper-Pfeile (signup-spezifisch)
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

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initCountryDropdowns("countryCode", "phonePrefix");
  } catch (err) {
    console.error("Fehler beim Laden der Länder:", err);
  }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const errorMsg = document.getElementById("signup-error-message");
  errorMsg.classList.add("hidden");
  errorMsg.textContent = "";

  const payload = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phonePrefix: document.getElementById("phonePrefix").value,
    phoneNumber: document.getElementById("phoneNumber").value.trim(),
    birthDate: document.getElementById("birthDate").value,
    gender: document.getElementById("gender").value,
    countryCode: document.getElementById("countryCode").value,
    password: document.getElementById("password").value,
    confirmPassword: document.getElementById("confirmPassword").value,
    isOver18: document.getElementById("chkOver18").checked,
    acceptedTerms: document.getElementById("chkTerms").checked,
  };

  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
