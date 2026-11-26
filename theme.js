/* Shared Light / Dark Segmented Theme Switcher, PWA Theme-Color & Mobile Accordion Sync */

(function initTheme() {
  const STORAGE_KEY = "salahsync_theme_v1";
  const DARK_META = "#0a0a0a";
  const LIGHT_META = "#ebf0ed";

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function syncThemeColorMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "light" ? LIGHT_META : DARK_META);
    }
  }

  function applyTheme(theme, persist = false) {
    // Freeze transitions for one frame so Dark <-> Light flips cleanly in sync
    document.documentElement.classList.add("is-theme-switching");
    document.documentElement.setAttribute("data-theme", theme);
    syncThemeColorMeta(theme);

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

  function syncMobileAccordions() {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    document.querySelectorAll("details.sidebar-accordion").forEach((el) => {
      if (isDesktop) {
        el.open = true;
      } else if (!el.dataset.userToggled) {
        el.open = false;
      }
    });
  }

  // Apply immediately so there is zero flash on load
  const initialTheme = getSavedTheme();
  document.documentElement.setAttribute("data-theme", initialTheme);
  document.documentElement.setAttribute("data-panel-view", "on");
  syncThemeColorMeta(initialTheme);

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getSavedTheme(), false);

    document.querySelectorAll("[data-set-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyTheme(btn.dataset.setTheme, true);
      });
    });

    document.querySelectorAll("details.sidebar-accordion").forEach((el) => {
      el.addEventListener("toggle", () => {
        if (!window.matchMedia("(min-width: 768px)").matches) {
          el.dataset.userToggled = "true";
        }
      });
    });

    syncMobileAccordions();
    window.matchMedia("(min-width: 768px)").addEventListener("change", syncMobileAccordions);
  });
})();
