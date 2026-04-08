let currentDate = new Date();
let targets = { cal: 2500, pro: 180, carb: 250, fat: 70 };
let queuedFood = null;

function dateKey(d) {
  return d.toISOString().split("T")[0];
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
  renderMyFoods();
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
  if (btn) btn.addEventListener("click", () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
  });
}

document.getElementById("qtyModal").addEventListener("click", function (e) {
  if (e.target === this) closeQtyModal();
});

initTheme();
loadStorage();
renderAll();
