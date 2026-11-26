/* Shared Light / Dark Segmented Theme Switcher for Prayer & Fitness pages */

(function initTheme() {
  const STORAGE_KEY = "salahsync_theme_v1";

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function applyTheme(theme, persist = false) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Ignore storage errors
      }
    }

    document.querySelectorAll("[data-set-theme]").forEach((btn) => {
      const active = btn.dataset.setTheme === theme;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  // Apply immediately so there is zero flash on load
  const initial = getSavedTheme();
  document.documentElement.setAttribute("data-theme", initial);

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getSavedTheme(), false);

    document.querySelectorAll("[data-set-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyTheme(btn.dataset.setTheme, true);
      });
    });
  });
})();
