/* PRIMUS PRAYER — Preston, Lancashire Prayer Times & Tracker (AlAdhan API) */

const PRAYERS = [
  { key: "Fajr", label: "Fajr", icon: "☾" },
  { key: "Dhuhr", label: "Dhuhr", icon: "☀" },
  { key: "Asr", label: "Asr", icon: "☼" },
  { key: "Maghrib", label: "Maghrib", icon: "◐" },
  { key: "Isha", label: "Isha", icon: "✦" },
];

const METHOD_LABELS = {
  99: "CUSTOM ANGLES",
  15: "MOONSIGHTING",
  3: "MWL",
  2: "ISNA",
  1: "KARACHI",
  5: "EGYPTIAN",
  4: "UMM AL-QURA",
};

const REFLECTIONS = [
  {
    arabic: "الْحَمْدُ لِلَّهِ",
    quote: "“Verily, in the remembrance of Allah do hearts find rest.”",
    source: "Qur’an 13:28",
  },
  {
    arabic: "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا",
    quote: "“Indeed, prayer has been decreed upon the believers at specified times.”",
    source: "Qur’an 4:103",
  },
  {
    arabic: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    quote: "“For indeed, with hardship comes ease.”",
    source: "Qur’an 94:5",
  },
  {
    arabic: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ",
    quote: "“Your smile in the face of your brother is charity.”",
    source: "Prophet Muhammad ﷺ (Jami‘ at-Tirmidhi)",
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
  latAdj: 3, // Angle-based for northern UK latitudes
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

/* ---------- Helpers ---------- */

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

function parseMinutes(hhmm) {
  const [h, m] = cleanTime(hhmm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
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
  return { h, m, s, text: `${get("hour")}:${get("minute")}:${get("second")}`, totalMinutes: h * 60 + m };
}

function formatDuration(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h <= 0 ? `${m}m` : `${h}h ${m}m`;
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
  const chip = document.getElementById("api-status");
  const label = document.getElementById("api-status-text");
  if (!chip || !label) return;
  label.textContent = text;
  chip.classList.toggle("is-error", isError);
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
    state.todayHijri = `${h.day} ${h.month.en.toUpperCase()} ${h.year}`;

    document.getElementById("hijri-date-text").textContent = state.todayHijri;
    document.getElementById("sunrise-pill").textContent = `SUNRISE ${cleanTime(state.todayTimings.Sunrise)}`;
    setApiStatus(`LIVE · ${shortCity.toUpperCase()}`);

    renderTodayHero();
  } catch (err) {
    console.error("AlAdhan today fetch failed:", err);
    setApiStatus("API OFFLINE", true);
    document.getElementById("next-prayer-text").textContent =
      "Unable to reach api.aladhan.com — check your connection.";
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

/* ---------- Hero & Prayer Toggles ---------- */

function getNextPrayerInfo() {
  if (!state.todayTimings) return null;
  const nowMin = getTimeInZone(state.settings.tz).totalMinutes;

  for (const p of PRAYERS) {
    const pMin = parseMinutes(state.todayTimings[p.key]);
    if (pMin !== null && pMin > nowMin) {
      return {
        key: p.key,
        time: cleanTime(state.todayTimings[p.key]),
        diffText: formatDuration(pMin - nowMin),
      };
    }
  }

  const fajrMin = parseMinutes(state.todayTimings.Fajr);
  if (fajrMin !== null) {
    return {
      key: "Fajr",
      time: cleanTime(state.todayTimings.Fajr),
      diffText: formatDuration(24 * 60 - nowMin + fajrMin),
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

function renderTodayHero() {
  const key = todayKey();
  const log = getDayLog(key);
  const doneCount = countDayPrayers(key);
  const nextInfo = getNextPrayerInfo();

  document.getElementById("today-count").textContent = `${doneCount} of 5 prayers today.`;
  document.getElementById("ring-num").textContent = String(doneCount);

  const circumference = 2 * Math.PI * 40;
  document.getElementById("ring-fill").style.strokeDashoffset = String(circumference * (1 - doneCount / 5));

  if (nextInfo) {
    document.getElementById("next-prayer-tag").textContent = `NEXT / ${nextInfo.key.toUpperCase()}`;
    document.getElementById("next-prayer-text").textContent = `${nextInfo.time} · in ${nextInfo.diffText}`;
  }

  const row = document.getElementById("prayer-row");
  row.innerHTML = "";

  for (const p of PRAYERS) {
    const isDone = Boolean(log[p.key]);
    const isNext = nextInfo && nextInfo.key === p.key;
    const timeStr = state.todayTimings ? cleanTime(state.todayTimings[p.key]) : "--:--";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `prayer-pill${isDone ? " is-done" : ""}${isNext ? " is-next" : ""}`;
    btn.setAttribute("aria-pressed", String(isDone));
    btn.innerHTML = `
      <span class="prayer-pill-top">
        <span class="prayer-check" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5 6.5 11.5 12.5 4.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        ${isNext ? `<span class="next-dot" title="Next prayer"></span>` : ""}
      </span>
      <span class="prayer-name">${p.label}</span>
      <span class="prayer-time">${timeStr}</span>
    `;
    btn.addEventListener("click", () => togglePrayer(p.key));
    row.appendChild(btn);
  }
}

function togglePrayer(prayerKey) {
  const key = todayKey();
  if (!state.logs[key]) state.logs[key] = {};
  state.logs[key][prayerKey] = !state.logs[key][prayerKey];
  saveLogs();
  renderAllAnalytics();
}

/* ---------- Progress & Analytics ---------- */

function renderBreakdown30Days() {
  const now = new Date();
  const counts = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };
  let total = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const log = getDayLog(toDateKey(d));
    for (const p of PRAYERS) {
      if (log[p.key]) {
        counts[p.key]++;
        total++;
      }
    }
  }

  document.getElementById("breakdown-total").innerHTML = `${total}<span class="muted">/150</span>`;

  const list = document.getElementById("breakdown-list");
  list.innerHTML = "";
  let best = PRAYERS[0];
  let focus = PRAYERS[0];

  for (const p of PRAYERS) {
    const c = counts[p.key];
    const pct = Math.round((c / 30) * 100);
    if (c > counts[best.key]) best = p;
    if (c < counts[focus.key]) focus = p;

    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `
      <div class="breakdown-label">
        <span class="p-icon" aria-hidden="true">${p.icon}</span>
        <span>${p.label}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="breakdown-count">${c}/30</div>
      <div class="breakdown-pct">${pct}%</div>
    `;
    list.appendChild(row);
  }

  document.getElementById("best-prayer").textContent = `${best.label} ${Math.round((counts[best.key] / 30) * 100)}%`;
  document.getElementById("focus-prayer").textContent = `${focus.label} ${Math.round((counts[focus.key] / 30) * 100)}%`;
}

function renderMonthlyTrend() {
  const now = new Date();
  const container = document.getElementById("monthly-bars");
  container.innerHTML = "";

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const label = d.toLocaleString("en-GB", { month: "short" });

    let totalPrayed = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      totalPrayed += countDayPrayers(key);
    }

    const pct = Math.round((totalPrayed / (daysInMonth * 5)) * 100);
    const barH = Math.max(pct > 0 ? 18 : 0, Math.min(100, pct));

    const col = document.createElement("div");
    col.className = "m-col";
    col.innerHTML = `
      <span class="m-pct">${pct}%</span>
      <div class="m-box"><div class="m-fill" style="height:${barH}%"></div></div>
      <span class="m-label">${label}</span>
    `;
    container.appendChild(col);
  }
}

function renderThisWeek() {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);

  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const container = document.getElementById("week-bars");
  container.innerHTML = "";

  let weekSum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const c = countDayPrayers(toDateKey(d));
    weekSum += c;

    const col = document.createElement("div");
    col.className = "w-col";
    col.innerHTML = `
      <span class="w-count">${c > 0 ? c : ""}</span>
      <div class="w-bar-wrap"><div class="w-bar" style="height:${(c / 5) * 100}%"></div></div>
      <span class="w-day">${labels[i]}</span>
    `;
    container.appendChild(col);
  }

  document.getElementById("week-total").innerHTML = `${weekSum}<span class="muted">/35</span>`;
}

function renderStreak() {
  const now = new Date();
  let current = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const c = countDayPrayers(toDateKey(d));
    if (c === 5) {
      current++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  const sortedKeys = Object.keys(state.logs).sort();
  let best = current;
  let run = 0;
  let prevDate = null;
  for (const k of sortedKeys) {
    if (countDayPrayers(k) === 5) {
      const dt = new Date(k + "T00:00:00");
      run = prevDate && (dt - prevDate) / 86400000 === 1 ? run + 1 : 1;
      if (run > best) best = run;
      prevDate = dt;
    } else {
      run = 0;
      prevDate = null;
    }
  }

  document.getElementById("streak-current").textContent = String(current);
  const segWrap = document.getElementById("streak-segments");
  segWrap.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const seg = document.createElement("div");
    seg.className = `streak-seg${i < Math.min(current, 7) ? " is-filled" : ""}`;
    segWrap.appendChild(seg);
  }

  const remaining = Math.max(0, 7 - current);
  document.getElementById("streak-msg").textContent =
    remaining === 0 ? "7-day streak goal achieved" : `${remaining} days to a 7-day streak`;
  document.getElementById("streak-best").textContent = `All-time best · ${best} days`;
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
      const mSpan = document.createElement("span");
      if (d.getMonth() !== lastMonth) {
        mSpan.textContent = d.toLocaleString("en-GB", { month: "short" });
        lastMonth = d.getMonth();
      }
      monthsRow.appendChild(mSpan);
    }

    const key = toDateKey(d);
    const count = countDayPrayers(key);
    const lvl = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count === 4 ? 3 : 4;

    const cell = document.createElement("span");
    cell.className = `cell lvl-${lvl}${key === todayStr ? " is-today" : ""}`;
    if (d > today) cell.style.opacity = "0.28";

    const prettyDate = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    cell.addEventListener("mouseenter", (e) => {
      tooltip.textContent = `${prettyDate} · ${count}/5 prayers`;
      tooltip.hidden = false;
      tooltip.style.left = `${e.clientX + 12}px`;
      tooltip.style.top = `${e.clientY - 34}px`;
    });
    cell.addEventListener("mousemove", (e) => {
      tooltip.style.left = `${e.clientX + 12}px`;
      tooltip.style.top = `${e.clientY - 34}px`;
    });
    cell.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });

    grid.appendChild(cell);
  }
}

