let currentDate;
let targets = { cal: 2500, pro: 180, carb: 250, fat: 70 };
let queuedFood = null;

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function renderWeeklySummary() {
  const sums = { cal: 0, pro: 0, carb: 0, fat: 0 };
  // last 7 days including currentDate
  for (let i = 6; i >= 0; i--) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - i);
    const dayLog = getLog(dateKey(d));
    const dayTotals = dayLog.reduce(
      (a, e) => {
        a.cal += e.cal;
        a.pro += e.pro;
        a.carb += e.carb;
        a.fat += e.fat;
        return a;
      },
      { cal: 0, pro: 0, carb: 0, fat: 0 },
    );
    sums.cal += dayTotals.cal;
    sums.pro += dayTotals.pro;
    sums.carb += dayTotals.carb;
    sums.fat += dayTotals.fat;
  }

  // average per day across 7 days
  const avg = {
    cal: Math.round(sums.cal / 7),
    pro: Math.round(sums.pro / 7),
    carb: Math.round(sums.carb / 7),
    fat: Math.round(sums.fat / 7),
  };

  const elCal = document.getElementById("wsCal");
  const elPro = document.getElementById("wsPro");
  const elCarb = document.getElementById("wsCarb");
  const elFat = document.getElementById("wsFat");
  if (elCal) elCal.textContent = avg.cal;
  if (elPro) elPro.textContent = avg.pro + "g";
  if (elCarb) elCarb.textContent = avg.carb + "g";
  if (elFat) elFat.textContent = avg.fat + "g";
}
function parseDateKey(key) {
  const parts = (key || "").split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const dd = parseInt(parts[2], 10);
  return new Date(y, m, dd);
}

function saveCurrentDate() {
  try {
    setLS("ct3_currentDate", dateKey(currentDate));
  } catch (e) {}
}

function loadCurrentDate() {
  const saved = getLS("ct3_currentDate", null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (saved) {
    const pd = parseDateKey(saved);
    if (pd) {
      pd.setHours(0, 0, 0, 0);
      // don't allow future dates beyond today
      if (pd.getTime() > today.getTime()) {
        currentDate = new Date(today);
      } else {
        currentDate = pd;
      }
      return;
    }
  }
  currentDate = new Date(today);
}

function startAutoRollover() {
  setInterval(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cur = new Date(currentDate);
    cur.setHours(0, 0, 0, 0);
    if (today.getTime() > cur.getTime()) {
      currentDate = new Date(today);
      saveCurrentDate();
      renderAll();
    }
  }, 60 * 1000);
}
function getLS(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch (e) {
    return def;
  }
}
function setLS(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
}
function getLog(ds) {
  return getLS("ct3_log_" + ds, []);
}
function saveLog(ds, log) {
  setLS("ct3_log_" + ds, log);
}
function getMyFoods() {
  return getLS("ct3_myfoods", []);
}
function saveMyFoods(f) {
  setLS("ct3_myfoods", f);
}

function formatDate(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diff = (dd - today) / 86400000;
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function changeDay(n) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + n);
  if (d > new Date()) return;
  currentDate = d;
  saveCurrentDate();
  renderAll();
}

function switchTab(t) {
  document
    .getElementById("tab-myfoods")
    .classList.toggle("section-hide", t !== "myfoods");
  document
    .getElementById("tab-new")
    .classList.toggle("section-hide", t !== "new");
  document
    .querySelectorAll(".tab")
    .forEach((el, i) =>
      el.classList.toggle("active", ["myfoods", "new"][i] === t),
    );
  if (t === "myfoods") renderMyFoods();
}

function renderAll() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cur = new Date(currentDate);
  cur.setHours(0, 0, 0, 0);
  document.getElementById("nextBtn").disabled = cur >= today;
  document.getElementById("dateLabel").textContent = formatDate(currentDate);
  const isToday = cur.getTime() === today.getTime();
  document.getElementById("logTitle").textContent = isToday
    ? "Today's log"
    : formatDate(currentDate) + "'s log";
  const log = getLog(dateKey(currentDate));
  renderLog(log);
  renderSummary(log);
  renderWeeklySummary();
  renderMyFoods();
  renderTrend();
}

// --- Charting ---
function getDatesForRange(range, endDate) {
  const days = range === "week" ? 7 : 30;
  const res = [];
  const d = new Date(endDate);
  d.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    res.push(dd);
  }
  return res;
}

