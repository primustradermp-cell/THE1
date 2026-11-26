/* GymSync — Simple Fitness, Gym Days, Exercises, Sets & Reps Tracker */

const FITNESS_STORAGE_KEY = "salahsync_fitness_logs_v1";

const fitnessState = {
  selectedDate: toDateKey(new Date()),
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(), // 0-indexed
  logs: loadFitnessLogs(),
};

/* ---------- Storage ---------- */

function loadFitnessLogs() {
  try {
    const raw = localStorage.getItem(FITNESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFitnessLogs() {
  localStorage.setItem(FITNESS_STORAGE_KEY, JSON.stringify(fitnessState.logs));
}

function getOrCreateDay(dateKey) {
  if (!fitnessState.logs[dateKey]) {
    fitnessState.logs[dateKey] = {
      attended: false,
      title: "",
      notes: "",
      exercises: [],
    };
  }
  return fitnessState.logs[dateKey];
}

function getDay(dateKey) {
  return fitnessState.logs[dateKey] || {
    attended: false,
    title: "",
    notes: "",
    exercises: [],
  };
}

function isGymDay(dateKey) {
  const d = fitnessState.logs[dateKey];
  return Boolean(d && d.attended);
}

/* ---------- Date Helpers ---------- */

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
  const match = String(val || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

/* ---------- Rendering ---------- */

function renderDayPanel() {
  const key = fitnessState.selectedDate;
  const day = getDay(key);
  const went = isGymDay(key);

  document.getElementById("selected-date-title").textContent = formatReadableDate(key);
  const keyEl = document.getElementById("selected-date-key");
  if (keyEl) keyEl.textContent = key;

  const toggleBtn = document.getElementById("btn-toggle-gym");
  const toggleText = document.getElementById("btn-toggle-gym-text");
  toggleBtn.classList.toggle("is-active", went);
  toggleBtn.setAttribute("aria-pressed", String(went));
  toggleText.textContent = went ? "Went to Gym ✓" : "Mark Gym Day";

  const titleInput = document.getElementById("workout-title-input");
  if (document.activeElement !== titleInput) {
    titleInput.value = day.title || "";
  }

  const notesInput = document.getElementById("workout-notes-input");
  if (document.activeElement !== notesInput) {
    notesInput.value = day.notes || "";
  }

  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.classList.toggle("is-selected", (day.title || "").toLowerCase() === chip.dataset.split.toLowerCase());
  });

  // Exercise List
  const listEl = document.getElementById("exercise-list");
  if (!day.exercises.length) {
    listEl.innerHTML = `
      <div class="empty-exercises">
        No exercises logged for this day yet. Add an exercise above (e.g. Bench Press, 4 sets × 8 reps).
      </div>
    `;
  } else {
    listEl.innerHTML = day.exercises
      .map((ex, idx) => {
        const safeName = escapeHtml(ex.name);
        const safeReps = escapeHtml(ex.reps);
        const safeWeight = ex.weight ? escapeHtml(ex.weight) : "—";
        return `
          <div class="exercise-row${ex.done ? " is-done" : ""}">
            <div class="ex-name-cell">
              <button
                type="button"
                class="ex-check-btn"
                data-action="toggle-ex"
                data-index="${idx}"
                aria-label="Mark ${safeName} complete"
                aria-pressed="${Boolean(ex.done)}"
              >${ex.done ? "✓" : ""}</button>
              <span class="ex-name">${safeName}</span>
            </div>
            <div class="ex-sets-reps mono">
              <button type="button" class="tiny-step" data-action="dec-sets" data-index="${idx}" aria-label="Decrease sets">−</button>
              <span>${ex.sets} × ${safeReps}</span>
              <button type="button" class="tiny-step" data-action="inc-sets" data-index="${idx}" aria-label="Increase sets">+</button>
            </div>
            <div class="ex-weight mono">${safeWeight}</div>
            <div class="ex-actions">
              <button type="button" class="ex-del-btn" data-action="delete-ex" data-index="${idx}" aria-label="Delete ${safeName}">✕</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Day totals
  const totalSets = day.exercises.reduce((sum, ex) => sum + (Number(ex.sets) || 0), 0);
  const totalReps = day.exercises.reduce(
    (sum, ex) => sum + (Number(ex.sets) || 0) * parseLeadingNumber(ex.reps),
    0
  );

  document.getElementById("stat-day-sets").textContent = String(totalSets);
  document.getElementById("stat-day-ex").textContent = String(day.exercises.length);
  document.getElementById("stat-day-reps").textContent = String(totalReps);
  document.getElementById("insp-total-ex").textContent = String(day.exercises.length);
  document.getElementById("stat-day-status").textContent = went
    ? day.title
      ? `${day.title} · Logged`
      : "Gym day logged ✓"
    : "Rest day — log an exercise or tap Mark Gym Day";
}

function renderCalendar() {
  const year = fitnessState.calYear;
  const month = fitnessState.calMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 .. Sun=6

  const label = firstDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  document.getElementById("cal-month-label").textContent = label;

  const grid = document.getElementById("gym-cal-grid");
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

    cells.push(
      `<button type="button" class="${cls}" data-date="${key}" title="${key}${went ? " · Gym Day" : ""}">${dayNum}</button>`
    );
  }

  grid.innerHTML = cells.join("");

  // Update monthly KPIs (for current calendar month)
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

  // Monthly consistency bar against a 16-day/month target (~4x/week)
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
  const dow = (now.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);

  const tKey = todayKey();
  const container = document.getElementById("week-spark-bars");
  let weekGymCount = 0;

  const html = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = toDateKey(d);
    const went = isGymDay(key);
    const exCount = getDay(key).exercises.length;
    if (went) weekGymCount++;

    const heightPct = went ? Math.min(100, Math.max(36, exCount * 16 + 24)) : 10;
    const cls = [
      "spark-needle",
      went ? "is-gym-bar" : "is-rest-bar",
      key === tKey ? "is-today-bar" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <button type="button" class="spark-col spark-col-btn" data-date="${key}" title="${key}${went ? ` · ${exCount} exercises` : " · Rest"}">
        <span class="spark-pct">${went ? (exCount || "✓") : "·"}</span>
        <div class="spark-track">
          <div class="${cls}" style="height:${heightPct}%"></div>
        </div>
      </button>
    `;
  }).join("");

  container.innerHTML = html;
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
    list.innerHTML = `<div class="insp-stat-sub">No workouts logged yet. Add one on the left to start tracking.</div>`;
    return;
  }

  list.innerHTML = gymKeys
    .map((k) => {
      const d = getDay(k);
      const nice = fromDateKey(k).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const title = d.title ? escapeHtml(d.title) : "Gym Session";
      const exCount = d.exercises.length;
      const setsCount = d.exercises.reduce((s, e) => s + (Number(e.sets) || 0), 0);
      return `
        <button type="button" class="recent-item${k === fitnessState.selectedDate ? " is-selected" : ""}" data-date="${k}">
          <div>
            <div class="recent-title">${title}</div>
            <div class="recent-meta mono">${exCount} ex · ${setsCount} sets</div>
          </div>
          <span class="recent-date mono">${nice}</span>
        </button>
      `;
    })
    .join("");
}

function renderAll() {
  renderDayPanel();
  renderCalendar();
  renderWeeklySparkBars();
  renderRecentWorkouts();
}

/* ---------- Actions ---------- */

function selectDate(dateKey) {
  fitnessState.selectedDate = dateKey;
  const d = fromDateKey(dateKey);
  fitnessState.calYear = d.getFullYear();
  fitnessState.calMonth = d.getMonth();
  renderAll();
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

  const lines = ["Date,Workout,Exercise,Sets,Reps,Weight,Completed,Notes"];
  for (const k of keys) {
    const d = getDay(k);
    const title = (d.title || "Gym Session").replace(/"/g, '""');
    const notes = (d.notes || "").replace(/"/g, '""').replace(/\n/g, " ");

    if (!d.exercises.length) {
      lines.push(`"${k}","${title}","",0,"","",true,"${notes}"`);
    } else {
      for (const ex of d.exercises) {
        const name = (ex.name || "").replace(/"/g, '""');
        const reps = String(ex.reps || "").replace(/"/g, '""');
        const weight = String(ex.weight || "").replace(/"/g, '""');
        lines.push(`"${k}","${title}","${name}",${ex.sets},"${reps}","${weight}",${Boolean(ex.done)},"${notes}"`);
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Events ---------- */

function bindEvents() {
  document.getElementById("btn-prev-day").addEventListener("click", () => shiftSelectedDay(-1));
  document.getElementById("btn-next-day").addEventListener("click", () => shiftSelectedDay(1));
  document.getElementById("btn-today").addEventListener("click", () => selectDate(todayKey()));

  // Toggle gym attendance
  document.getElementById("btn-toggle-gym").addEventListener("click", () => {
    const day = getOrCreateDay(fitnessState.selectedDate);
    day.attended = !day.attended;
    saveFitnessLogs();
    renderAll();
  });

  // Workout title & notes auto-save
  document.getElementById("workout-title-input").addEventListener("input", (e) => {
    const day = getOrCreateDay(fitnessState.selectedDate);
    day.title = e.target.value;
    if (e.target.value.trim()) day.attended = true;
    saveFitnessLogs();
    renderCalendar();
    renderWeeklySparkBars();
    renderRecentWorkouts();
  });

  document.getElementById("workout-notes-input").addEventListener("input", (e) => {
    const day = getOrCreateDay(fitnessState.selectedDate);
    day.notes = e.target.value;
    saveFitnessLogs();
  });

  // Quick split chips
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const day = getOrCreateDay(fitnessState.selectedDate);
      day.title = chip.dataset.split;
      day.attended = true;
      document.getElementById("workout-title-input").value = day.title;
      saveFitnessLogs();
      renderAll();
    });
  });

  // Add exercise form
  document.getElementById("add-exercise-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameEl = document.getElementById("input-exercise");
    const setsEl = document.getElementById("input-sets");
    const repsEl = document.getElementById("input-reps");
    const weightEl = document.getElementById("input-weight");

    const name = nameEl.value.trim();
    if (!name) return;

    const day = getOrCreateDay(fitnessState.selectedDate);
    day.attended = true;
    day.exercises.push({
      name,
      sets: Math.max(1, Number(setsEl.value) || 3),
      reps: repsEl.value.trim() || "10",
      weight: weightEl.value.trim(),
      done: false,
    });

    saveFitnessLogs();
    nameEl.value = "";
    weightEl.value = "";
    nameEl.focus();
    renderAll();
  });

  // Exercise row delegated actions (toggle complete, +/- sets, delete)
  document.getElementById("exercise-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = Number(btn.dataset.index);
    const day = getOrCreateDay(fitnessState.selectedDate);
    const ex = day.exercises[idx];
    if (!ex) return;

    if (action === "toggle-ex") {
      ex.done = !ex.done;
    } else if (action === "inc-sets") {
      ex.sets = Math.min(50, (Number(ex.sets) || 1) + 1);
    } else if (action === "dec-sets") {
      ex.sets = Math.max(1, (Number(ex.sets) || 1) - 1);
    } else if (action === "delete-ex") {
      day.exercises.splice(idx, 1);
    }

    saveFitnessLogs();
    renderAll();
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

  // Export CSV
  document.getElementById("btn-export-fitness").addEventListener("click", exportFitnessCSV);

  // Pinned CTA: jump to today & focus exercise box
  document.getElementById("btn-log-today-cta").addEventListener("click", () => {
    selectDate(todayKey());
    const day = getOrCreateDay(todayKey());
    day.attended = true;
    saveFitnessLogs();
    renderAll();
    document.getElementById("input-exercise").focus();
  });
}

renderAll();
bindEvents();
