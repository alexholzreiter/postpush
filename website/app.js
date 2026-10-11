const root = document.documentElement;
const languageButtons = [...document.querySelectorAll("[data-language]")];
const storageKey = "postpush-marketing-language";

function setLanguage(language) {
  const nextLanguage = language === "de" ? "de" : "en";
  root.lang = nextLanguage;

  document.querySelectorAll("[data-en]").forEach((element) => {
    element.textContent = element.dataset[nextLanguage];
  });

  document.querySelectorAll("[data-en-aria]").forEach((element) => {
    element.setAttribute("aria-label", element.dataset[`${nextLanguage}Aria`]);
  });

  document.querySelectorAll("[data-en-src]").forEach((element) => {
    element.setAttribute("src", element.dataset[`${nextLanguage}Src`]);
  });
  document.querySelectorAll("[data-en-alt]").forEach((element) => {
    element.setAttribute("alt", element.dataset[`${nextLanguage}Alt`]);
  });

  languageButtons.forEach((button) => {
    const active = button.dataset.language === nextLanguage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll(".copy-button").forEach((button) => {
    button.setAttribute("aria-label", button.dataset[`${nextLanguage}Label`]);
  });

  updateMenuLabel();

  try {
    localStorage.setItem(storageKey, nextLanguage);
  } catch {
    // The language switch remains usable when storage is unavailable.
  }
}

function updateMenuLabel() {
  const button = document.querySelector(".menu-button");
  if (!button) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  const label = root.lang === "de"
    ? (expanded ? "Menü schließen" : "Menü öffnen")
    : (expanded ? "Close menu" : "Open menu");
  button.setAttribute("aria-label", label);
}

let initialLanguage = "en";
try {
  initialLanguage = localStorage.getItem(storageKey) || "en";
} catch {
  initialLanguage = "en";
}
setLanguage(initialLanguage);
languageButtons.forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.language)));

const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");

menuButton?.addEventListener("click", () => {
  const expanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!expanded));
  navLinks.classList.toggle("open", !expanded);
  updateMenuLabel();
});

navLinks?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  menuButton?.setAttribute("aria-expanded", "false");
  navLinks.classList.remove("open");
  updateMenuLabel();
}));

const installTabs = [...document.querySelectorAll("[data-install-tab]")];
const installPanels = [...document.querySelectorAll("[data-install-panel]")];

function selectInstallTab(name) {
  installTabs.forEach((tab) => {
    const selected = tab.dataset.installTab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  installPanels.forEach((panel) => {
    const selected = panel.dataset.installPanel === name;
    panel.classList.toggle("active", selected);
    panel.hidden = !selected;
  });
}

installTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectInstallTab(tab.dataset.installTab));
  tab.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const target = installTabs[(index + offset + installTabs.length) % installTabs.length];
    selectInstallTab(target.dataset.installTab);
    target.focus();
  });
});

document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = decodeURIComponent(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(value);
      const label = button.querySelector("span");
      const previous = label.textContent;
      label.textContent = root.lang === "de" ? "Kopiert" : "Copied";
      button.classList.add("copied");
      window.setTimeout(() => {
        label.textContent = previous;
        button.classList.remove("copied");
      }, 1600);
    } catch {
      window.prompt(root.lang === "de" ? "Kopieren:" : "Copy:", value);
    }
  });
});

document.getElementById("year").textContent = String(new Date().getFullYear());

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
}
