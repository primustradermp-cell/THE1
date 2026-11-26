/* GymSync — Weekly Preset Routine (Mon–Sun) + Individual Per-Set Editing (Sets / Reps / Weight) */

const FITNESS_LOGS_KEY = "salahsync_fitness_logs_v1";
const FITNESS_PLAN_KEY = "salahsync_fitness_plan_v1";

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

const SAMPLE_SPLITS = {
  Push: [
    { name: "Barbell Bench Press", sets: 4, reps: "8", weight: "60 kg" },
    { name: "Incline Dumbbell Press", sets: 3, reps: "10", weight: "22 kg" },
    { name: "Overhead Shoulder Press", sets: 3, reps: "10", weight: "35 kg" },
    { name: "Lateral Raises", sets: 3, reps: "12", weight: "10 kg" },
    { name: "Tricep Rope Pushdown", sets: 3, reps: "12", weight: "25 kg" },
  ],
  Pull: [
    { name: "Pull-Ups / Lat Pulldown", sets: 4, reps: "8", weight: "55 kg" },
    { name: "Barbell Bent-Over Row", sets: 4, reps: "8", weight: "60 kg" },
    { name: "Seated Cable Row", sets: 3, reps: "10", weight: "50 kg" },
    { name: "Face Pulls", sets: 3, reps: "15", weight: "20 kg" },
    { name: "Dumbbell Bicep Curls", sets: 3, reps: "12", weight: "14 kg" },
  ],
  Legs: [
    { name: "Barbell Squat", sets: 4, reps: "8", weight: "80 kg" },
    { name: "Romanian Deadlift", sets: 3, reps: "10", weight: "70 kg" },
    { name: "Leg Press", sets: 3, reps: "12", weight: "120 kg" },
    { name: "Hamstring Curl", sets: 3, reps: "12", weight: "40 kg" },
    { name: "Standing Calf Raises", sets: 4, reps: "15", weight: "45 kg" },
  ],
};

const fitnessState = {
  selectedDate: toDateKey(new Date()),
  openDropdownId: null,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  logs: loadJSON(FITNESS_LOGS_KEY, {}),
  plan: loadPlan(),
};

