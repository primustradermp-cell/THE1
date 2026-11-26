/* Shared Light/Dark Theme + Apple iOS Panel View Switcher for Prayer & Fitness */

(function initDisplayPrefs() {
  const THEME_KEY = "salahsync_theme_v1";
  const PANEL_KEY = "salahsync_panel_view_v1";

  function getSavedTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function getSavedPanelView() {
    try {
      const v = localStorage.getItem(PANEL_KEY);
      return v === "off" ? "off" : "on";
    } catch {
      return "on";
    }
  }

  function applyTheme(theme, persist = false) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
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

  function applyPanelView(mode, persist = false) {
    const isOn = mode !== "off";
    document.documentElement.setAttribute("data-panel-view", isOn ? "on" : "off");
    if (persist) {
      try {
        localStorage.setItem(PANEL_KEY, isOn ? "on" : "off");
      } catch {
        // Ignore storage errors
      }
    }

    const input = document.getElementById("panel-view-toggle");
    if (input) input.checked = isOn;
  }

  // Apply immediately before first paint (no flash)
  document.documentElement.setAttribute("data-theme", getSavedTheme());
  document.documentElement.setAttribute("data-panel-view", getSavedPanelView());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getSavedTheme(), false);
    applyPanelView(getSavedPanelView(), false);

    document.querySelectorAll("[data-set-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyTheme(btn.dataset.setTheme, true);
      });
    });

    const panelToggle = document.getElementById("panel-view-toggle");
    if (panelToggle) {
      panelToggle.addEventListener("change", (e) => {
        applyPanelView(e.target.checked ? "on" : "off", true);
      });
    }
  });
})();
