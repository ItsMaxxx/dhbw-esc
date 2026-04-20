document.addEventListener("DOMContentLoaded", () => {
  // Popup-HTML ins Dokument einfügen
  const bannerHTML = `
        <div id="cookieBanner" class="cookie-banner hidden">
            <div class="cookie-content">
                <p id="cookieErrorMsg" class="cookie-error hidden"></p>
                <p><strong>Cookie-Hinweis:</strong> Wir nutzen Cookies, um deine Sitzung sicher zu speichern. Dies ist zwingend erforderlich, um sich einzuloggen. Stimmst du zu?</p>
                <div class="cookie-buttons">
                    <button id="btnAcceptCookies" class="btn-yes">Ja, einverstanden</button>
                    <button id="btnDeclineCookies" class="btn-no">Nein, ablehnen</button>
                </div>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML("beforeend", bannerHTML);

  const banner = document.getElementById("cookieBanner");
  const consent = localStorage.getItem("cookie_consent");

  // Wenn noch keine Entscheidung getroffen wurde, Banner anzeigen
  if (!consent) {
    banner.classList.remove("hidden");
  }

  document.getElementById("btnAcceptCookies").addEventListener("click", () => {
    localStorage.setItem("cookie_consent", "yes");
    banner.classList.add("hidden");
    document.getElementById("cookieErrorMsg").classList.add("hidden");
  });

  document.getElementById("btnDeclineCookies").addEventListener("click", () => {
    localStorage.setItem("cookie_consent", "no");
    banner.classList.add("hidden");
    document.getElementById("cookieErrorMsg").classList.add("hidden");
  });
});

// Diese Funktion wird von login.js aufgerufen, falls der Login blockiert wird
window.showCookieBannerWithError = function () {
  const banner = document.getElementById("cookieBanner");
  const errorMsg = document.getElementById("cookieErrorMsg");

  errorMsg.textContent = "Bitte stimme den Cookies zu, um dich einzuloggen.";
  errorMsg.classList.remove("hidden");
  banner.classList.remove("hidden");
};
