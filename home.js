/* Home — Unified Daily Prayer & Fitness Discipline Overview (Synced with Prayer & Fitness Storage) */

const STORAGE_PRAYER_LOGS = "preston_prayer_logs_v1";
const STORAGE_PRAYER_SETTINGS = "preston_prayer_settings_v2";
const STORAGE_FITNESS_LOGS = "salahsync_fitness_logs_v1";
const STORAGE_FITNESS_PLAN = "salahsync_fitness_plan_v1";

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

const DEFAULT_PLAN = {
  1: { title: "Push", exercises: [] },
  2: { title: "Pull", exercises: [] },
  3: { title: "Legs", exercises: [] },
  4: { title: "Upper", exercises: [] },
  5: { title: "Full Body", exercises: [] },
  6: { title: "Arms & Cardio", exercises: [] },
  0: { title: "Rest", exercises: [] },
};

const DEFAULT_PRAYER_SETTINGS = {
  city: "Madina Masjid, Preston",
  lat: 53.7632,
  lng: -2.7031,
  tz: "Europe/London",
  method: 99,
  fajrAngle: 15.5,
  ishaAngle: 15.0,
  school: 1,
  latAdj: 3,
  tune: {
    Fajr: 6,
    Sunrise: 0,
    Dhuhr: 5,
    Asr: 0,
    Maghrib: 3,
    Isha: -1,
  },
};

