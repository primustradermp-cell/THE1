/* SalahSync — Preston, Lancashire Prayer Telemetry & Timetable (AlAdhan API) */

const PRAYERS = [
  { key: "Fajr", label: "Fajr" },
  { key: "Dhuhr", label: "Dhuhr" },
  { key: "Asr", label: "Asr" },
  { key: "Maghrib", label: "Maghrib" },
  { key: "Isha", label: "Isha" },
];

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
];

const STORAGE_LOGS_KEY = "preston_prayer_logs_v1";
const STORAGE_SETTINGS_KEY = "preston_prayer_settings_v1";

const DEFAULT_SETTINGS = {
  city: "Preston, Lancashire",
  lat: 53.7632,
  lng: -2.7031,
  tz: "Europe/London",
  method: 99,
  fajrAngle: 15.5,
  ishaAngle: 15.0,
  school: 1, // Hanafi
  latAdj: 3, // Angle-based for northern UK
};

const state = {
  settings: loadSettings(),
  logs: loadLogs(),
  todayTimings: null,
  todayHijri: "",
  calendarMonth: new Date().getMonth() + 1,
  calendarYear: new Date().getFullYear(),
  calendarData: [],
  reflectionIndex: 0,
};

/* ---------- Persistence ---------- */

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
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

function getUKTime() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: state.settings.tz,
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
    totalSeconds: h * 3600 + m * 60 + s,
  };
}

function formatHM(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  return `${h}:${m}`;
}

/* ---------- AlAdhan API ---------- */

function buildAlAdhanQuery() {
  const s = state.settings;
  const params = new URLSearchParams({
    latitude: String(s.lat),
    longitude: String(s.lng),
    method: String(s.method),
    school: String(s.school),
    latitudeAdjustmentMethod: String(s.latAdj),
  });
  if (Number(s.method) === 99) {
    params.set("methodSettings", `${s.fajrAngle},null,${s.ishaAngle}`);
  }
  return params.toString();
}

function setApiStatus(text, isError = false) {
  document.getElementById("api-status-text").textContent = text;
  document.getElementById("api-dot").classList.toggle("is-error", isError);
}

