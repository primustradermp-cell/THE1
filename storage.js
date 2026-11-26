/* SalahSync / GymSync — Shared localStorage Persistence & Hydration Layer */

(function initAppStorage(global) {
  const KEYS = {
    PRAYER_LOGS: "preston_prayer_logs_v1",
    PRAYER_META: "preston_prayer_meta_v1",
    PRAYER_SETTINGS: "preston_prayer_settings_v2",
    FITNESS_LOGS: "salahsync_fitness_logs_v1",
    FITNESS_PLAN: "salahsync_fitness_plan_v1",
    THEME: "salahsync_theme_v1",
  };

  const PRAYERS = [
    { key: "Fajr", label: "Fajr" },
    { key: "Dhuhr", label: "Dhuhr" },
    { key: "Asr", label: "Asr" },
    { key: "Maghrib", label: "Maghrib" },
    { key: "Isha", label: "Isha" },
  ];

  const WEEKDAYS = [
    { id: 1, short: "Mon", full: "Monday" },
    { id: 2, short: "Tue", full: "Tuesday" },
    { id: 3, short: "Wed", full: "Wednesday" },
    { id: 4, short: "Thu", full: "Thursday" },
    { id: 5, short: "Fri", full: "Friday" },
    { id: 6, short: "Sat", full: "Saturday" },
    { id: 0, short: "Sun", full: "Sunday" },
  ];

  // Calibrated to Madina Masjid (27 William Henry St, Preston PR1 4XH) on Masjid247
  const DEFAULT_PRAYER_SETTINGS = {
    city: "Madina Masjid, Preston",
    lat: 53.7632,
    lng: -2.7031,
    tz: "Europe/London",
    method: 99,
    fajrAngle: 15.5,
    ishaAngle: 15.0,
    school: 1, // Hanafi
    latAdj: 3, // Angle-based for northern UK
    tune: {
      Fajr: 6,
      Sunrise: 0,
      Dhuhr: 5,
      Asr: 0,
      Maghrib: 3,
      Isha: -1,
    },
  };

  const DEFAULT_FITNESS_PLAN = {
    1: { title: "Push", exercises: [] },
    2: { title: "Pull", exercises: [] },
    3: { title: "Legs", exercises: [] },
    4: { title: "Upper", exercises: [] },
    5: { title: "Full Body", exercises: [] },
    6: { title: "Arms & Cardio", exercises: [] },
    0: { title: "Rest", exercises: [] },
  };

  // In-memory fallback if localStorage is unavailable (e.g. strict privacy mode)
  const memoryFallback = {};

  function safeReadObject(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
      return fallback;
    } catch {
      return Object.prototype.hasOwnProperty.call(memoryFallback, key)
        ? memoryFallback[key]
        : fallback;
    }
  }

  function safeWriteObject(key, value) {
    memoryFallback[key] = value;
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function hasKey(key) {
    try {
      return global.localStorage.getItem(key) !== null;
    } catch {
      return Object.prototype.hasOwnProperty.call(memoryFallback, key);
    }
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function makeExerciseId() {
    return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function normalizeExercise(ex, resetDone = false) {
    let setList;
    if (Array.isArray(ex && ex.setList) && ex.setList.length > 0) {
      setList = ex.setList.map((s) => ({
        reps: String((s && s.reps) ?? "10"),
        weight: String((s && s.weight) ?? ""),
        done: resetDone ? false : Boolean(s && s.done),
      }));
    } else {
      const count = Math.max(1, Math.min(30, Number(ex && ex.sets) || 3));
      const reps = String((ex && ex.reps) ?? "10");
      const weight = String((ex && ex.weight) ?? "");
      const done = resetDone ? false : Boolean(ex && ex.done);
      setList = Array.from({ length: count }, () => ({ reps, weight, done }));
    }

    const allDone = setList.length > 0 && setList.every((s) => s.done);
    return {
      id: (ex && ex.id) || makeExerciseId(),
      name: String((ex && ex.name) || "Exercise"),
      done: resetDone ? false : Boolean((ex && ex.done) || allDone),
      setList,
    };
  }

  /* ---------- Prayer Persistence ---------- */

  function countDayPrayers(logs, key) {
    const log = (logs && logs[key]) || {};
    return PRAYERS.reduce((acc, p) => acc + (log[p.key] ? 1 : 0), 0);
  }

  function computePrayerStreaks(logs) {
    const now = new Date();
    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const c = countDayPrayers(logs, toDateKey(d));
      if (c === 5) currentStreak++;
      else if (i === 0) continue;
      else break;
    }

    const sortedKeys = Object.keys(logs || {}).sort();
    let bestStreak = currentStreak;
    let run = 0;
    let prev = null;
    for (const k of sortedKeys) {
      if (countDayPrayers(logs, k) === 5) {
        const dt = new Date(k + "T00:00:00");
        run = prev && (dt - prev) / 86400000 === 1 ? run + 1 : 1;
        if (run > bestStreak) bestStreak = run;
        prev = dt;
      } else {
        run = 0;
        prev = null;
      }
    }

    return { currentStreak, bestStreak };
  }

  function loadPrayerSettings() {
    const parsed = safeReadObject(KEYS.PRAYER_SETTINGS, null);
    if (!parsed) {
      return { ...DEFAULT_PRAYER_SETTINGS, tune: { ...DEFAULT_PRAYER_SETTINGS.tune } };
    }
    return {
      ...DEFAULT_PRAYER_SETTINGS,
      ...parsed,
      tune: { ...DEFAULT_PRAYER_SETTINGS.tune, ...(parsed.tune || {}) },
    };
  }

  function savePrayerSettings(settings) {
    return safeWriteObject(KEYS.PRAYER_SETTINGS, settings);
  }

  function loadPrayerLogs() {
    return safeReadObject(KEYS.PRAYER_LOGS, {});
  }

  function savePrayerLogs(logs) {
    const ok = safeWriteObject(KEYS.PRAYER_LOGS, logs);
    const { currentStreak, bestStreak } = computePrayerStreaks(logs);
    safeWriteObject(KEYS.PRAYER_META, {
      currentStreak,
      bestStreak,
      updatedAt: new Date().toISOString(),
    });
    return ok;
  }

  function loadPrayerMeta() {
    return safeReadObject(KEYS.PRAYER_META, { currentStreak: 0, bestStreak: 0 });
  }

  /* ---------- Fitness Persistence ---------- */

  function loadFitnessPlan() {
    const saved = safeReadObject(KEYS.FITNESS_PLAN, null);
    const merged = {};
    for (const w of WEEKDAYS) {
      const hasSavedDay = saved && Object.prototype.hasOwnProperty.call(saved, w.id) && saved[w.id];
      const src = hasSavedDay ? saved[w.id] : DEFAULT_FITNESS_PLAN[w.id];
      const exList = Array.isArray(src.exercises)
        ? src.exercises.map((ex) => normalizeExercise(ex, true))
        : [];
      merged[w.id] = {
        title: src.title !== undefined ? String(src.title) : "",
        exercises: exList,
      };
    }
    return merged;
  }

  function saveFitnessPlan(plan) {
    return safeWriteObject(KEYS.FITNESS_PLAN, plan);
  }

  function loadFitnessLogs() {
    return safeReadObject(KEYS.FITNESS_LOGS, {});
  }

  function saveFitnessLogs(logs) {
    return safeWriteObject(KEYS.FITNESS_LOGS, logs);
  }

  /* ---------- Theme Persistence ---------- */

  function loadTheme() {
    try {
      return global.localStorage.getItem(KEYS.THEME) === "light" ? "light" : "dark";
    } catch {
      return memoryFallback[KEYS.THEME] === "light" ? "light" : "dark";
    }
  }

  function saveTheme(theme) {
    const normalized = theme === "light" ? "light" : "dark";
    memoryFallback[KEYS.THEME] = normalized;
    try {
      global.localStorage.setItem(KEYS.THEME, normalized);
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- Cross-Page & Mobile Lifecycle Sync ---------- */

  function subscribeSync(onRehydrate, onFlush) {
    global.addEventListener("storage", () => {
      if (typeof onRehydrate === "function") onRehydrate();
    });
    global.addEventListener("pageshow", (e) => {
      if (e.persisted && typeof onRehydrate === "function") onRehydrate();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && typeof onRehydrate === "function") {
        onRehydrate();
      } else if (document.visibilityState === "hidden" && typeof onFlush === "function") {
        onFlush();
      }
    });
    global.addEventListener("pagehide", () => {
      if (typeof onFlush === "function") onFlush();
    });
  }

  global.AppStorage = {
    KEYS,
    PRAYERS,
    WEEKDAYS,
    DEFAULT_PRAYER_SETTINGS,
    DEFAULT_FITNESS_PLAN,
    hasKey,
    safeReadObject,
    safeWriteObject,
    makeExerciseId,
    normalizeExercise,
    countDayPrayers,
    computePrayerStreaks,
    loadPrayerSettings,
    savePrayerSettings,
    loadPrayerLogs,
    savePrayerLogs,
    loadPrayerMeta,
    loadFitnessPlan,
    saveFitnessPlan,
    loadFitnessLogs,
    saveFitnessLogs,
    loadTheme,
    saveTheme,
    subscribeSync,
  };
})(window);