const REFLECTIONS = [
  {
    source: "Qur’an 13:28",
    quote: "“Verily, in the remembrance of Allah do hearts find rest.”",
  },
  {
    source: "Qur’an 4:103",
    quote: "“Indeed, prayer has been decreed upon the believers at specified times.”",
  },
  {
    source: "Qur’an 94:5",
    quote: "“For indeed, with hardship comes ease.”",
  },
  {
    source: "Prophet Muhammad ﷺ",
    quote: "“The most beloved deeds to Allah are those done consistently, even if small.”",
  },
  {
    source: "Qur’an 14:7",
    quote: "“If you are grateful, I will surely increase you in favor.”",
  },
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 48; // r = 48

const homeState = {
  settings: loadPrayerSettings(),
  prayerLogs: loadJSON(STORAGE_PRAYER_LOGS, {}),
  fitnessLogs: loadJSON(STORAGE_FITNESS_LOGS, {}),
  fitnessPlan: loadFitnessPlan(),
  todayTimings: null,
  todayHijri: "",
  reflectionIndex: getDayOfYear(new Date()) % REFLECTIONS.length,
};

/* ---------- Storage & Helpers ---------- */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadPrayerSettings() {
  const saved = loadJSON(STORAGE_PRAYER_SETTINGS, null);
  if (!saved) return { ...DEFAULT_PRAYER_SETTINGS, tune: { ...DEFAULT_PRAYER_SETTINGS.tune } };
  return {
    ...DEFAULT_PRAYER_SETTINGS,
    ...saved,
    tune: { ...DEFAULT_PRAYER_SETTINGS.tune, ...(saved.tune || {}) },
  };
}

function loadFitnessPlan() {
  const saved = loadJSON(STORAGE_FITNESS_PLAN, null);
  const merged = {};
  for (const w of WEEKDAYS) {
    const src = saved && saved[w.id] ? saved[w.id] : DEFAULT_PLAN[w.id];
    merged[w.id] = {
      title: src.title || "",
      exercises: Array.isArray(src.exercises) ? src.exercises : [],
    };
  }
  return merged;
}

function savePrayerLogs() {
  localStorage.setItem(STORAGE_PRAYER_LOGS, JSON.stringify(homeState.prayerLogs));
}

function saveFitnessLogs() {
  localStorage.setItem(STORAGE_FITNESS_LOGS, JSON.stringify(homeState.fitnessLogs));
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return toDateKey(new Date());
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function cleanTime(raw) {
  return raw ? String(raw).split(" ")[0] : "--:--";
}

function parseSeconds(raw) {
  const str = cleanTime(raw);
  const parts = str.split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 3600 + parts[1] * 60;
}

function getTimeInZone(tz) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const s = Number(parts.find((p) => p.type === "second")?.value || 0);
  return {
    h,
    m,
    s,
    text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    totalSeconds: h * 3600 + m * 60 + s,
  };
}

function formatHMS(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function classifyTrainingCategory(title) {
  const t = (title || "").trim().toLowerCase();
  if (!t) return { label: "UNSCHEDULED", isRest: false };
  if (t.includes("rest") || t.includes("recovery") || t.includes("off")) return { label: "RECOVERY", isRest: true };
  if (t.includes("cardio") || t.includes("run") || t.includes("hiit")) return { label: "CONDITIONING", isRest: false };
  return { label: "STRENGTH", isRest: false };
}

function countDayPrayers(key) {
  const log = homeState.prayerLogs[key] || {};
  return PRAYERS.reduce((acc, p) => acc + (log[p.key] ? 1 : 0), 0);
}

function isGymDay(key) {
  const log = homeState.fitnessLogs[key];
  return Boolean(log && log.attended);
}

/* ---------- AlAdhan API Sync (Identical Profile to Prayer Page) ---------- */

function buildAlAdhanQuery() {
  const s = homeState.settings;
  const t = s.tune || DEFAULT_PRAYER_SETTINGS.tune;
  const tuneStr = [
    0,
    Number(t.Fajr) || 0,
    Number(t.Sunrise) || 0,
    Number(t.Dhuhr) || 0,
    Number(t.Asr) || 0,
    Number(t.Maghrib) || 0,
    0,
    Number(t.Isha) || 0,
    0,
  ].join(",");

  const params = new URLSearchParams({
    latitude: String(s.lat),
    longitude: String(s.lng),
    method: String(s.method),
    school: String(s.school),
    latitudeAdjustmentMethod: String(s.latAdj),
    tune: tuneStr,
  });
  if (Number(s.method) === 99) {
    params.set("methodSettings", `${s.fajrAngle},0 min,${s.ishaAngle}`);
  }
  return params.toString();
}

async function fetchTodayTimings() {
  const dot = document.getElementById("home-api-dot");
  const cityLabel = document.getElementById("home-status-city");
  const shortCity = homeState.settings.city.split(",")[0];
  if (cityLabel) cityLabel.textContent = shortCity;
  if (dot) {
    dot.classList.add("is-loading");
    dot.classList.remove("is-error");
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?${buildAlAdhanQuery()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 200 || !json.data) throw new Error("Unexpected payload");

    homeState.todayTimings = json.data.timings;
    const h = json.data.date.hijri;
    homeState.todayHijri = `${h.day} ${h.month.en} ${h.year} AH`;

    const hijriEl = document.getElementById("home-hijri-sub");
    if (hijriEl) hijriEl.textContent = `${homeState.todayHijri} · ${shortCity}`;

    if (dot) dot.classList.remove("is-loading", "is-error");
    renderAll();
  } catch (err) {
    console.error("Home AlAdhan fetch failed:", err);
    const hijriEl = document.getElementById("home-hijri-sub");
    if (hijriEl) hijriEl.textContent = shortCity;
    if (dot) {
      dot.classList.remove("is-loading");
      dot.classList.add("is-error");
    }
  }
}

/* ---------- Prayer Window Calculation ---------- */

function getPrayerPhaseInfo() {
  if (!homeState.todayTimings) {
    return { currentKey: null, activeWindowKey: null, next: null };
  }
  const nowSec = getTimeInZone(homeState.settings.tz).totalSeconds;

  let currentKey = null;
  let next = null;

  for (let i = 0; i < PRAYERS.length; i++) {
    const p = PRAYERS[i];
    const pSec = parseSeconds(homeState.todayTimings[p.key]);
    if (pSec === null) continue;
    if (pSec <= nowSec) {
      currentKey = p.key;
    } else if (!next) {
      next = {
        key: p.key,
        time: cleanTime(homeState.todayTimings[p.key]),
        remainingSec: pSec - nowSec,
        tomorrow: false,
      };
    }
  }

  if (!next) {
    const fajrSec = parseSeconds(homeState.todayTimings.Fajr);
    if (fajrSec !== null) {
      next = {
        key: "Fajr",
        time: cleanTime(homeState.todayTimings.Fajr),
        remainingSec: 86400 - nowSec + fajrSec,
        tomorrow: true,
      };
    }
  }

  return { currentKey, activeWindowKey: currentKey || "Isha", next };
}

/* ---------- Rendering ---------- */

function setRingProgress(elId, ratio) {
  const el = document.getElementById(elId);
  if (!el) return;
  const clamped = Math.min(1, Math.max(0, ratio));
  el.style.strokeDasharray = `${RING_CIRCUMFERENCE.toFixed(2)}`;
  el.style.strokeDashoffset = `${(RING_CIRCUMFERENCE * (1 - clamped)).toFixed(2)}`;
}

function updateLiveClockAndHeader() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dateEl = document.getElementById("home-date-title");
  if (dateEl) dateEl.textContent = dateStr;

  const uk = getTimeInZone(homeState.settings.tz);
  const clockEl = document.getElementById("home-clock");
  if (clockEl) clockEl.textContent = uk.text;

  if (!homeState.todayTimings) return;

  const { activeWindowKey, next } = getPrayerPhaseInfo();
  if (next) {
    const nextLbl = document.getElementById("home-next-label");
    const nextCd = document.getElementById("home-next-countdown");
    if (nextLbl) nextLbl.textContent = `Next: ${next.key} ${next.time}`;
    if (nextCd) nextCd.textContent = `in ${formatHMS(next.remainingSec)}`;
  }

  const winEl = document.getElementById("ring-prayer-window");
  if (winEl && activeWindowKey) {
    winEl.textContent = `Window · ${activeWindowKey}`;
  }

  if (uk.s === 0) {
    renderQuickPrayerStrip();
  }
}

function renderDisciplineRings() {
  const now = new Date();
  const tKey = todayKey();

  // 1. Left Ring: Prayer Today
  const donePrayers = countDayPrayers(tKey);
  document.getElementById("ring-prayer-val").textContent = `${donePrayers} / 5`;
  setRingProgress("ring-prayer-arc", donePrayers / 5);

  const { activeWindowKey } = getPrayerPhaseInfo();
  const winEl = document.getElementById("ring-prayer-window");
  if (winEl) {
    winEl.textContent = activeWindowKey ? `Window · ${activeWindowKey}` : "Window · Syncing";
  }

  // 2. Right Ring: Weekly Split (Mon–Sun)
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);

  let weekGymDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (isGymDay(toDateKey(d))) weekGymDays++;
  }

  document.getElementById("ring-gym-val").textContent = `${weekGymDays} / 7`;
  setRingProgress("ring-gym-arc", weekGymDays / 7);

  const wdInfo = WEEKDAYS.find((w) => w.id === now.getDay()) || WEEKDAYS[0];
  const todayLog = homeState.fitnessLogs[tKey];
  const todayPlan = homeState.fitnessPlan[now.getDay()] || { title: "" };
  const splitTitle = (todayLog && todayLog.title) || todayPlan.title || "Unscheduled";
  document.getElementById("ring-gym-split").textContent = `${wdInfo.short} · ${splitTitle}`;

  // 3. Footer Metrics: Prayer Streak & Gym Days This Month
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const c = countDayPrayers(toDateKey(d));
    if (c === 5) streak++;
    else if (i === 0) continue;
    else break;
  }

  const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
  let gymMonthCount = 0;
  for (const k of Object.keys(homeState.fitnessLogs)) {
    if (k.startsWith(curMonthPrefix) && isGymDay(k)) gymMonthCount++;
  }

  document.getElementById("home-prayer-streak").textContent = `${streak} d`;
  document.getElementById("home-gym-month").textContent = `${gymMonthCount} ${gymMonthCount === 1 ? "day" : "days"}`;
}

