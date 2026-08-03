document.documentElement.classList.add("js");

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

const closeNavigation = () => {
    if (!navToggle || !siteNav) return;

    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open navigation");
    siteNav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
};

if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
        const willOpen = navToggle.getAttribute("aria-expanded") !== "true";

        navToggle.setAttribute("aria-expanded", String(willOpen));
        navToggle.setAttribute("aria-label", willOpen ? "Close navigation" : "Open navigation");
        siteNav.classList.toggle("is-open", willOpen);
        document.body.classList.toggle("nav-open", willOpen);
    });

    siteNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeNavigation);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeNavigation();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 780) closeNavigation();
    });
}

document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
});

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12 });

    revealItems.forEach((item) => revealObserver.observe(item));
} else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
}

const readingProgress = document.querySelector("[data-reading-progress]");
const articleBody = document.querySelector(".article-body");

if (readingProgress && articleBody) {
    const updateReadingProgress = () => {
        const articleTop = articleBody.getBoundingClientRect().top + window.scrollY;
        const articleHeight = articleBody.offsetHeight;
        const viewportOffset = window.innerHeight * 0.55;
        const distanceRead = window.scrollY + viewportOffset - articleTop;
        const progress = Math.min(1, Math.max(0, distanceRead / articleHeight));

        readingProgress.style.width = `${progress * 100}%`;
    };

    updateReadingProgress();
    window.addEventListener("scroll", updateReadingProgress, { passive: true });
    window.addEventListener("resize", updateReadingProgress);
}
