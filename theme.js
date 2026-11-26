/* Shared Light / Dark Theme Toggle for Prayer & Fitness pages */

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

    const btn = document.getElementById("theme-toggle-btn");
    const label = document.getElementById("theme-toggle-label");
    if (btn && label) {
      const isLight = theme === "light";
      btn.setAttribute("aria-pressed", String(isLight));
      btn.setAttribute("title", isLight ? "Switch to Dark Mode" : "Switch to Light Mode");
      label.textContent = isLight ? "Dark" : "Light";
    }

    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  // Apply immediately so there is no flash on load
  const initial = getSavedTheme();
  document.documentElement.setAttribute("data-theme", initial);

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getSavedTheme(), false);
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
        applyTheme(current === "light" ? "dark" : "light", true);
      });
    }
  });
})();