function aggregateMetricForDates(dates, metric) {
  return dates.map((d) => {
    const log = getLog(dateKey(d));
    const val = log.reduce((s, it) => s + (parseFloat(it[metric]) || 0), 0);
    return { date: d, label: formatDate(d), value: val };
  });
}

function metricColor(metric) {
  return {
    cal:
      getComputedStyle(document.documentElement).getPropertyValue("--c-cal") ||
      "#3266ad",
    pro: "#1d9e75",
    carb: "#ba7517",
    fat: "#d4537e",
  }[metric];
}

function onChartOptionsChange() {
  renderTrend();
}

function renderTrend() {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
  const metric = document.getElementById("chartMetric").value || "cal";
  const range = document.getElementById("chartRange").value || "week";
  const dates = getDatesForRange(range, new Date());
  const data = aggregateMetricForDates(dates, metric);

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  // robust size handling (fallbacks for Firefox when rect can be zero)
  const cssWidth =
    rect.width || canvas.clientWidth || parseInt(canvas.style.width) || 720;
  const cssHeight =
    rect.height || canvas.clientHeight || parseInt(canvas.style.height) || 200;
  canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
  canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
  const ctx = canvas.getContext("2d");
  // reset transform then scale for DPR
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // clear
  ctx.clearRect(0, 0, rect.width, rect.height);

  const padding = { l: 36, r: 12, t: 12, b: 28 };
  const w = rect.width - padding.l - padding.r;
  const h = rect.height - padding.t - padding.b;

  // compute max and grid
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = max / 4;

  // draw grid & y labels
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = (
    getComputedStyle(document.body).getPropertyValue(
      "--color-text-secondary",
    ) || "#6b7280"
  ).trim();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = (
    getComputedStyle(document.body).getPropertyValue(
      "--color-border-tertiary",
    ) || "#eaeef2"
  ).trim();
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.t + (h * i) / 4;
    const val = Math.round(max - step * i);
    ctx.fillText(val, padding.l - 8, y);
    ctx.beginPath();
    ctx.moveTo(padding.l, y + 0.5);
    ctx.lineTo(padding.l + w, y + 0.5);
    ctx.stroke();
  }

  // line path points (scale relative to max)
  const pts = data.map((d, i) => {
    const x = padding.l + (w * i) / Math.max(1, data.length - 1);
    const y = padding.t + h - h * (d.value / max);
    return { x, y, v: d.value, lbl: d.label, date: d.date };
  });

  const color =
    {
      cal: "#3266ad",
      pro: "#1d9e75",
      carb: "#ba7517",
      fat: "#d4537e",
    }[metric] || "#3266ad";

  // draw area fill
  ctx.beginPath();
  pts.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.lineTo(padding.l + w, padding.t + h);
  ctx.lineTo(padding.l, padding.t + h);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(color, 0.08);
  ctx.fill();

  // draw line
  ctx.beginPath();
  pts.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // draw points
  pts.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // x labels
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue(
    "--color-text-secondary",
  );
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const skip = data.length > 14 ? Math.ceil(data.length / 7) : 1;
  pts.forEach((p, i) => {
    if (i % skip === 0 || i === pts.length - 1) {
      ctx.fillText(shortDateLabel(p.date), p.x, padding.t + h + 6);
    }
  });

  // attach tooltip interactions
  attachChartInteraction(canvas, pts, metric);
}

