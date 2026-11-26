/* Shared Light / Dark Segmented Theme Switcher for Prayer & Fitness pages */

(function initTheme() {
  const STORAGE_KEY = "salahsync_theme_v1";

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function applyTheme(theme, persist = false) {
    // Freeze transitions for one frame so Dark <-> Light flips cleanly in sync
    document.documentElement.classList.add("is-theme-switching");
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("is-theme-switching");
      });
    });
  }

  // Apply immediately so there is zero flash on load
  document.documentElement.setAttribute("data-theme", getSavedTheme());
  document.documentElement.setAttribute("data-panel-view", "on");

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getSavedTheme(), false);

    document.querySelectorAll("[data-set-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyTheme(btn.dataset.setTheme, true);
      });
    });
  });
})();