function renderQuickPrayerStrip() {
  const tKey = todayKey();
  const todayLog = homeState.prayerLogs[tKey] || {};
  const { currentKey, next } = getPrayerPhaseInfo();
  const grid = document.getElementById("home-prayer-grid");
  if (!grid) return;

  grid.innerHTML = "";

  for (const p of PRAYERS) {
    const isDone = Boolean(todayLog[p.key]);
    const isCurrent = currentKey === p.key;
    const isNext = next && next.key === p.key && !next.tomorrow;
    const timeStr = homeState.todayTimings ? cleanTime(homeState.todayTimings[p.key]) : "--:--";

    const cls = [
      "hp-tile",
      isDone ? "is-done" : "",
      isCurrent ? "is-current" : "",
      isNext ? "is-next" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const glyph = isDone ? "✓" : isNext ? "●" : isCurrent ? "○" : "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cls;
    btn.setAttribute("aria-pressed", String(isDone));
    btn.setAttribute("title", `${p.label} ${timeStr} — Tap to toggle`);
    btn.innerHTML = `
      <span class="hp-check" aria-hidden="true">${glyph}</span>
      <span class="hp-name">${p.label}</span>
      <span class="hp-time mono">${timeStr}</span>
    `;

    btn.addEventListener("click", () => {
      if (!homeState.prayerLogs[tKey]) homeState.prayerLogs[tKey] = {};
      homeState.prayerLogs[tKey][p.key] = !homeState.prayerLogs[tKey][p.key];
      savePrayerLogs();
      renderAll();
    });

    grid.appendChild(btn);
  }
}

function renderTodayTrainingCard() {
  const now = new Date();
  const tKey = todayKey();
  const wd = now.getDay();
  const wdInfo = WEEKDAYS.find((w) => w.id === wd) || WEEKDAYS[0];
  const planDay = homeState.fitnessPlan[wd] || { title: "", exercises: [] };
  const savedLog = homeState.fitnessLogs[tKey];
  const went = isGymDay(tKey);

  const title = (savedLog && savedLog.title) || planDay.title || "Workout";
  const category = classifyTrainingCategory(title);

  document.getElementById("home-workout-title").textContent = `${wdInfo.full} · ${title}`;
  const catEl = document.getElementById("home-workout-cat");
  catEl.textContent = category.label;
  catEl.className = `badge ${category.isRest ? "badge-bronze" : "badge-accent"}`;

  // Compute exercise count & sets progress cleanly (preserving preset + daily log sync)
  const loggedExercises = savedLog && Array.isArray(savedLog.exercises) ? savedLog.exercises : null;
  const effectiveList = loggedExercises && loggedExercises.length ? loggedExercises : planDay.exercises || [];
  let totalSets = 0;
  let doneSets = 0;

  for (const ex of effectiveList) {
    if (Array.isArray(ex.setList) && ex.setList.length) {
      totalSets += ex.setList.length;
      doneSets += ex.setList.filter((s) => s.done).length;
    } else {
      const sCount = Number(ex.sets) || 3;
      totalSets += sCount;
      if (ex.done) doneSets += sCount;
    }
  }

  const metaEl = document.getElementById("home-workout-meta");
  if (category.isRest && !effectiveList.length) {
    metaEl.textContent = "Scheduled recovery day — rest up or log a light session.";
  } else if (!effectiveList.length) {
    metaEl.textContent = `No exercises scheduled for ${wdInfo.full} yet.`;
  } else if (doneSets > 0) {
    metaEl.textContent = `${effectiveList.length} ${effectiveList.length === 1 ? "exercise" : "exercises"} · ${doneSets} / ${totalSets} sets completed`;
  } else {
    metaEl.textContent = `${effectiveList.length} ${effectiveList.length === 1 ? "exercise" : "exercises"} · ${totalSets} sets planned`;
  }

  const markBtn = document.getElementById("home-btn-mark-gym");
  const markText = document.getElementById("home-btn-mark-gym-text");
  markBtn.classList.toggle("is-active", went);
  markBtn.setAttribute("aria-pressed", String(went));
  markText.textContent = went ? "Session Logged ✓" : "Mark Gym Day";
}

function renderConsistencyGrid() {
  const grid = document.getElementById("home-consistency-grid");
  if (!grid) return;

  const now = new Date();
  const tKey = todayKey();
  const tiles = [];

  let perfectPrayerDays = 0;
  let gymDays30 = 0;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = toDateKey(d);
    const pCount = countDayPrayers(key);
    const gym = isGymDay(key);

    if (pCount === 5) perfectPrayerDays++;
    if (gym) gymDays30++;

    const isToday = key === tKey;
    const dayNum = d.getDate();
    const pretty = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const title = `${pretty} · ${pCount}/5 prayers${gym ? " · Gym logged" : ""}`;

    const pClass = pCount === 5 ? "is-on" : pCount > 0 ? "is-partial" : "";
    const gClass = gym ? "is-on" : "";

    tiles.push(`
      <div class="hc-tile${isToday ? " is-today" : ""}${pCount === 5 && gym ? " is-both" : ""}" title="${title}">
        <span class="hc-day mono">${dayNum}</span>
        <span class="hc-dots" aria-hidden="true">
          <span class="hc-dot hc-dot-prayer ${pClass}"></span>
          <span class="hc-dot hc-dot-gym ${gClass}"></span>
        </span>
      </div>
    `);
  }

  grid.innerHTML = tiles.join("");
  const subEl = document.getElementById("home-consistency-sub");
  if (subEl) {
    subEl.textContent = `${perfectPrayerDays} full prayer days · ${gymDays30} gym days`;
  }
}