function shortDateLabel(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

let _lastChartPts = null;
function attachChartInteraction(canvas, pts, metric) {
  _lastChartPts = pts;
  const tooltip = document.getElementById("chartTooltip");
  function move(e) {
    const rect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // find nearest
    let nearest = null;
    let minDist = Infinity;
    pts.forEach((p) => {
      const dx = Math.abs(p.x - x);
      if (dx < minDist) {
        minDist = dx;
        nearest = p;
      }
    });
    if (!nearest) return;
    tooltip.style.display = "block";
    tooltip.innerHTML = `<strong>${nearest.lbl}</strong><div style="margin-top:6px">${metricLabel(metric)}: ${Math.round(nearest.v)}${metric === "cal" ? " kcal" : "g"}</div>`;
    // position within chart-wrap
    const ttW = tooltip.offsetWidth || 120;
    const ttH = tooltip.offsetHeight || 48;
    let left = Math.round(nearest.x - ttW / 2);
    left = Math.max(8, Math.min(containerRect.width - ttW - 8, left));
    let top = Math.round(nearest.y - ttH - 10);
    if (top < 4) top = nearest.y + 10;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
    tooltip.style.transform = "none";
  }
  function leave() {
    tooltip.style.display = "none";
  }
  canvas.removeEventListener("mousemove", canvas._ctMove || (() => {}));
  canvas.removeEventListener("mouseleave", canvas._ctLeave || (() => {}));
  canvas._ctMove = move;
  canvas._ctLeave = leave;
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseleave", leave);
}

function metricLabel(m) {
  return { cal: "Calories", pro: "Protein", carb: "Carbs", fat: "Fat" }[m] || m;
}

function renderSummary(log) {
  const t = log.reduce(
    (a, e) => {
      a.cal += e.cal;
      a.pro += e.pro;
      a.carb += e.carb;
      a.fat += e.fat;
      return a;
    },
    { cal: 0, pro: 0, carb: 0, fat: 0 },
  );

  function renderWeeklySummary() {
    const sums = { cal: 0, pro: 0, carb: 0, fat: 0 };
    // last 7 days including currentDate
    for (let i = 6; i >= 0; i--) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - i);
      const dayLog = getLog(dateKey(d));
      const dayTotals = dayLog.reduce(
        (a, e) => {
          a.cal += e.cal;
          a.pro += e.pro;
          a.carb += e.carb;
          a.fat += e.fat;
          return a;
        },
        { cal: 0, pro: 0, carb: 0, fat: 0 },
      );
      sums.cal += dayTotals.cal;
      sums.pro += dayTotals.pro;
      sums.carb += dayTotals.carb;
      sums.fat += dayTotals.fat;
    }

    // average per day across 7 days
    const avg = {
      cal: Math.round(sums.cal / 7),
      pro: Math.round(sums.pro / 7),
      carb: Math.round(sums.carb / 7),
      fat: Math.round(sums.fat / 7),
    };

    const elCal = document.getElementById("wsCal");
    const elPro = document.getElementById("wsPro");
    const elCarb = document.getElementById("wsCarb");
    const elFat = document.getElementById("wsFat");
    if (elCal) elCal.textContent = avg.cal;
    if (elPro) elPro.textContent = avg.pro + "g";
    if (elCarb) elCarb.textContent = avg.carb + "g";
    if (elFat) elFat.textContent = avg.fat + "g";
  }
  document.getElementById("totCal").textContent = Math.round(t.cal);
  document.getElementById("totPro").textContent = Math.round(t.pro) + "g";
  document.getElementById("totCarb").textContent = Math.round(t.carb) + "g";
  document.getElementById("totFat").textContent = Math.round(t.fat) + "g";

  function setSub(id, val, unit, tgt) {
    const el = document.getElementById(id);
    const rem = tgt - val;
    el.textContent =
      rem >= 0
        ? Math.round(rem) + unit + " left"
        : Math.round(-rem) + unit + " over";
    el.className = "sub" + (rem < 0 ? " over" : "");
  }
  setSub("remCal", t.cal, " kcal", targets.cal);
  setSub("remPro", t.pro, "g", targets.pro);
  setSub("remCarb", t.carb, "g", targets.carb);
  setSub("remFat", t.fat, "g", targets.fat);

  function pct(v, tgt) {
    return Math.min(100, Math.round(tgt > 0 ? (v / tgt) * 100 : 0));
  }
  const calBar = document.getElementById("barCal");
  calBar.style.width = pct(t.cal, targets.cal) + "%";
  calBar.className =
    "progress-fill " + (t.cal > targets.cal ? "c-cal-over" : "c-cal");
  document.getElementById("barPro").style.width = pct(t.pro, targets.pro) + "%";
  document.getElementById("barCarb").style.width =
    pct(t.carb, targets.carb) + "%";
  document.getElementById("barFat").style.width = pct(t.fat, targets.fat) + "%";
}

function renderLog(log) {
  const el = document.getElementById("logList");
  if (!log.length) {
    el.innerHTML = '<div class="empty">No food logged yet</div>';
    return;
  }
  el.innerHTML = log
    .map(
      (item, i) => `
    <div class="log-item">
      <div>
        <div class="log-name">${item.name}</div>
        <div class="log-macros">${item.servingLabel ? item.servingLabel + " · " : ""}P: ${Math.round(item.pro)}g · C: ${Math.round(item.carb)}g · F: ${Math.round(item.fat)}g</div>
      </div>
      <div class="log-right">
        <div class="log-cal">${Math.round(item.cal)} kcal</div>
        <button class="btn-icon" onclick="deleteEntry(${i})">✕</button>
      </div>
    </div>`,
    )
    .join("");
}