async function fetchTodayTimings() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?${buildAlAdhanQuery()}`;

  const shortCity = state.settings.city.split(",")[0];
  setApiStatus(`Syncing ${shortCity}…`);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 200 || !json.data) throw new Error("Unexpected payload");

    state.todayTimings = json.data.timings;
    const h = json.data.date.hijri;
    state.todayHijri = `${h.day} ${h.month.en.toUpperCase()} ${h.year} AH`;

    const coord = `${state.settings.lat.toFixed(4)}° N, ${Math.abs(state.settings.lng).toFixed(4)}° ${
      state.settings.lng < 0 ? "W" : "E"
    }`;
    document.getElementById("hero-hijri-line").textContent = `${state.todayHijri} · ${coord}`;
    document.getElementById("sunrise-pill").textContent = `Sunrise ${cleanTime(state.todayTimings.Sunrise)}`;
    document.getElementById("g-fajr").textContent = cleanTime(state.todayTimings.Fajr);
    document.getElementById("g-dhuhr").textContent = cleanTime(state.todayTimings.Dhuhr);
    document.getElementById("g-isha").textContent = cleanTime(state.todayTimings.Isha);

    setApiStatus(`${shortCity} Live`);
    renderAll();
  } catch (err) {
    console.error("AlAdhan today fetch failed:", err);
    setApiStatus("API Offline", true);
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
  document.getElementById("tt-body").innerHTML =
    `<tr><td colspan="8" class="table-loading">Loading ${monthName} timetable for ${state.settings.city}…</td></tr>`;

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
    document.getElementById("tt-body").innerHTML =
      `<tr><td colspan="8" class="table-loading">Could not load monthly timetable from AlAdhan API.</td></tr>`;
  }
}

/* ---------- Telemetry & Next Prayer ---------- */

function getNextPrayerInfo() {
  if (!state.todayTimings) return null;
  const nowSec = getUKTime().totalSeconds;

  for (let i = 0; i < PRAYERS.length; i++) {
    const p = PRAYERS[i];
    const pSec = parseSeconds(state.todayTimings[p.key]);
    if (pSec !== null && pSec > nowSec) {
      return {
        index: i,
        key: p.key,
        time: cleanTime(state.todayTimings[p.key]),
        remainingSec: pSec - nowSec,
        tomorrow: false,
      };
    }
  }

  const fajrSec = parseSeconds(state.todayTimings.Fajr);
  if (fajrSec !== null) {
    return {
      index: 0,
      key: "Fajr",
      time: cleanTime(state.todayTimings.Fajr),
      remainingSec: 86400 - nowSec + fajrSec,
      tomorrow: true,
    };
  }
  return null;
}

function getDayLog(key) {
  return state.logs[key] || {};
}

function countDayPrayers(key) {
  const log = getDayLog(key);
  return PRAYERS.reduce((acc, p) => acc + (log[p.key] ? 1 : 0), 0);
}

function updateLiveTelemetry() {
  const uk = getUKTime();
  document.getElementById("widget-clock").textContent = uk.text;
  document.getElementById("scrubber-time").textContent = `${uk.text} / 24:00:00`;

  const dayPct = Math.round((uk.totalSeconds / 86400) * 100);
  document.getElementById("day-pct-label").textContent = `${dayPct}%`;
  document.getElementById("day-pct-fill").style.width = `${dayPct}%`;
  document.getElementById("scrubber-progress").style.width = `${dayPct}%`;

  if (!state.todayTimings) return;

  const next = getNextPrayerInfo();
  if (next) {
    document.getElementById("ruler-countdown").textContent = formatHM(next.remainingSec);
    document.getElementById("insp-next-title").textContent = `${next.key} Prayer`;
    document.getElementById("insp-next-time").textContent = next.time;
    document.getElementById("gauge-status-text").textContent = `Next: ${next.key}`;
  }

  // Ruler needle & semicircular daylight arc gauge (Fajr -> Isha)
  const fajrSec = parseSeconds(state.todayTimings.Fajr) ?? 5 * 3600;
  const ishaSec = parseSeconds(state.todayTimings.Isha) ?? 19 * 3600;
  const ratio = Math.min(1, Math.max(0, (uk.totalSeconds - fajrSec) / Math.max(1, ishaSec - fajrSec)));

  document.getElementById("ruler-needle").style.top = `${(ratio * 92).toFixed(1)}%`;

  // Semicircle angle: -90deg (left/Fajr) to +90deg (right/Isha)
  const deg = -90 + ratio * 180;
  document.getElementById("gauge-needle").setAttribute("transform", `translate(110, 102) rotate(${deg.toFixed(1)})`);
  document.getElementById("gauge-arc-active").setAttribute("stroke-dashoffset", String((270 * (1 - ratio)).toFixed(1)));

  // Scrubber milestone ticks
  const markers = document.getElementById("scrubber-markers");
  markers.innerHTML = PRAYERS.map((p) => {
    const pSec = parseSeconds(state.todayTimings[p.key]);
    if (pSec === null) return "";
    const leftPct = (pSec / 86400) * 100;
    const isNext = next && next.key === p.key && !next.tomorrow;
    return `<span class="scrub-tick${isNext ? " is-next" : ""}" style="left:${leftPct.toFixed(1)}%" title="${p.label} ${cleanTime(state.todayTimings[p.key])}"></span>`;
  }).join("");
}

/* ---------- Render Dashboard, Bento & Inspector ---------- */

function renderAll() {
  const key = todayKey();
  const todayLog = getDayLog(key);
  const doneToday = countDayPrayers(key);
  const pctToday = Math.round((doneToday / 5) * 100);
  const next = getNextPrayerInfo();

  // Greeting & Inspector counts
  document.getElementById("hero-pct-text").textContent = `Completed ${pctToday}%`;
  document.getElementById("insp-done-num").textContent = String(doneToday);
  document.getElementById("insp-balance-val").textContent = `${doneToday} / 5`;

  // 5 Interactive HUD Prayer Cards
  const grid = document.getElementById("hud-prayer-grid");
  grid.innerHTML = "";
  for (const p of PRAYERS) {
    const isDone = Boolean(todayLog[p.key]);
    const isNext = next && next.key === p.key && !next.tomorrow;
    const timeStr = state.todayTimings ? cleanTime(state.todayTimings[p.key]) : "--:--";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `hud-prayer-card${isDone ? " is-done" : ""}${isNext ? " is-next" : ""}`;
    btn.innerHTML = `
      <div class="hud-card-top">
        <span class="hud-status-badge">${isDone ? "✓" : isNext ? "●" : ""}</span>
        <span class="hud-tag">${isDone ? "Done" : isNext ? "Next" : "Tap"}</span>
      </div>
      <div>
        <div class="hud-p-name">${p.label}</div>
        <div class="hud-p-time">${timeStr}</div>
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

  // Inspector 5-block meter
  const blockMeter = document.getElementById("insp-block-meter");
  blockMeter.innerHTML = PRAYERS.map((p) => {
    const isDone = Boolean(todayLog[p.key]);
    const isNext = next && next.key === p.key && !next.tomorrow;
    return `<span class="b-seg${isDone ? " is-on" : isNext ? " is-next" : ""}" title="${p.label}"></span>`;
  }).join("");

  // Inspector Balance 4-node glyphs
  const balGlyphs = document.getElementById("insp-balance-glyphs");
  balGlyphs.innerHTML = Array.from({ length: 4 }, (_, i) => {
    const threshold = (i + 1) * 1.25;
    const cls = doneToday >= threshold ? "g-full" : doneToday >= threshold - 0.75 ? "g-orange" : "";
    return `<span class="glyph ${cls}"></span>`;
  }).join("");

  // 30-Day Analytics
  const now = new Date();
  const counts = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };
  let total30 = 0;
  const last30Counts = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dk = toDateKey(d);
    const log = getDayLog(dk);
    let daySum = 0;
    for (const p of PRAYERS) {
      if (log[p.key]) {
        counts[p.key]++;
        total30++;
        daySum++;
      }
    }
    last30Counts.push({ key: dk, count: daySum, isToday: i === 0 });
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

  // Streak
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const c = countDayPrayers(toDateKey(d));
    if (c === 5) streak++;
    else if (i === 0) continue;
    else break;
  }

  // Best streak
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

  document.getElementById("bento-total-30").textContent = String(total30);
  document.getElementById("bento-streak").textContent = `${streak} d`;
  document.getElementById("bento-week").textContent = `${weekSum}/35`;
  document.getElementById("analytics-best-streak").textContent = `Best streak · ${bestStreak} days`;

  // Spark-bars (Card 2) & Breakdown list (Activity tab)
  let minPrayer = PRAYERS[0];
  for (const p of PRAYERS) {
    if (counts[p.key] < counts[minPrayer.key]) minPrayer = p;
  }

  document.getElementById("spark-bars").innerHTML = PRAYERS.map((p) => {
    const pct = Math.round((counts[p.key] / 30) * 100);
    const h = Math.max(pct > 0 ? 14 : 6, pct);
    const isFocus = p.key === minPrayer.key || (next && next.key === p.key);
    return `
      <div class="spark-col">
        <span class="spark-pct">${pct}%</span>
        <div class="spark-track">
          <div class="spark-needle${isFocus ? " is-focus" : ""}" style="height:${h}%"></div>
        </div>
      </div>
    `;
  }).join("");

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

  // Inspector 30-day barcode
  document.getElementById("barcode-track").innerHTML = last30Counts
    .map((d) => {
      const cls = d.isToday
        ? "is-today"
        : d.count >= 4
        ? "lvl-high"
        : d.count >= 1
        ? "lvl-mid"
        : "";
      return `<span class="bc-tick ${cls}" title="${d.key}: ${d.count}/5"></span>`;
    })
    .join("");

  // Inspector Consistency arc
  const rate30 = Math.round((total30 / 150) * 100);
  document.getElementById("insp-eff-arc").setAttribute("stroke-dashoffset", String((110 * (1 - rate30 / 100)).toFixed(1)));
  document.getElementById("insp-eff-label").textContent =
    rate30 >= 80 ? "High" : rate30 >= 45 ? "Steady" : "Building";
  document.getElementById("insp-eff-sub").textContent = `${rate30}% over 30 days`;

  renderHeatmap();
  updateLiveTelemetry();
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

