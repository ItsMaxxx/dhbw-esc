// News-Cards für die Startseite – Struktur und Daten an einer Stelle
const newsCards = [
    {
        href: "/news/vienna-watch-alongs-2026.html",
        img: "/assets/images/news/vienna_watch_alongs.png",
        alt: "Eurovision trophy on stage in Vienna",
        badge: "Austria",
        title: "Join us for the Vienna 2026 Watch-Alongs",
        date: "Apr 17",
        readTime: "4 min read",
    },
    {
        href: "/news/non-stop-hits-2026.html",
        img: "/assets/images/news/non_stop_hits.png",
        alt: "Bright Eurovision-style heart graphic with playlist artwork",
        badge: "Playlist",
        title: "The Hits are back... Non-Stop!",
        date: "Apr 18",
        readTime: "3 min read",
    },
    {
        href: "/news/vienna-guide-2026.html",
        img: "/assets/images/news/vienna_weeks.png",
        alt: "Person holding an Austrian flag in a city street",
        badge: "Austria",
        title: "What to do in Vienna during Eurovision week",
        date: "Apr 19",
        readTime: "2 min read",
    },
    {
        href: "/news/fan-favorites-2026.html",
        img: "/assets/images/news/fan_predictions.png",
        alt: "Crowd at a Eurovision-style event with colorful lights",
        badge: "Community",
        title: "Early fan favorites and bold predictions",
        date: "Apr 20",
        readTime: "4 min read",
    },
    {
        href: "/news/community-picks-2026.html",
        img: "/assets/images/news/community_picks.png",
        alt: "Fans cheering with colorful flags at a Eurovision event",
        badge: "Community",
        title: "Community Picks: The Songs Fans Can't Stop Voting For",
        date: "Apr 21",
        readTime: "4 min read",
    },
    {
        href: "/news/behind-the-votes-2026.html",
        img: "/assets/images/news/behind_the_votes.png",
        alt: "Eurovision scoreboard graphic with shifting country rankings",
        badge: "News",
        title: "Behind the Votes: How the Scoreboard Is Changing",
        date: "Apr 22",
        readTime: "5 min read",
    },
];

const carousel = document.querySelector(".news-cards");

carousel.innerHTML = newsCards
    .map(
        (card) => `
        <article class="news-card">
            <a href="${card.href}" class="news-card-link">
                <img
                    src="${card.img}"
                    alt="${card.alt}"
                    class="news-card-img"
                    onerror="this.style.display = 'none'"
                />
                <span class="news-card-badge">${card.badge}</span>
                <div class="news-card-body">
                    <h3 class="news-card-title">${card.title}</h3>
                    <div class="news-card-meta">
                        <span>${card.date}</span>
                        <span class="news-card-meta-dot"></span>
                        <span>${card.readTime}</span>
                    </div>
                </div>
            </a>
        </article>
    `,
    )
    .join("");

const wrap = carousel.closest(".news-cards-wrap");
const scrollAmount = () => carousel.querySelector(".news-card").offsetWidth + 24;

document.getElementById("news-prev").addEventListener("click", () => {
    carousel.scrollBy({ left: -scrollAmount(), behavior: "smooth" });
});

document.getElementById("news-next").addEventListener("click", () => {
    carousel.scrollBy({ left: scrollAmount(), behavior: "smooth" });
});
