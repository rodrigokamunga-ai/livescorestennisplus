(() => {
  "use strict";

  const THEME_KEY = "tennispro-theme";

  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return "dark";
  }

  function updateThemeMeta(theme) {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        "content",
        theme === "light" ? "#f4f7fb" : "#0f1726"
      );
    }
  }

  function updateThemeButtons(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const icon = button.querySelector("ion-icon");

      if (theme === "light") {
        button.setAttribute("aria-label", "Ativar modo escuro");
        button.setAttribute("title", "Ativar modo escuro");

        if (icon) {
          icon.setAttribute("name", "moon-outline");
        }
      } else {
        button.setAttribute("aria-label", "Ativar modo claro");
        button.setAttribute("title", "Ativar modo claro");

        if (icon) {
          icon.setAttribute("name", "sunny-outline");
        }
      }
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeMeta(theme);
    updateThemeButtons(theme);
  }

  function toggleTheme() {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "dark";

    const nextTheme = currentTheme === "light" ? "dark" : "light";

    applyTheme(nextTheme);
  }

  function initTheme() {
    const initialTheme = getPreferredTheme();

    document.documentElement.setAttribute("data-theme", initialTheme);
    updateThemeMeta(initialTheme);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", toggleTheme);
    });

    updateThemeButtons(initialTheme);
  }

  initTheme();

  window.TennisProTheme = {
    applyTheme,
    toggleTheme,
    getPreferredTheme
  };
})();