function renderReflection() {
  const item = REFLECTIONS[homeState.reflectionIndex % REFLECTIONS.length];
  document.getElementById("home-ref-source").textContent = item.source;
  document.getElementById("home-ref-quote").textContent = item.quote;
}

function renderAll() {
  updateLiveClockAndHeader();
  renderDisciplineRings();
  renderQuickPrayerStrip();
  renderTodayTrainingCard();
  renderConsistencyGrid();
  renderReflection();
}

/* ---------- Events ---------- */

function bindEvents() {
  document.getElementById("home-btn-mark-gym").addEventListener("click", () => {
    const tKey = todayKey();
    const wd = new Date().getDay();
    const planDay = homeState.fitnessPlan[wd] || { title: "", exercises: [] };

    if (!homeState.fitnessLogs[tKey]) {
      homeState.fitnessLogs[tKey] = {
        attended: true,
        title: planDay.title || "",
        notes: "",
        exercises: Array.isArray(planDay.exercises) ? planDay.exercises : [],
      };
    } else {
      homeState.fitnessLogs[tKey].attended = !homeState.fitnessLogs[tKey].attended;
    }

    saveFitnessLogs();
    renderAll();
  });

  document.getElementById("home-ref-next").addEventListener("click", () => {
    homeState.reflectionIndex = (homeState.reflectionIndex + 1) % REFLECTIONS.length;
    renderReflection();
  });

  // Re-sync cleanly if user returns to tab after editing on Prayer or Fitness
  window.addEventListener("storage", () => {
    homeState.prayerLogs = loadJSON(STORAGE_PRAYER_LOGS, {});
    homeState.fitnessLogs = loadJSON(STORAGE_FITNESS_LOGS, {});
    homeState.fitnessPlan = loadFitnessPlan();
    renderAll();
  });
}

function init() {
  bindEvents();
  renderAll();
  fetchTodayTimings();
  window.setInterval(updateLiveClockAndHeader, 1000);
}

init();