function deleteEntry(i) {
  const key = dateKey(currentDate);
  const log = getLog(key);
  log.splice(i, 1);
  saveLog(key, log);
  renderAll();
}

function renderMyFoods() {
  const foods = getMyFoods();
  const q = (document.getElementById("mfSearch")?.value || "").toLowerCase();
  const filtered = q
    ? foods.filter((f) => f.name.toLowerCase().includes(q))
    : foods;
  const el = document.getElementById("myFoodsList");
  if (!filtered.length) {
    el.innerHTML =
      foods.length === 0
        ? '<div class="empty">No saved foods yet. Add your first food using the "Add new food" tab.</div>'
        : '<div class="empty">No foods match your search.</div>';
    return;
  }
  el.innerHTML = filtered
    .map((f, i) => {
      const realIdx = foods.indexOf(f);
      const servingLabel = f.serving
        ? f.serving + "g per serving"
        : "per serving";
      return `<div class="mf-item">
      <div>
        <div class="mf-name">${f.name}</div>
        <div class="mf-meta">${Math.round(f.cal)} kcal · ${servingLabel} · P: ${Math.round(f.pro)}g · C: ${Math.round(f.carb)}g · F: ${Math.round(f.fat)}g</div>
      </div>
      <div class="mf-right">
        <button class="btn-log" onclick="openQtyModal(${realIdx})">+ Log</button>
        <button class="btn-icon" onclick="deleteMyFood(${realIdx})">✕</button>
      </div>
    </div>`;
    })
    .join("");
}

function deleteMyFood(i) {
  const foods = getMyFoods();
  if (!confirm('Delete "' + foods[i].name + '" from your saved foods?')) return;
  foods.splice(i, 1);
  saveMyFoods(foods);
  renderMyFoods();
}

function openQtyModal(i) {
  const f = getMyFoods()[i];
  queuedFood = f;
  document.getElementById("qModalName").textContent = f.name;
  document.getElementById("qModalSub").textContent = f.serving
    ? "1 serving = " + f.serving + "g"
    : "1 serving";
  document.getElementById("qtyInput").value = 1;
  updateQtyPreview();
  document.getElementById("qtyModal").classList.add("open");
}

function closeQtyModal() {
  document.getElementById("qtyModal").classList.remove("open");
  queuedFood = null;
}

function updateQtyPreview() {
  if (!queuedFood) return;
  const qty = parseFloat(document.getElementById("qtyInput").value) || 0;
  document.getElementById("qpCal").textContent = Math.round(
    queuedFood.cal * qty,
  );
  document.getElementById("qpPro").textContent =
    Math.round(queuedFood.pro * qty) + "g";
  document.getElementById("qpCarb").textContent =
    Math.round(queuedFood.carb * qty) + "g";
  document.getElementById("qpFat").textContent =
    Math.round(queuedFood.fat * qty) + "g";
}

function confirmLog() {
  const qty = parseFloat(document.getElementById("qtyInput").value) || 0;
  if (!qty || !queuedFood) return;
  const key = dateKey(currentDate);
  const log = getLog(key);
  const servingLabel = qty === 1 ? "1 serving" : qty + " servings";
  log.push({
    name: queuedFood.name,
    servingLabel,
    cal: queuedFood.cal * qty,
    pro: queuedFood.pro * qty,
    carb: queuedFood.carb * qty,
    fat: queuedFood.fat * qty,
  });
  saveLog(key, log);
  closeQtyModal();
  renderAll();
}

function saveNewFood() {
  const name = document.getElementById("cName").value.trim();
  const cal = parseFloat(document.getElementById("cCal").value) || 0;
  const serving = parseFloat(document.getElementById("cServing").value) || null;
  const pro = parseFloat(document.getElementById("cPro").value) || 0;
  const carb = parseFloat(document.getElementById("cCarb").value) || 0;
  const fat = parseFloat(document.getElementById("cFat").value) || 0;
  if (!name) {
    alert("Please enter a food name.");
    return;
  }
  if (!cal) {
    alert("Please enter calories.");
    return;
  }
  const foods = getMyFoods();
  if (foods.find((f) => f.name.toLowerCase() === name.toLowerCase())) {
    if (!confirm('"' + name + '" already exists. Add a duplicate?')) return;
  }
  foods.push({ name, cal, serving, pro, carb, fat });
  saveMyFoods(foods);
  clearForm();
  switchTab("myfoods");
}

