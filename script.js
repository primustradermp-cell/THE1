/* SalahSync — Minimalist Preston Prayer Dashboard, Live Countdown & Monthly Timetable (AlAdhan API) */

const PRAYERS = [
  { key: "Fajr", label: "Fajr" },
  { key: "Dhuhr", label: "Dhuhr" },
  { key: "Asr", label: "Asr" },
  { key: "Maghrib", label: "Maghrib" },
  { key: "Isha", label: "Isha" },
];

const METHOD_NAMES = {
  99: "Custom Angles",
  15: "Moonsighting Committee",
  3: "Muslim World League",
  2: "ISNA",
  1: "Karachi",
  5: "Egyptian",
  4: "Umm Al-Qura",
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
    quote: "“Your smile in the face of your brother is charity.”",
  },
  {
    source: "Qur’an 14:7",
    quote: "“If you are grateful, I will surely increase you in favor.”",
  },
];

const STORAGE_LOGS_KEY = "preston_prayer_logs_v1";
const STORAGE_SETTINGS_KEY = "preston_prayer_settings_v2";

// Calibrated to Madina Masjid (27 William Henry St, Preston PR1 4XH) on Masjid247
const DEFAULT_SETTINGS = {
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

const state = {
  activeView: "overview",
  settings: loadSettings(),
  logs: loadLogs(),
  todayTimings: null,
  todayHijri: "",
  calendarMonth: new Date().getMonth() + 1,
  calendarYear: new Date().getFullYear(),
  calendarData: [],
  logCalYear: new Date().getFullYear(),
  logCalMonth: new Date().getMonth(), // 0-indexed
  selectedLogDate: toDateKey(new Date()),
  reflectionIndex: 0,
};

/* ---------- Persistence ---------- */

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, tune: { ...DEFAULT_SETTINGS.tune } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      tune: { ...DEFAULT_SETTINGS.tune, ...(parsed.tune || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, tune: { ...DEFAULT_SETTINGS.tune } };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_LOGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLogs() {
  localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(state.logs));
}

/* ---------- Time Helpers ---------- */

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return toDateKey(new Date());
}

function cleanTime(t) {
  return t ? t.split(" ")[0] : "--:--";
}