/* ---------- Monthly Timetable ---------- */

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
        <tr class="${isToday ? "is-today-row" : ""}">
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

  const coord = `${state.settings.lat.toFixed(4)}° N, ${Math.abs(state.settings.lng).toFixed(4)}° ${
    state.settings.lng < 0 ? "W" : "E"
  } · ${state.settings.tz} · AlAdhan API`;
  document.getElementById("tt-heading").textContent = `${state.settings.city} — Monthly Timetable`;
  document.getElementById("tt-subheading").textContent = coord;
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

/* ---------- Navigation, Qibla & Settings ---------- */

function scrollToTimetable() {
  const el = document.getElementById("section-timetable");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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

  document.getElementById("wire-needle").setAttribute("transform", `rotate(${bearing.toFixed(1)} 55 55)`);
  document.getElementById("insp-qibla-deg").textContent = `${bearing.toFixed(1)}° ESE`;
}

function syncSettingsUI() {
  const s = state.settings;
  const shortCity = s.city.split(",")[0];

  document.getElementById("setting-method").value = String(s.method);
  document.getElementById("setting-school").value = String(s.school);
  document.getElementById("setting-lat-adj").value = String(s.latAdj);
  document.getElementById("val-fajr-angle").textContent = `${s.fajrAngle.toFixed(1)}°`;
  document.getElementById("val-isha-angle").textContent = `${s.ishaAngle.toFixed(1)}°`;
  document.getElementById("bento-angle-readout").textContent = `${s.fajrAngle.toFixed(1)}° / ${s.ishaAngle.toFixed(1)}°`;

  const isCustom = Number(s.method) === 99;
  document.getElementById("row-fajr-angle").classList.toggle("is-disabled", !isCustom);
  document.getElementById("row-isha-angle").classList.toggle("is-disabled", !isCustom);

  document.getElementById("widget-city").textContent = `${shortCity}, UK`;
  document.getElementById("hero-city-span").textContent = shortCity;
  document.getElementById("insp-city-unit").textContent = `${shortCity} time`;
  document.getElementById("settings-coords").textContent = `${s.city} · ${s.lat.toFixed(4)}° N, ${Math.abs(
    s.lng
  ).toFixed(4)}° ${s.lng < 0 ? "W" : "E"}`;

  document.querySelectorAll(".mini-mode-btn").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.school) === Number(s.school));
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
  document.getElementById("inspector-cta-btn").addEventListener("click", scrollToTimetable);
  document.getElementById("btn-jump-tt").addEventListener("click", scrollToTimetable);
  document.getElementById("btn-quick-csv").addEventListener("click", exportTimetableCSV);
  document.getElementById("tt-csv").addEventListener("click", exportTimetableCSV);
  document.getElementById("tt-print").addEventListener("click", () => window.print());

  document.getElementById("tt-prev").addEventListener("click", () => changeMonth(-1));
  document.getElementById("tt-next").addEventListener("click", () => changeMonth(1));
  document.getElementById("tt-today").addEventListener("click", () => {
    const now = new Date();
    fetchMonthlyCalendar(now.getFullYear(), now.getMonth() + 1);
  });

  document.querySelectorAll(".mini-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.settings.school = Number(btn.dataset.school);
      saveSettings();
      syncSettingsUI();
      refreshAllFromApi();
    });
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

  document.getElementById("ref-next-btn").addEventListener("click", () => {
    state.reflectionIndex = (state.reflectionIndex + 1) % REFLECTIONS.length;
    const item = REFLECTIONS[state.reflectionIndex];
    document.getElementById("ref-source").textContent = item.source;
    document.getElementById("ref-quote").textContent = item.quote;
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
  window.setInterval(updateLiveTelemetry, 1000);
}

init();