function logOnce() {
  const name = document.getElementById("cName").value.trim();
  const cal = parseFloat(document.getElementById("cCal").value) || 0;
  const pro = parseFloat(document.getElementById("cPro").value) || 0;
  const carb = parseFloat(document.getElementById("cCarb").value) || 0;
  const fat = parseFloat(document.getElementById("cFat").value) || 0;
  if (!name) {
    alert("Please enter a food name.");
    return;
  }
  if (!cal) {
    alert("Please enter calories.");
    return;
  }
  const key = dateKey(currentDate);
  const log = getLog(key);
  log.push({ name, servingLabel: null, cal, pro, carb, fat });
  saveLog(key, log);
  clearForm();
  renderAll();
}

function clearForm() {
  ["cName", "cCal", "cServing", "cPro", "cCarb", "cFat"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
}

function saveTargets() {
  targets.cal = parseInt(document.getElementById("tCal").value) || 2500;
  targets.pro = parseInt(document.getElementById("tPro").value) || 180;
  targets.carb = parseInt(document.getElementById("tCarb").value) || 250;
  targets.fat = parseInt(document.getElementById("tFat").value) || 70;
  setLS("ct3_targets", targets);
  const toast = document.getElementById("savedToast");
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 2000);
  renderSummary(getLog(dateKey(currentDate)));
}

function loadStorage() {
  const t = getLS("ct3_targets", null);
  if (t) {
    targets = t;
    document.getElementById("tCal").value = t.cal;
    document.getElementById("tPro").value = t.pro;
    document.getElementById("tCarb").value = t.carb;
    document.getElementById("tFat").value = t.fat;
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
  setLS("ct3_theme", theme);
}

function initTheme() {
  const saved = getLS("ct3_theme", "light");
  applyTheme(saved);
  const btn = document.getElementById("themeToggle");
  if (btn)
    btn.addEventListener("click", () => {
      const next = document.body.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
    });
}

document.getElementById("qtyModal").addEventListener("click", function (e) {
  if (e.target === this) closeQtyModal();
});

initTheme();
loadStorage();
loadCurrentDate();
// Seed sample data if there are no logs yet (safe: won't overwrite existing logs)
function seedSampleDataIfEmpty() {
  // check for any existing log keys
  const any = Object.keys(localStorage).some((k) => k.startsWith("ct3_log_"));
  if (any) {
    console.log("Sample data: logs exist, skipping seeding.");
    return;
  }
  seedSampleData();
}

function seedSampleData(days = 30) {
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = dateKey(d);
    const entries = [];
    // generate 1-5 random meals
    const meals = 1 + Math.floor(Math.random() * 5);
    for (let m = 0; m < meals; m++) {
      // macros roughly
      const pro = Math.round(Math.random() * 60 + 5);
      const carb = Math.round(Math.random() * 120 + 10);
      const fat = Math.round(Math.random() * 30 + 2);
      const cal = Math.round(
        pro * 4 + carb * 4 + fat * 9 + (Math.random() * 50 - 25),
      );
      entries.push({
        name: `Sample ${m + 1}`,
        servingLabel: null,
        cal,
        pro,
        carb,
        fat,
      });
    }
    saveLog(key, entries);
  }
  console.log(`Seeded sample data for last ${days} days.`);
}

// helper: manual test runner (call from console if needed)
function runSampleTest(force = false) {
  if (force) seedSampleData();
  renderAll();
  console.log("Sample test: renderAll executed.");
}

seedSampleDataIfEmpty();
// Remove seeded sample logs (entries created by `seedSampleData`) if present.
function removeSeededSampleData() {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith("ct3_log_"),
  );
  let removed = 0;
  keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return;
      const allSample = arr.every(
        (it) => typeof it.name === "string" && it.name.startsWith("Sample "),
      );
      if (allSample) {
        localStorage.removeItem(k);
        removed++;
      }
    } catch (e) {}
  });
  if (removed) console.log(`Removed ${removed} seeded sample log(s).`);
}

// Execute removal now per user request
removeSeededSampleData();
renderAll();
startAutoRollover();