function parseSeconds(hhmm) {
  const [h, m] = cleanTime(hhmm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 3600 + m * 60;
}

function getTimeInZone(timeZone) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  const h = Number(get("hour"));
  const m = Number(get("minute"));
  const s = Number(get("second"));
  return {
    h,
    m,
    s,
    text: `${get("hour")}:${get("minute")}:${get("second")}`,
    hm: `${get("hour")}:${get("minute")}`,
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

/* ---------- AlAdhan API ---------- */

function buildAlAdhanQuery() {
  const s = state.settings;
  const t = s.tune || DEFAULT_SETTINGS.tune;
  // tune order: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
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

function setApiStatus(text, stateMode = "live") {
  const label = document.getElementById("api-status-text");
  const dot = document.getElementById("api-dot");
  if (label) label.textContent = text;
  if (dot) {
    dot.classList.toggle("is-error", stateMode === "error" || stateMode === true);
    dot.classList.toggle("is-loading", stateMode === "loading");
  }
}

async function fetchTodayTimings() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?${buildAlAdhanQuery()}`;

  const shortCity = state.settings.city.split(",")[0];
  const heroFocal = document.getElementById("hero-focal");
  if (heroFocal && !state.todayTimings) heroFocal.classList.add("is-loading");
  setApiStatus(`Syncing ${shortCity}…`, "loading");

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 200 || !json.data) throw new Error("Unexpected payload");

    state.todayTimings = json.data.timings;
    const h = json.data.date.hijri;
    state.todayHijri = `${h.day} ${h.month.en} ${h.year} AH`;

    document.getElementById("hero-hijri-line").textContent = state.todayHijri;
    document.getElementById("sunrise-pill").textContent = `Sunrise ${cleanTime(state.todayTimings.Sunrise)}`;

    if (heroFocal) heroFocal.classList.remove("is-loading");
    setApiStatus(`${shortCity} Live`, "live");
    renderAll();
  } catch (err) {
    console.error("AlAdhan today fetch failed:", err);
    if (heroFocal) heroFocal.classList.remove("is-loading");
    setApiStatus("API Offline", "error");
  }
}

async function fetchMonthlyCalendar(year = state.calendarYear, month = state.calendarMonth) {
  state.calendarYear = year;
  state.calendarMonth = month;

  const monthName = new Date(year, month - 1, 1).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
  document.getElementById("tt-month").textContent = monthName;
  document.getElementById("tt-body").innerHTML = `
    <tr>
      <td colspan="8" class="table-loading">
        <div class="loading-state">
          <span class="spinner" aria-hidden="true"></span>
          <span>Loading ${monthName} timetable for ${state.settings.city}…</span>
        </div>
      </td>
    </tr>`;

  const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?${buildAlAdhanQuery()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error("Invalid calendar");

    state.calendarData = json.data;
    renderTimetable();
  } catch (err) {
    console.error("AlAdhan calendar fetch failed:", err);
    document.getElementById("tt-body").innerHTML = `
      <tr>
        <td colspan="8" class="table-loading">
          <div class="empty-state">
            <div class="empty-state-icon" aria-hidden="true">
              <svg class="icon icon-md" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <div class="empty-state-title">Timetable unavailable</div>
            <div class="empty-state-sub">Could not load ${monthName} prayer times from AlAdhan API. Check your connection and try again.</div>
            <div class="empty-state-actions">
              <button type="button" class="btn btn-sm" id="tt-retry-btn">Retry</button>
            </div>
          </div>
        </td>
      </tr>`;
    const retryBtn = document.getElementById("tt-retry-btn");
    if (retryBtn) retryBtn.addEventListener("click", () => fetchMonthlyCalendar(year, month));
  }
}

/* ---------- Prayer Window Logic (Current vs. Next vs. Upcoming) ---------- */

function getPrayerPhaseInfo() {
  if (!state.todayTimings) return { currentKey: null, next: null, progressPct: 0 };
  const nowSec = getTimeInZone(state.settings.tz).totalSeconds;

  let currentKey = null;
  let next = null;

  for (let i = 0; i < PRAYERS.length; i++) {
    const p = PRAYERS[i];
    const pSec = parseSeconds(state.todayTimings[p.key]);
    if (pSec === null) continue;
    if (pSec <= nowSec) {
      currentKey = p.key;
    } else if (!next) {
      next = {
        index: i,
        key: p.key,
        time: cleanTime(state.todayTimings[p.key]),
        remainingSec: pSec - nowSec,
        tomorrow: false,
      };
    }
  }

  if (!next) {
    const fajrSec = parseSeconds(state.todayTimings.Fajr);
    if (fajrSec !== null) {
      next = {
        index: 0,
        key: "Fajr",
        time: cleanTime(state.todayTimings.Fajr),
        remainingSec: 86400 - nowSec + fajrSec,
        tomorrow: true,
      };
    }
  }

  const fajrSec = parseSeconds(state.todayTimings.Fajr) ?? 5 * 3600;
  const ishaSec = parseSeconds(state.todayTimings.Isha) ?? 19 * 3600;
  const progressPct = Math.min(100, Math.max(0, ((nowSec - fajrSec) / Math.max(1, ishaSec - fajrSec)) * 100));

  return { currentKey, next, progressPct };
}

function getDayLog(key) {
  return state.logs[key] || {};
}

function countDayPrayers(key) {
  const log = getDayLog(key);
  return PRAYERS.reduce((acc, p) => acc + (log[p.key] ? 1 : 0), 0);
}

/* ---------- Live Clocks & Focal Countdown ---------- */

function updateLiveClocks() {
  const uk = getTimeInZone(state.settings.tz);
  const makkah = getTimeInZone("Asia/Riyadh");

  const clockEl = document.getElementById("widget-clock");
  if (clockEl) clockEl.textContent = uk.text;

  const makkahEl = document.getElementById("makkah-clock");
  if (makkahEl) makkahEl.textContent = `Makkah · ${makkah.hm}`;

  if (!state.todayTimings) return;

  const { next, progressPct } = getPrayerPhaseInfo();
  if (next) {
    document.getElementById("focal-kicker").textContent = next.tomorrow ? "NEXT PRAYER · TOMORROW" : "NEXT PRAYER";
    document.getElementById("focal-prayer-name").textContent = next.key;
    document.getElementById("focal-prayer-time").textContent = next.time;
    document.getElementById("focal-countdown").textContent = formatHMS(next.remainingSec);
  }

  const railFill = document.getElementById("timeline-rail-fill");
  if (railFill) railFill.style.width = `${progressPct.toFixed(1)}%`;

  // Refresh timeline state right when a minute rolls over (catches prayer transitions cleanly)
  if (uk.s === 0) {
    renderTimeline();
  }
}

/* ---------- Render Timeline, Consolidated Daily Progress & Activity ---------- */

function renderTimeline() {
  const key = todayKey();
  const todayLog = getDayLog(key);
  const { currentKey, next } = getPrayerPhaseInfo();

  const grid = document.getElementById("hud-prayer-grid");
  grid.innerHTML = "";

  for (const p of PRAYERS) {
    const isDone = Boolean(todayLog[p.key]);
    const isNext = next && next.key === p.key && !next.tomorrow;
    const isCurrent = currentKey === p.key;
    const timeStr = state.todayTimings ? cleanTime(state.todayTimings[p.key]) : "--:--";

    let badgeText = "Upcoming";
    let checkGlyph = "";
    if (isDone) {
      badgeText = "Done";
      checkGlyph = "✓";
    } else if (isNext) {
      badgeText = "Next";
      checkGlyph = "●";
    } else if (isCurrent) {
      badgeText = "Now";
      checkGlyph = "○";
    }

    const cls = [
      "tl-card",
      isDone ? "is-done" : "",
      isCurrent ? "is-current" : "",
      isNext ? "is-next" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cls;
    btn.setAttribute("aria-pressed", String(isDone));
    btn.innerHTML = `
      <div class="tl-top">
        <span class="tl-check" aria-hidden="true">${checkGlyph}</span>
        <span class="tl-badge">${badgeText}</span>
      </div>
      <div>
        <div class="tl-name">${p.label}</div>
        <div class="tl-time">${timeStr}</div>
      </div>
    `;

    btn.addEventListener("click", () => {
      if (!state.logs[key]) state.logs[key] = {};
      state.logs[key][p.key] = !state.logs[key][p.key];
      saveLogs();
      renderAll();
    });

    grid.appendChild(btn);
  }
}

function renderAll() {
  renderTimeline();

  const key = todayKey();
  const todayLog = getDayLog(key);
  const doneToday = countDayPrayers(key);
  const pctToday = Math.round((doneToday / 5) * 100);
  const { next } = getPrayerPhaseInfo();

  // Consolidated Daily Progress Card
  document.getElementById("dp-count").textContent = `${doneToday} of 5`;
  document.getElementById("dp-pct").textContent = `${pctToday}%`;
  document.getElementById("dp-sub").textContent =
    doneToday === 5 ? "all prayers completed today" : "prayers completed today";

  document.getElementById("dp-segments").innerHTML = PRAYERS.map((p) => {
    const isDone = Boolean(todayLog[p.key]);
    const isNext = next && next.key === p.key && !next.tomorrow;
    const cls = isDone ? "is-done" : isNext ? "is-next" : "";
    return `<span class="dp-seg ${cls}" title="${p.label}"></span>`;
  }).join("");

  // 30-Day Analytics & Streak
  const now = new Date();
  const counts = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };
  let total30 = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const log = getDayLog(toDateKey(d));
    for (const p of PRAYERS) {
      if (log[p.key]) {
        counts[p.key]++;
        total30++;
      }
    }
  }

  // Week total
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  let weekSum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekSum += countDayPrayers(toDateKey(d));
  }

  // Current & Best Streak
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const c = countDayPrayers(toDateKey(d));
    if (c === 5) streak++;
    else if (i === 0) continue;
    else break;
  }

  const sortedKeys = Object.keys(state.logs).sort();
  let bestStreak = streak;
  let run = 0;
  let prev = null;
  for (const k of sortedKeys) {
    if (countDayPrayers(k) === 5) {
      const dt = new Date(k + "T00:00:00");
      run = prev && (dt - prev) / 86400000 === 1 ? run + 1 : 1;
      if (run > bestStreak) bestStreak = run;
      prev = dt;
    } else {
      run = 0;
      prev = null;
    }
  }

  const rate30 = Math.round((total30 / 150) * 100);
  document.getElementById("dp-streak").textContent = `${streak} d`;
  document.getElementById("dp-week").textContent = `${weekSum} / 35`;
  document.getElementById("dp-rate").textContent = `${rate30}%`;
  document.getElementById("analytics-best-streak").textContent = `Best streak · ${bestStreak} days`;

  // Activity 30-Day Per-Prayer Breakdown (shown only in Activity view)
  document.getElementById("breakdown-list").innerHTML = PRAYERS.map((p) => {
    const c = counts[p.key];
    const pct = Math.round((c / 30) * 100);
    return `
      <div class="bd-row">
        <span>${p.label}</span>
        <div class="bd-track"><div class="bd-fill" style="width:${pct}%"></div></div>
        <span class="mono" style="color:var(--text-muted);text-align:right">${c}/30</span>
        <span class="mono" style="text-align:right">${pct}%</span>
      </div>
    `;
  }).join("");

  renderPrayerLogCalendar();
  renderHeatmap();
  updateLiveClocks();
}

/* ---------- Monthly Prayer Log Calendar & Past-Day Catch-Up ---------- */

function fromDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function renderPrayerLogCalendar() {
  const grid = document.getElementById("pcal-grid");
  const monthLabel = document.getElementById("pcal-month-label");
  if (!grid || !monthLabel) return;

  const year = state.logCalYear;
  const month = state.logCalMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0..Sun=6

  monthLabel.textContent = firstDay.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const tKey = todayKey();
  const todayObj = fromDateKey(tKey);
  const cells = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push(`<span class="plog-cell is-empty"></span>`);
  }

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const cellDate = new Date(year, month, dayNum);
    const isFuture = cellDate > todayObj;
    const log = getDayLog(key);
    const count = countDayPrayers(key);

    const cls = [
      "plog-cell",
      isFuture ? "is-future" : "",
      !isFuture && count === 5 ? "is-complete" : "",
      !isFuture && count > 0 && count < 5 ? "is-partial" : "",
      key === tKey ? "is-today" : "",
      key === state.selectedLogDate ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const pips = PRAYERS.map((p) => `<span class="plog-pip${log[p.key] ? " is-on" : ""}"></span>`).join("");

    cells.push(`
      <button type="button" class="${cls}" data-log-date="${key}" ${isFuture ? "disabled" : ""} title="${key} · ${count}/5 prayers">
        <span class="plog-day-num">${dayNum}</span>
        <span class="plog-pips" aria-hidden="true">${pips}</span>
      </button>
    `);
  }

  grid.innerHTML = cells.join("");
  renderSelectedLogDay();
}

function renderSelectedLogDay() {
  const key = state.selectedLogDate;
  const log = getDayLog(key);
  const count = countDayPrayers(key);
  const d = fromDateKey(key);
  const isToday = key === todayKey();

  const readable = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  document.getElementById("pcal-selected-title").textContent = isToday ? `Today · ${readable}` : readable;
  document.getElementById("pcal-selected-count").textContent = `${count} / 5`;

  const list = document.getElementById("pcal-day-prayers");
  list.innerHTML = PRAYERS.map((p) => {
    const isDone = Boolean(log[p.key]);
    const stateLabel = isDone ? "Completed" : isToday ? "Not logged" : "Missed · Tap to mark";
    return `
      <button type="button" class="plog-prayer-btn${isDone ? " is-done" : ""}" data-toggle-prayer="${p.key}" aria-pressed="${isDone}">
        <span class="plog-prayer-left">
          <span class="plog-check" aria-hidden="true">${isDone ? "✓" : ""}</span>
          <span class="plog-prayer-name">${p.label}</span>
        </span>
        <span class="plog-prayer-state">${stateLabel}</span>
      </button>
    `;
  }).join("");

  const markAllBtn = document.getElementById("pcal-mark-all");
  if (markAllBtn) {
    markAllBtn.textContent = count === 5 ? "All 5 Completed ✓" : "Mark All 5 Done";
  }
}

function renderHeatmap() {
  const grid = document.getElementById("heatmap-grid");
  const monthsRow = document.getElementById("heatmap-months");
  const tooltip = document.getElementById("heatmap-tooltip");
  grid.innerHTML = "";
  monthsRow.innerHTML = "";

  const today = new Date();
  const todayStr = toDateKey(today);
  const start = new Date(today);
  start.setDate(today.getDate() - 364 - today.getDay());

  let lastMonth = -1;
  for (let i = 0; i < 53 * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (i % 7 === 0) {
      const span = document.createElement("span");
      if (d.getMonth() !== lastMonth) {
        span.textContent = d.toLocaleString("en-GB", { month: "short" });
        lastMonth = d.getMonth();
      }
      monthsRow.appendChild(span);
    }

    const key = toDateKey(d);
    const c = countDayPrayers(key);
    const lvl = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c === 4 ? 3 : 4;
    const cell = document.createElement("span");
    cell.className = `cell lvl-${lvl}${key === todayStr ? " is-today" : ""}`;
    if (d > today) cell.style.opacity = "0.25";

    const pretty = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    cell.addEventListener("mouseenter", (e) => {
      tooltip.textContent = `${pretty} · ${c}/5 prayers`;
      tooltip.hidden = false;
      tooltip.style.left = `${e.clientX + 12}px`;
      tooltip.style.top = `${e.clientY - 32}px`;
    });
    cell.addEventListener("mousemove", (e) => {
      tooltip.style.left = `${e.clientX + 12}px`;
      tooltip.style.top = `${e.clientY - 32}px`;
    });
    cell.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });
    grid.appendChild(cell);
  }
}

/* ---------- Dedicated Monthly Timetable ---------- */

function renderTimetable() {
  const now = new Date();
  const todayDay = now.getDate();
  const isCurrentMonth =
    now.getFullYear() === state.calendarYear && now.getMonth() + 1 === state.calendarMonth;

  document.getElementById("tt-body").innerHTML = state.calendarData
    .map((entry) => {
      const g = entry.date.gregorian;
      const h = entry.date.hijri;
      const t = entry.timings;
      const isToday = isCurrentMonth && Number(g.day) === todayDay;
      const isFriday = g.weekday.en === "Friday";

      const tags = [
        isToday ? `<span class="row-tag tag-today">TODAY</span>` : "",
        isFriday ? `<span class="row-tag tag-jumuah">JUMU’AH</span>` : "",
      ].join("");

      return `
        <tr class="${isToday ? "is-today-row" : ""}" ${isToday ? 'data-today-row="true"' : ""}>
          <td>${g.weekday.en.slice(0, 3)}, ${g.day} ${g.month.en.slice(0, 3)}${tags}</td>
          <td>${h.day} ${h.month.en}</td>
          <td class="t-time">${cleanTime(t.Fajr)}</td>
          <td class="t-time">${cleanTime(t.Sunrise)}</td>
          <td class="t-time">${cleanTime(t.Dhuhr)}</td>
          <td class="t-time">${cleanTime(t.Asr)}</td>
          <td class="t-time">${cleanTime(t.Maghrib)}</td>
          <td class="t-time">${cleanTime(t.Isha)}</td>
        </tr>
      `;
    })
    .join("");

  const shortCity = state.settings.city.split(",")[0];
  document.getElementById("tt-heading").textContent = `${shortCity} Monthly Timetable`;
}

function exportTimetableCSV() {
  if (!state.calendarData.length) return;
  const lines = ["Date,Weekday,Hijri,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha"];
  for (const entry of state.calendarData) {
    const g = entry.date.gregorian;
    const h = entry.date.hijri;
    const t = entry.timings;
    lines.push(
      [
        `"${g.date}"`,
        `"${g.weekday.en}"`,
        `"${h.day} ${h.month.en} ${h.year}"`,
        cleanTime(t.Fajr),
        cleanTime(t.Sunrise),
        cleanTime(t.Dhuhr),
        cleanTime(t.Asr),
        cleanTime(t.Maghrib),
        cleanTime(t.Isha),
      ].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  const slug = state.settings.city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}-timetable-${state.calendarYear}-${String(state.calendarMonth).padStart(2, "0")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Focused View Switching, Qibla & Settings ---------- */

function switchPrayerView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll("[data-prayer-view]").forEach((btn) => {
    const active = btn.dataset.prayerView === viewName;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".prayer-view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `view-${viewName}`);
  });

  const cta = document.getElementById("inspector-cta-btn");
  if (cta) {
    cta.textContent = viewName === "timetable" ? "Back to Overview" : "View Monthly Timetable";
  }

  if (viewName === "timetable") {
    const todayRow = document.querySelector('#tt-body tr[data-today-row="true"]');
    if (todayRow) todayRow.scrollIntoView({ block: "center", behavior: "instant" });
  }
}

function updateQibla() {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const lat1 = toRad(state.settings.lat);
  const lon1 = toRad(state.settings.lng);
  const lat2 = toRad(21.4225);
  const lon2 = toRad(39.8262);
  const dLon = lon2 - lon1;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;

  const shortCity = state.settings.city.split(",")[0];
  document.getElementById("wire-needle").setAttribute("transform", `rotate(${bearing.toFixed(1)} 55 55)`);
  document.getElementById("insp-qibla-deg").textContent = `${bearing.toFixed(1)}°`;
  document.getElementById("insp-qibla-sub").textContent = `ESE from ${shortCity}`;
}

function syncSettingsUI() {
  const s = state.settings;
  const shortCity = s.city.split(",")[0];

  document.getElementById("setting-method").value = String(s.method);
  document.getElementById("setting-school").value = String(s.school);
  document.getElementById("setting-lat-adj").value = String(s.latAdj);
  document.getElementById("val-fajr-angle").textContent = `${s.fajrAngle.toFixed(1)}°`;
  document.getElementById("val-isha-angle").textContent = `${s.ishaAngle.toFixed(1)}°`;

  const isCustom = Number(s.method) === 99;
  document.getElementById("row-fajr-angle").classList.toggle("is-disabled", !isCustom);
  document.getElementById("row-isha-angle").classList.toggle("is-disabled", !isCustom);

  document.getElementById("hero-location-meta").textContent = shortCity;
  document.getElementById("settings-city-label").textContent = `Location · ${s.city}`;

  const methodName = METHOD_NAMES[s.method] || "Custom";
  const calcDetail = isCustom ? `${methodName} (${s.fajrAngle.toFixed(1)}° / ${s.ishaAngle.toFixed(1)}°)` : methodName;
  const schoolName = Number(s.school) === 1 ? "Hanafi Asr" : "Standard Asr";
  document.getElementById("sidebar-calc-summary").textContent = calcDetail;
  document.getElementById("sidebar-school-summary").textContent = `${schoolName} · ${s.city}`;

  // Sync fine-tune minute displays
  const t = s.tune || DEFAULT_SETTINGS.tune;
  ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach((pKey) => {
    const el = document.getElementById(`val-tune-${pKey.toLowerCase()}`);
    if (el) {
      const v = Number(t[pKey]) || 0;
      el.textContent = v > 0 ? `+${v}m` : `${v}m`;
    }
  });

  document.querySelectorAll(".city-btn").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.city === s.city);
  });

  updateQibla();
}

function changeMonth(delta) {
  let m = state.calendarMonth + delta;
  let y = state.calendarYear;
  if (m < 1) {
    m = 12;
    y--;
  } else if (m > 12) {
    m = 1;
    y++;
  }
  fetchMonthlyCalendar(y, m);
}

function bindEvents() {
  document.querySelectorAll("[data-prayer-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchPrayerView(btn.dataset.prayerView));
  });

  document.getElementById("inspector-cta-btn").addEventListener("click", () => {
    switchPrayerView(state.activeView === "timetable" ? "overview" : "timetable");
  });

  document.getElementById("btn-open-calc").addEventListener("click", () => {
    switchPrayerView("calculation");
  });

  document.getElementById("tt-csv").addEventListener("click", exportTimetableCSV);
  document.getElementById("tt-print").addEventListener("click", () => window.print());
  document.getElementById("tt-prev").addEventListener("click", () => changeMonth(-1));
  document.getElementById("tt-next").addEventListener("click", () => changeMonth(1));
  document.getElementById("tt-today").addEventListener("click", () => {
    const now = new Date();
    fetchMonthlyCalendar(now.getFullYear(), now.getMonth() + 1);
  });

  document.getElementById("setting-method").addEventListener("change", (e) => {
    state.settings.method = Number(e.target.value);
    saveSettings();
    syncSettingsUI();
    refreshAllFromApi();
  });

  document.getElementById("setting-school").addEventListener("change", (e) => {
    state.settings.school = Number(e.target.value);
    saveSettings();
    syncSettingsUI();
    refreshAllFromApi();
  });

  document.getElementById("setting-lat-adj").addEventListener("change", (e) => {
    state.settings.latAdj = Number(e.target.value);
    saveSettings();
    refreshAllFromApi();
  });

  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.step;
      const delta = Number(btn.dataset.delta);
      if (target === "fajr") {
        state.settings.fajrAngle = Math.min(20, Math.max(12, +(state.settings.fajrAngle + delta).toFixed(1)));
      } else {
        state.settings.ishaAngle = Math.min(20, Math.max(12, +(state.settings.ishaAngle + delta).toFixed(1)));
      }
      saveSettings();
      syncSettingsUI();
      refreshAllFromApi();
    });
  });

  document.querySelectorAll(".city-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.settings.city = btn.dataset.city;
      state.settings.lat = Number(btn.dataset.lat);
      state.settings.lng = Number(btn.dataset.lng);
      saveSettings();
      syncSettingsUI();
      refreshAllFromApi();
    });
  });

  // Fine-tune minute offset steppers
  document.querySelectorAll("[data-tune-prayer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pKey = btn.dataset.tunePrayer;
      const delta = Number(btn.dataset.delta);
      if (!state.settings.tune) state.settings.tune = { ...DEFAULT_SETTINGS.tune };
      const cur = Number(state.settings.tune[pKey]) || 0;
      state.settings.tune[pKey] = Math.min(30, Math.max(-30, cur + delta));
      saveSettings();
      syncSettingsUI();
      refreshAllFromApi();
    });
  });

  const resetMadinaBtn = document.getElementById("btn-reset-madina");
  if (resetMadinaBtn) {
    resetMadinaBtn.addEventListener("click", () => {
      state.settings = { ...DEFAULT_SETTINGS, tune: { ...DEFAULT_SETTINGS.tune } };
      saveSettings();
      syncSettingsUI();
      refreshAllFromApi();
    });
  }

  document.getElementById("ref-next-btn").addEventListener("click", () => {
    state.reflectionIndex = (state.reflectionIndex + 1) % REFLECTIONS.length;
    const item = REFLECTIONS[state.reflectionIndex];
    document.getElementById("ref-source").textContent = item.source;
    document.getElementById("ref-quote").textContent = item.quote;
  });

  // Monthly Prayer Log Calendar events
  document.getElementById("pcal-prev").addEventListener("click", () => {
    state.logCalMonth--;
    if (state.logCalMonth < 0) {
      state.logCalMonth = 11;
      state.logCalYear--;
    }
    renderPrayerLogCalendar();
  });

  document.getElementById("pcal-next").addEventListener("click", () => {
    state.logCalMonth++;
    if (state.logCalMonth > 11) {
      state.logCalMonth = 0;
      state.logCalYear++;
    }
    renderPrayerLogCalendar();
  });

  document.getElementById("pcal-today").addEventListener("click", () => {
    const now = new Date();
    state.logCalYear = now.getFullYear();
    state.logCalMonth = now.getMonth();
    state.selectedLogDate = todayKey();
    renderPrayerLogCalendar();
  });

  document.getElementById("pcal-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-log-date]");
    if (!btn || btn.disabled) return;
    state.selectedLogDate = btn.dataset.logDate;
    renderPrayerLogCalendar();
  });

  document.getElementById("pcal-day-prayers").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle-prayer]");
    if (!btn) return;
    const pKey = btn.dataset.togglePrayer;
    const dKey = state.selectedLogDate;
    if (!state.logs[dKey]) state.logs[dKey] = {};
    state.logs[dKey][pKey] = !state.logs[dKey][pKey];
    saveLogs();
    renderAll();
  });

  document.getElementById("pcal-mark-all").addEventListener("click", () => {
    const dKey = state.selectedLogDate;
    const allDone = countDayPrayers(dKey) === 5;
    if (!state.logs[dKey]) state.logs[dKey] = {};
    for (const p of PRAYERS) {
      state.logs[dKey][p.key] = !allDone;
    }
    saveLogs();
    renderAll();
  });
}

function refreshAllFromApi() {
  fetchTodayTimings();
  fetchMonthlyCalendar(state.calendarYear, state.calendarMonth);
}

function init() {
  syncSettingsUI();
  bindEvents();
  renderAll();
  refreshAllFromApi();
  window.setInterval(updateLiveClocks, 1000);
}

init();