/* ---------- Storage & Migration ---------- */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function makeId() {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Normalizes any exercise (legacy { sets, reps, weight } OR new { setList: [...] })
 * into the per-set format without losing existing saved user data.
 */
function normalizeExercise(ex, resetDone = false) {
  let setList;
  if (Array.isArray(ex.setList) && ex.setList.length > 0) {
    setList = ex.setList.map((s) => ({
      reps: String(s.reps ?? "10"),
      weight: String(s.weight ?? ""),
      done: resetDone ? false : Boolean(s.done),
    }));
  } else {
    const count = Math.max(1, Math.min(30, Number(ex.sets) || 3));
    const reps = String(ex.reps ?? "10");
    const weight = String(ex.weight ?? "");
    const done = resetDone ? false : Boolean(ex.done);
    setList = Array.from({ length: count }, () => ({ reps, weight, done }));
  }

  const allDone = setList.length > 0 && setList.every((s) => s.done);
  return {
    id: ex.id || makeId(),
    name: String(ex.name || "Exercise"),
    done: resetDone ? false : Boolean(ex.done || allDone),
    setList,
  };
}

function loadPlan() {
  const saved = loadJSON(FITNESS_PLAN_KEY, null);
  const merged = {};
  for (const w of WEEKDAYS) {
    const src = saved && saved[w.id] ? saved[w.id] : DEFAULT_PLAN[w.id];
    const exList = Array.isArray(src.exercises)
      ? src.exercises.map((ex) => normalizeExercise(ex, true))
      : [];
    merged[w.id] = {
      title: src.title || "",
      exercises: exList,
    };
  }
  return merged;
}

function saveLogs() {
  localStorage.setItem(FITNESS_LOGS_KEY, JSON.stringify(fitnessState.logs));
}

function savePlan() {
  localStorage.setItem(FITNESS_PLAN_KEY, JSON.stringify(fitnessState.plan));
}

/* ---------- Date & Format Helpers ---------- */

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayKey() {
  return toDateKey(new Date());
}

function getWeekdayForDate(dateKey) {
  return fromDateKey(dateKey).getDay();
}

function getWeekdayInfo(wd) {
  return WEEKDAYS.find((w) => w.id === wd) || WEEKDAYS[0];
}

function formatReadableDate(key) {
  const d = fromDateKey(key);
  const label = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return key === todayKey() ? `Today · ${label}` : label;
}

function parseLeadingNumber(val) {
  const match = String(val || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatExerciseSummary(ex) {
  const list = ex.setList || [];
  const count = list.length;
  if (!count) return "0 sets";

  const repsArr = list.map((s) => s.reps.trim() || "0");
  const uniqueReps = [...new Set(repsArr)];
  const repsText =
    uniqueReps.length === 1
      ? `${uniqueReps[0]} reps`
      : repsArr.length <= 4
      ? `${repsArr.join("/")} reps`
      : `${repsArr.slice(0, 3).join("/")}+ reps`;

  const weights = list.map((s) => s.weight.trim()).filter(Boolean);
  let weightText = "";
  if (weights.length) {
    const uniqueWeights = [...new Set(weights)];
    if (uniqueWeights.length === 1) {
      weightText = ` · ${uniqueWeights[0]}`;
    } else {
      const nums = weights.map((w) => parseLeadingNumber(w)).filter((n) => n > 0);
      if (nums.length >= 2) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const unitMatch = weights[0].match(/[a-zA-Z]+/);
        const unit = unitMatch ? ` ${unitMatch[0]}` : "";
        weightText = min === max ? ` · ${min}${unit}` : ` · ${min}–${max}${unit}`;
      } else {
        weightText = ` · ${uniqueWeights[0]}`;
      }
    }
  }

  return `${count} ${count === 1 ? "set" : "sets"} · ${repsText}${weightText}`;
}

function countExerciseSets(ex) {
  return ex.setList ? ex.setList.length : Number(ex.sets) || 0;
}

function countExerciseReps(ex) {
  if (ex.setList) {
    return ex.setList.reduce((sum, s) => sum + Math.round(parseLeadingNumber(s.reps)), 0);
  }
  return (Number(ex.sets) || 0) * Math.round(parseLeadingNumber(ex.reps));
}

/* ---------- Preset + Daily Override Resolution ---------- */

function getEffectiveExercises(dateKey) {
  const wd = getWeekdayForDate(dateKey);
  const presetList = (fitnessState.plan[wd]?.exercises || []).map((p) => normalizeExercise(p, true));
  const savedLog = fitnessState.logs[dateKey];

  if (!savedLog || !Array.isArray(savedLog.exercises)) {
    return presetList;
  }

  const existing = savedLog.exercises.map((e) => normalizeExercise(e, false));
  const seenNames = new Set(existing.map((e) => e.name.toLowerCase()));

  for (const p of presetList) {
    if (!seenNames.has(p.name.toLowerCase())) {
      existing.push(p);
    }
  }
  return existing;
}

function ensureDayLog(dateKey) {
  const wd = getWeekdayForDate(dateKey);
  const preset = fitnessState.plan[wd] || { title: "", exercises: [] };

  if (!fitnessState.logs[dateKey]) {
    fitnessState.logs[dateKey] = {
      attended: false,
      title: preset.title || "",
      notes: "",
      exercises: getEffectiveExercises(dateKey),
    };
  } else {
    fitnessState.logs[dateKey].exercises = getEffectiveExercises(dateKey);
    if (!fitnessState.logs[dateKey].title && preset.title) {
      fitnessState.logs[dateKey].title = preset.title;
    }
  }
  return fitnessState.logs[dateKey];
}

function isGymDay(dateKey) {
  const d = fitnessState.logs[dateKey];
  return Boolean(d && d.attended);
}

/* ---------- Rendering ---------- */

function renderWeekdayBar() {
  const activeWd = getWeekdayForDate(fitnessState.selectedDate);
  document.getElementById("weekday-bar").innerHTML = WEEKDAYS.map((w) => {
    const planDay = fitnessState.plan[w.id];
    const count = (planDay?.exercises || []).length;
    const splitName = planDay?.title ? planDay.title.trim() : "";
    return `
      <button type="button" class="weekday-pill${w.id === activeWd ? " is-active" : ""}" data-weekday="${w.id}" role="tab" aria-selected="${w.id === activeWd}" title="${w.full}${splitName ? ` · ${splitName}` : ""}">
        <span class="wd-top">
          <span>${w.short}</span>
          ${count > 0 ? `<span class="wd-count mono">${count}</span>` : ""}
        </span>
        ${splitName ? `<span class="wd-split">${escapeHtml(splitName)}</span>` : ""}
      </button>
    `;
  }).join("");
}

function renderMainWorkout() {
  const key = fitnessState.selectedDate;
  const wd = getWeekdayForDate(key);
  const wdInfo = getWeekdayInfo(wd);
  const planDay = fitnessState.plan[wd];
  const savedLog = fitnessState.logs[key];
  const exercises = getEffectiveExercises(key);
  const went = isGymDay(key);
  const title = (savedLog && savedLog.title) || planDay.title || "";

  document.getElementById("selected-date-title").textContent = formatReadableDate(key);

  const toggleBtn = document.getElementById("btn-toggle-gym");
  const toggleText = document.getElementById("btn-toggle-gym-text");
  toggleBtn.classList.toggle("is-active", went);
  toggleBtn.setAttribute("aria-pressed", String(went));
  toggleText.textContent = went ? "Went to Gym ✓" : "Mark Gym Day";

  document.getElementById("split-day-label").textContent = `${wdInfo.full} Workout Split`;
  document.getElementById("list-day-heading").textContent = `${wdInfo.full} Exercises`;
  document.getElementById("input-preset-exercise").placeholder = `+ Add exercise to ${wdInfo.full}’s preset list…`;

  const titleInput = document.getElementById("workout-title-input");
  if (document.activeElement !== titleInput) {
    titleInput.value = title;
  }

  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.classList.toggle("is-selected", title.toLowerCase() === chip.dataset.split.toLowerCase());
  });

  const notesInput = document.getElementById("workout-notes-input");
  if (document.activeElement !== notesInput) {
    notesInput.value = (savedLog && savedLog.notes) || "";
  }

  const listEl = document.getElementById("exercise-list");
  if (!exercises.length) {
    const sampleKey = SAMPLE_SPLITS[title] ? title : null;
    listEl.innerHTML = `
      <div class="empty-exercises">
        No exercises preset for <strong>${wdInfo.full}</strong> yet — add them below once and they’ll load every ${wdInfo.full}.
        ${
          sampleKey
            ? `<div style="margin-top:10px;"><button type="button" class="hud-btn" id="btn-load-sample">Load starter ${sampleKey} exercises</button></div>`
            : ""
        }
      </div>
    `;
    const sampleBtn = document.getElementById("btn-load-sample");
    if (sampleBtn && sampleKey) {
      sampleBtn.addEventListener("click", () => {
        fitnessState.plan[wd].exercises = SAMPLE_SPLITS[sampleKey].map((s) => normalizeExercise({ ...s, id: makeId() }, true));
        savePlan();
        renderAll();
      });
    }
  } else {
    listEl.innerHTML = exercises
      .map((ex, idx) => {
        const isOpen = fitnessState.openDropdownId === ex.id;
        const safeName = escapeHtml(ex.name);
        const summary = escapeHtml(formatExerciseSummary(ex));

        const setRowsHtml = isOpen
          ? ex.setList
              .map((s, sIdx) => {
                const safeReps = escapeHtml(s.reps);
                const safeWeight = escapeHtml(s.weight);
                return `
                  <div class="set-row${s.done ? " is-set-done" : ""}">
                    <span class="set-num mono">Set ${sIdx + 1}</span>
                    <div class="dd-stepper">
                      <button type="button" class="tiny-step" data-action="dec-reps" data-index="${idx}" data-set="${sIdx}" aria-label="Decrease reps">−</button>
                      <input type="text" class="dark-input mono dd-input" data-field="reps" data-index="${idx}" data-set="${sIdx}" value="${safeReps}" placeholder="10" aria-label="Set ${sIdx + 1} reps" />
                      <button type="button" class="tiny-step" data-action="inc-reps" data-index="${idx}" data-set="${sIdx}" aria-label="Increase reps">+</button>
                    </div>
                    <div class="dd-stepper">
                      <button type="button" class="tiny-step" data-action="dec-weight" data-index="${idx}" data-set="${sIdx}" aria-label="Decrease weight by 2.5">−</button>
                      <input type="text" class="dark-input mono dd-input" data-field="weight" data-index="${idx}" data-set="${sIdx}" value="${safeWeight}" placeholder="kg" aria-label="Set ${sIdx + 1} weight" />
                      <button type="button" class="tiny-step" data-action="inc-weight" data-index="${idx}" data-set="${sIdx}" aria-label="Increase weight by 2.5">+</button>
                    </div>
                    <div class="set-row-actions">
                      <button type="button" class="set-check-btn${s.done ? " is-checked" : ""}" data-action="toggle-set" data-index="${idx}" data-set="${sIdx}" title="Mark Set ${sIdx + 1} complete">${s.done ? "✓" : ""}</button>
                      <button type="button" class="set-remove-btn" data-action="remove-set" data-index="${idx}" data-set="${sIdx}" title="Remove Set ${sIdx + 1}" ${ex.setList.length <= 1 ? "disabled" : ""}>×</button>
                    </div>
                  </div>
                `;
              })
              .join("")
          : "";

        return `
          <div class="exercise-item${ex.done ? " is-done" : ""}${isOpen ? " is-open" : ""}" data-ex-id="${ex.id}">
            <div class="exercise-row-simple">
              <div class="ex-name-cell">
                <button
                  type="button"
                  class="ex-check-btn"
                  data-action="toggle-ex"
                  data-index="${idx}"
                  aria-label="Mark ${safeName} done"
                  aria-pressed="${Boolean(ex.done)}"
                >${ex.done ? "✓" : ""}</button>
                <span class="ex-name">${safeName}</span>
              </div>

              <div class="ex-right-controls">
                <button
                  type="button"
                  class="ex-dropdown-trigger mono${isOpen ? " is-open" : ""}"
                  data-action="toggle-dropdown"
                  data-ex-id="${ex.id}"
                  aria-expanded="${isOpen}"
                >
                  <span class="dd-summary">${summary}</span>
                  <span class="dd-caret" aria-hidden="true">▾</span>
                </button>
              </div>
            </div>

            ${
              isOpen
                ? `
              <div class="perset-dropdown">
                <div class="perset-head mono">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Weight</span>
                  <span>Done</span>
                </div>
                <div class="perset-rows">
                  ${setRowsHtml}
                </div>
                <div class="perset-footer">
                  <button type="button" class="hud-btn" data-action="add-set" data-index="${idx}">+ Add Set</button>
                  <div class="dd-actions">
                    <button type="button" class="tiny-step" data-action="move-up" data-index="${idx}" title="Move up" ${idx === 0 ? "disabled" : ""}>↑</button>
                    <button type="button" class="tiny-step" data-action="move-down" data-index="${idx}" title="Move down" ${idx === exercises.length - 1 ? "disabled" : ""}>↓</button>
                    <button type="button" class="hud-btn" data-action="save-default" data-index="${idx}" title="Save these sets for future ${wdInfo.full}s">Save Default</button>
                    <button type="button" class="hud-btn hud-btn-accent" data-action="close-dropdown">Done</button>
                    <button type="button" class="ex-del-btn" data-action="delete-ex" data-index="${idx}" title="Delete exercise">✕</button>
                  </div>
                </div>
              </div>
            `
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  updateDayStats(exercises, went, title);
}

function updateDayStats(exercises, went, title) {
  const totalSets = exercises.reduce((sum, ex) => sum + countExerciseSets(ex), 0);
  const totalReps = exercises.reduce((sum, ex) => sum + countExerciseReps(ex), 0);

  document.getElementById("stat-day-sets").textContent = String(totalSets);
  document.getElementById("stat-day-ex").textContent = String(exercises.length);
  document.getElementById("stat-day-reps").textContent = String(totalReps);
  document.getElementById("insp-total-ex").textContent = String(exercises.length);
  document.getElementById("stat-day-status").textContent = went
    ? title
      ? `${title} · Logged ✓`
      : "Gym day logged ✓"
    : exercises.length
    ? "Tap any exercise dropdown ▾ to edit each set"
    : "Add exercises below to build this day’s routine";
}

function renderCalendar() {
  const year = fitnessState.calYear;
  const month = fitnessState.calMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  document.getElementById("cal-month-label").textContent = firstDay.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(`<span class="cal-cell is-empty"></span>`);
  }

  const tKey = todayKey();
  let monthGymDays = 0;
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const went = isGymDay(key);
    if (went) monthGymDays++;

    const cls = [
      "cal-cell",
      went ? "is-gym" : "",
      key === fitnessState.selectedDate ? "is-selected" : "",
      key === tKey ? "is-today" : "",
    ]
      .filter(Boolean)
      .join(" ");

    cells.push(`<button type="button" class="${cls}" data-date="${key}">${dayNum}</button>`);
  }
  document.getElementById("gym-cal-grid").innerHTML = cells.join("");

  const now = new Date();
  const curPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
  let curMonthDays = 0;
  let allTimeDays = 0;

  for (const k of Object.keys(fitnessState.logs)) {
    if (isGymDay(k)) {
      allTimeDays++;
      if (k.startsWith(curPrefix)) curMonthDays++;
    }
  }

  document.getElementById("stat-month-days").textContent = String(curMonthDays);
  document.getElementById("stat-all-days").textContent = `${allTimeDays} d`;
  document.getElementById("insp-month-count").textContent = String(monthGymDays);
  document.getElementById("gym-widget-month").textContent = `${curMonthDays} ${curMonthDays === 1 ? "day" : "days"}`;

  const goalPct = Math.min(100, Math.round((curMonthDays / 16) * 100));
  document.getElementById("gym-goal-pct").textContent = `${goalPct}%`;
  document.getElementById("gym-goal-fill").style.width = `${goalPct}%`;
  document.getElementById("gym-widget-today").textContent = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function renderWeeklySparkBars() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);

  const tKey = todayKey();
  let weekGymCount = 0;

  document.getElementById("week-spark-bars").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = toDateKey(d);
    const went = isGymDay(key);
    const exCount = (fitnessState.logs[key]?.exercises || []).length;
    if (went) weekGymCount++;

    const heightPct = went ? Math.min(100, Math.max(36, exCount * 16 + 24)) : 10;
    const cls = ["spark-needle", went ? "is-gym-bar" : "is-rest-bar", key === tKey ? "is-today-bar" : ""]
      .filter(Boolean)
      .join(" ");

    return `
      <button type="button" class="spark-col spark-col-btn" data-date="${key}" title="${key}">
        <span class="spark-pct">${went ? exCount || "✓" : "·"}</span>
        <div class="spark-track"><div class="${cls}" style="height:${heightPct}%"></div></div>
      </button>
    `;
  }).join("");

  document.getElementById("stat-week-days").textContent = `${weekGymCount} / 7`;
}

function renderRecentWorkouts() {
  const list = document.getElementById("recent-list");
  const gymKeys = Object.keys(fitnessState.logs)
    .filter((k) => isGymDay(k))
    .sort()
    .reverse()
    .slice(0, 5);

  if (!gymKeys.length) {
    list.innerHTML = `<div class="insp-stat-sub">No gym days logged yet.</div>`;
    return;
  }

  list.innerHTML = gymKeys
    .map((k) => {
      const d = fitnessState.logs[k];
      const nice = fromDateKey(k).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const title = d.title ? escapeHtml(d.title) : "Gym Session";
      const exs = (d.exercises || []).map((e) => normalizeExercise(e, false));
      const setsCount = exs.reduce((s, e) => s + countExerciseSets(e), 0);
      return `
        <button type="button" class="recent-item${k === fitnessState.selectedDate ? " is-selected" : ""}" data-date="${k}">
          <div>
            <div class="recent-title">${title}</div>
            <div class="recent-meta mono">${exs.length} ex · ${setsCount} sets</div>
          </div>
          <span class="recent-date mono">${nice}</span>
        </button>
      `;
    })
    .join("");
}

function renderAll() {
  renderWeekdayBar();
  renderMainWorkout();
  renderCalendar();
  renderWeeklySparkBars();
  renderRecentWorkouts();
}

/* ---------- Navigation & CSV Export ---------- */

function selectDate(dateKey) {
  fitnessState.selectedDate = dateKey;
  fitnessState.openDropdownId = null;
  const d = fromDateKey(dateKey);
  fitnessState.calYear = d.getFullYear();
  fitnessState.calMonth = d.getMonth();
  renderAll();
}

function jumpToWeekdayInCurrentWeek(targetWd) {
  const cur = fromDateKey(fitnessState.selectedDate);
  const curOffset = (cur.getDay() + 6) % 7;
  const targetOffset = (targetWd + 6) % 7;
  cur.setDate(cur.getDate() - curOffset + targetOffset);
  selectDate(toDateKey(cur));
}

function shiftSelectedDay(delta) {
  const d = fromDateKey(fitnessState.selectedDate);
  d.setDate(d.getDate() + delta);
  selectDate(toDateKey(d));
}

function exportFitnessCSV() {
  const keys = Object.keys(fitnessState.logs)
    .filter((k) => isGymDay(k))
    .sort();

  const lines = ["Date,Workout,Exercise,Set,Reps,Weight,Completed,Notes"];
  for (const k of keys) {
    const d = fitnessState.logs[k];
    const title = (d.title || "Gym Session").replace(/"/g, '""');
    const notes = (d.notes || "").replace(/"/g, '""').replace(/\n/g, " ");
    const exs = (d.exercises || []).map((e) => normalizeExercise(e, false));

    if (!exs.length) {
      lines.push(`"${k}","${title}","",0,"","",true,"${notes}"`);
    } else {
      for (const ex of exs) {
        const name = ex.name.replace(/"/g, '""');
        ex.setList.forEach((s, idx) => {
          const reps = String(s.reps || "").replace(/"/g, '""');
          const weight = String(s.weight || "").replace(/"/g, '""');
          lines.push(`"${k}","${title}","${name}",${idx + 1},"${reps}","${weight}",${Boolean(s.done)},"${notes}"`);
        });
      }
    }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gymsync-workouts-${todayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Events ---------- */

function bindEvents() {
  document.getElementById("btn-prev-day").addEventListener("click", () => shiftSelectedDay(-1));
  document.getElementById("btn-next-day").addEventListener("click", () => shiftSelectedDay(1));
  document.getElementById("btn-today").addEventListener("click", () => selectDate(todayKey()));
  document.getElementById("btn-jump-today-cta").addEventListener("click", () => selectDate(todayKey()));

  // Mon–Sun weekday strip
  document.getElementById("weekday-bar").addEventListener("click", (e) => {
    const pill = e.target.closest("[data-weekday]");
    if (!pill) return;
    jumpToWeekdayInCurrentWeek(Number(pill.dataset.weekday));
  });

  // Mark Gym Day toggle
  document.getElementById("btn-toggle-gym").addEventListener("click", () => {
    const day = ensureDayLog(fitnessState.selectedDate);
    day.attended = !day.attended;
    saveLogs();
    renderAll();
  });

  // Split title
  document.getElementById("workout-title-input").addEventListener("input", (e) => {
    const wd = getWeekdayForDate(fitnessState.selectedDate);
    fitnessState.plan[wd].title = e.target.value;
    savePlan();
    if (fitnessState.logs[fitnessState.selectedDate]) {
      fitnessState.logs[fitnessState.selectedDate].title = e.target.value;
      saveLogs();
    }
    renderWeekdayBar();
    renderRecentWorkouts();
  });

  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const wd = getWeekdayForDate(fitnessState.selectedDate);
      fitnessState.plan[wd].title = chip.dataset.split;
      savePlan();
      if (fitnessState.logs[fitnessState.selectedDate]) {
        fitnessState.logs[fitnessState.selectedDate].title = chip.dataset.split;
        saveLogs();
      }
      renderAll();
    });
  });

  // Add new preset exercise (defaults to 3 editable individual sets)
  document.getElementById("add-preset-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("input-preset-exercise");
    const name = input.value.trim();
    if (!name) return;

    const wd = getWeekdayForDate(fitnessState.selectedDate);
    const newPreset = normalizeExercise({ id: makeId(), name, sets: 3, reps: "10", weight: "" }, true);
    fitnessState.plan[wd].exercises.push(newPreset);
    savePlan();

    if (fitnessState.logs[fitnessState.selectedDate]) {
      fitnessState.logs[fitnessState.selectedDate].exercises = getEffectiveExercises(fitnessState.selectedDate);
      saveLogs();
    }

    input.value = "";
    input.focus();
    renderAll();
  });

  // Session notes
  document.getElementById("workout-notes-input").addEventListener("input", (e) => {
    const day = ensureDayLog(fitnessState.selectedDate);
    day.notes = e.target.value;
    saveLogs();
  });

  // Exercise & per-set actions
  const exList = document.getElementById("exercise-list");

  exList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "toggle-dropdown") {
      const id = btn.dataset.exId;
      fitnessState.openDropdownId = fitnessState.openDropdownId === id ? null : id;
      renderMainWorkout();
      return;
    }

    if (action === "close-dropdown") {
      fitnessState.openDropdownId = null;
      renderMainWorkout();
      return;
    }

    const idx = Number(btn.dataset.index);
    const setIdx = btn.dataset.set !== undefined ? Number(btn.dataset.set) : null;
    const day = ensureDayLog(fitnessState.selectedDate);
    const ex = day.exercises[idx];
    if (!ex) return;

    if (action === "toggle-ex") {
      ex.done = !ex.done;
      ex.setList.forEach((s) => {
        s.done = ex.done;
      });
      if (ex.done) day.attended = true;
      saveLogs();
      renderAll();
      return;
    }

    if (action === "toggle-set" && setIdx !== null && ex.setList[setIdx]) {
      ex.setList[setIdx].done = !ex.setList[setIdx].done;
      ex.done = ex.setList.every((s) => s.done);
      if (ex.setList[setIdx].done) day.attended = true;
      saveLogs();
      renderAll();
      return;
    }

    if (action === "add-set") {
      const last = ex.setList[ex.setList.length - 1] || { reps: "10", weight: "" };
      ex.setList.push({ reps: last.reps, weight: last.weight, done: false });
      ex.done = false;
      day.attended = true;
      saveLogs();
      renderAll();
      return;
    }

    if (action === "remove-set" && setIdx !== null && ex.setList.length > 1) {
      ex.setList.splice(setIdx, 1);
      ex.done = ex.setList.every((s) => s.done);
      saveLogs();
      renderAll();
      return;
    }

    if ((action === "inc-reps" || action === "dec-reps") && setIdx !== null && ex.setList[setIdx]) {
      const cur = Math.round(parseLeadingNumber(ex.setList[setIdx].reps)) || 10;
      ex.setList[setIdx].reps = String(Math.max(1, cur + (action === "inc-reps" ? 1 : -1)));
      day.attended = true;
      saveLogs();
      renderAll();
      return;
    }

    if ((action === "inc-weight" || action === "dec-weight") && setIdx !== null && ex.setList[setIdx]) {
      const m = String(ex.setList[setIdx].weight || "").match(/(\d+(?:\.\d+)?)\s*(.*)/);
      const cur = m ? parseFloat(m[1]) : 0;
      const unit = m && m[2] ? m[2].trim() : "kg";
      const next = Math.max(0, +(cur + (action === "inc-weight" ? 2.5 : -2.5)).toFixed(1));
      ex.setList[setIdx].weight = next === 0 ? "" : `${next} ${unit}`;
      day.attended = true;
      saveLogs();
      renderAll();
      return;
    }

    if (action === "move-up" || action === "move-down") {
      const swapIdx = action === "move-up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= day.exercises.length) return;
      [day.exercises[idx], day.exercises[swapIdx]] = [day.exercises[swapIdx], day.exercises[idx]];
      const wd = getWeekdayForDate(fitnessState.selectedDate);
      fitnessState.plan[wd].exercises = day.exercises.map((item) => normalizeExercise(item, true));
      savePlan();
      saveLogs();
      renderAll();
      return;
    }

    if (action === "save-default") {
      const wd = getWeekdayForDate(fitnessState.selectedDate);
      const cleanDefault = normalizeExercise(ex, true);
      const matchIdx = fitnessState.plan[wd].exercises.findIndex(
        (p) => p.id === ex.id || p.name.toLowerCase() === ex.name.toLowerCase()
      );
      if (matchIdx >= 0) {
        fitnessState.plan[wd].exercises[matchIdx] = cleanDefault;
      } else {
        fitnessState.plan[wd].exercises.push(cleanDefault);
      }
      savePlan();
      btn.textContent = "Saved ✓";
      setTimeout(() => {
        if (btn) btn.textContent = "Save Default";
      }, 1000);
      return;
    }

    if (action === "delete-ex") {
      const removed = day.exercises.splice(idx, 1)[0];
      const wd = getWeekdayForDate(fitnessState.selectedDate);
      fitnessState.plan[wd].exercises = fitnessState.plan[wd].exercises.filter(
        (p) => p.id !== removed.id && p.name.toLowerCase() !== removed.name.toLowerCase()
      );
      fitnessState.openDropdownId = null;
      savePlan();
      saveLogs();
      renderAll();
    }
  });

  // Live typing inside any individual set's Reps or Weight input (keeps keyboard focus!)
  exList.addEventListener("input", (e) => {
    const input = e.target.closest(".dd-input");
    if (!input) return;
    const idx = Number(input.dataset.index);
    const setIdx = Number(input.dataset.set);
    const field = input.dataset.field;
    const day = ensureDayLog(fitnessState.selectedDate);
    const ex = day.exercises[idx];
    if (!ex || !ex.setList[setIdx]) return;

    day.attended = true;
    if (field === "reps") ex.setList[setIdx].reps = input.value;
    if (field === "weight") ex.setList[setIdx].weight = input.value;
    saveLogs();

    // Update collapsed summary pill & stats without re-rendering focused input
    const item = input.closest(".exercise-item");
    if (item) {
      const summaryEl = item.querySelector(".dd-summary");
      if (summaryEl) summaryEl.textContent = formatExerciseSummary(ex);
    }

    updateDayStats(day.exercises, day.attended, day.title);
    renderCalendar();
    renderWeeklySparkBars();
    renderRecentWorkouts();
  });

  // Calendar navigation & day selection
  document.getElementById("cal-prev").addEventListener("click", () => {
    fitnessState.calMonth--;
    if (fitnessState.calMonth < 0) {
      fitnessState.calMonth = 11;
      fitnessState.calYear--;
    }
    renderCalendar();
  });

  document.getElementById("cal-next").addEventListener("click", () => {
    fitnessState.calMonth++;
    if (fitnessState.calMonth > 11) {
      fitnessState.calMonth = 0;
      fitnessState.calYear++;
    }
    renderCalendar();
  });

  document.getElementById("gym-cal-grid").addEventListener("click", (e) => {
    const cell = e.target.closest("[data-date]");
    if (cell) selectDate(cell.dataset.date);
  });

  document.getElementById("week-spark-bars").addEventListener("click", (e) => {
    const col = e.target.closest("[data-date]");
    if (col) selectDate(col.dataset.date);
  });

  document.getElementById("recent-list").addEventListener("click", (e) => {
    const item = e.target.closest("[data-date]");
    if (item) selectDate(item.dataset.date);
  });

  document.getElementById("btn-export-fitness").addEventListener("click", exportFitnessCSV);
}

renderAll();
bindEvents();