function renderAllAnalytics() {
  renderTodayHero();
  renderBreakdown30Days();
  renderMonthlyTrend();
  renderThisWeek();
  renderStreak();
  renderHeatmap();
}

/* ---------- Timetable ---------- */

function renderTimetable() {
  const now = new Date();
  const todayDay = now.getDate();
  const isCurrentMonth =
    now.getFullYear() === state.calendarYear && now.getMonth() + 1 === state.calendarMonth;

  const html = state.calendarData
    .map((entry) => {
      const g = entry.date.gregorian;
      const h = entry.date.hijri;
      const t = entry.timings;
      const isToday = isCurrentMonth && Number(g.day) === todayDay;
      const isFriday = g.weekday.en === "Friday";

      const cls = [isToday ? "is-today-row" : "", isFriday ? "is-friday-row" : ""]
        .filter(Boolean)
        .join(" ");

      const tags = [
        isToday ? `<span class="row-tag tag-today">TODAY</span>` : "",
        isFriday ? `<span class="row-tag tag-jumuah">JUMU’AH</span>` : "",
      ].join("");

      return `
        <tr class="${cls}" ${isToday ? 'data-today-row="true"' : ""}>
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

  document.getElementById("tt-body").innerHTML = html;

  const coordText = `${state.settings.lat.toFixed(4)}° N, ${Math.abs(state.settings.lng).toFixed(4)}° ${
    state.settings.lng < 0 ? "W" : "E"
  } · ${state.settings.tz}`;
  document.getElementById("tt-heading").textContent = `${state.settings.city} — Prayer Timetable`;
  document.getElementById("tt-subheading").textContent = coordText;

  const todayRow = document.querySelector('#tt-body tr[data-today-row="true"]');
  if (todayRow) todayRow.scrollIntoView({ block: "center", behavior: "instant" });
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

/* ---------- Qibla & Settings ---------- */

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

  document.getElementById("qibla-needle").style.transform = `rotate(${bearing.toFixed(1)}deg)`;
  document.getElementById("qibla-deg").textContent = `${bearing.toFixed(1)}° ESE`;
  document.getElementById("ticker-qibla").textContent = `${bearing.toFixed(1)}° ESE`;
  document.getElementById("qibla-desc").textContent =
    `Great-circle bearing from ${state.settings.city} (${state.settings.lat.toFixed(4)}° N, ${Math.abs(state.settings.lng).toFixed(4)}° W) to the Kaaba in Makkah.`;
}

function syncSettingsUI() {
  const s = state.settings;
  document.getElementById("setting-method").value = String(s.method);
  document.getElementById("setting-school").value = String(s.school);
  document.getElementById("setting-lat-adj").value = String(s.latAdj);
  document.getElementById("val-fajr-angle").textContent = `${s.fajrAngle.toFixed(1)}°`;
  document.getElementById("val-isha-angle").textContent = `${s.ishaAngle.toFixed(1)}°`;

  const isCustom = Number(s.method) === 99;
  document.getElementById("row-fajr-angle").classList.toggle("is-disabled", !isCustom);
  document.getElementById("row-isha-angle").classList.toggle("is-disabled", !isCustom);

  const coordShort = `${s.lat.toFixed(4)}° N, ${Math.abs(s.lng).toFixed(4)}° ${s.lng < 0 ? "W" : "E"}`;
  document.getElementById("hero-loc-kicker").textContent = `${s.city.toUpperCase()} · ${coordShort}`;
  document.getElementById("study-coords").textContent = `${s.city.split(",")[0].toUpperCase()} · UK`;
  document.getElementById("loc-name").textContent = s.city;
  document.getElementById("loc-coords").textContent = `${coordShort} · ${s.tz}`;

  const methodLabel = METHOD_LABELS[s.method] || "CUSTOM";
  const schoolLabel = Number(s.school) === 1 ? "HANAFI" : "STANDARD";
  document.getElementById("method-badge").textContent = `${methodLabel} · ${schoolLabel}`;

  document.querySelectorAll(".city-chip").forEach((chip) => {
    chip.classList.toggle("is-selected", chip.dataset.city === s.city);
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
  document.getElementById("tt-prev").addEventListener("click", () => changeMonth(-1));
  document.getElementById("tt-next").addEventListener("click", () => changeMonth(1));
  document.getElementById("tt-today").addEventListener("click", () => {
    const now = new Date();
    fetchMonthlyCalendar(now.getFullYear(), now.getMonth() + 1);
  });
  document.getElementById("tt-print").addEventListener("click", () => window.print());
  document.getElementById("tt-csv").addEventListener("click", exportTimetableCSV);
  document.getElementById("quick-export-csv").addEventListener("click", exportTimetableCSV);

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

  document.querySelectorAll(".stepper-btn").forEach((btn) => {
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

  document.querySelectorAll(".city-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.settings.city = chip.dataset.city;
      state.settings.lat = Number(chip.dataset.lat);
      state.settings.lng = Number(chip.dataset.lng);
      saveSettings();
      syncSettingsUI();
      refreshAllFromApi();
    });
  });

  document.getElementById("ref-next-btn").addEventListener("click", () => {
    state.reflectionIndex = (state.reflectionIndex + 1) % REFLECTIONS.length;
    const item = REFLECTIONS[state.reflectionIndex];
    document.getElementById("ref-arabic").textContent = item.arabic;
    document.getElementById("ref-quote").textContent = item.quote;
    document.getElementById("ref-source").textContent = item.source;
  });
}

function refreshAllFromApi() {
  fetchTodayTimings();
  fetchMonthlyCalendar(state.calendarYear, state.calendarMonth);
}

function startClocks() {
  const tick = () => {
    const preston = getTimeInZone(state.settings.tz);
    const makkah = getTimeInZone("Asia/Riyadh");
    document.getElementById("clock-preston").textContent = preston.text;
    document.getElementById("clock-makkah").textContent = makkah.text;
    if (preston.s === 0 && state.todayTimings) {
      renderTodayHero();
    }
  };
  tick();
  window.setInterval(tick, 1000);
}

function init() {
  syncSettingsUI();
  bindEvents();
  renderAllAnalytics();
  startClocks();
  refreshAllFromApi();
}

init();
