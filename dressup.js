/* =========================================================
   對稱換裝扭蛋｜學生端
   進度存在學生資料的 dress 欄位；老師設定的開放台數存在 dressOpen
   ========================================================= */
const DRAW_COST = 2;        // 一次扭蛋的金幣
const FREE_PER_DAY = 3;     // 每天免費次數
const PITY = 30;            // 第 30 次必出超稀有
const RATE = { S: 0.03, R: 0.22 };   // 其餘是普通
const LAYER_ORDER = ["背飾", "base", "下身", "上衣", "連身", "鞋子", "頸飾", "臉部", "hair", "頭飾", "手持", "全身"];

let STU = null, D = null;
let closetFilter = "全部", craftRarity = "N", craftSel = [];
const itemById = id => DRESS_ITEMS.find(x => x.id === id);
const machById = id => DRESS_MACHINES.find(x => x.id === id);
const todayKey = () => new Date().toLocaleDateString("sv-SE");

function normalizeDress(raw) {
  const d = Object.assign({
    av: null, inv: {}, worn: {}, pity: {}, mdraws: {}, freeDay: "", freeUsed: 0,
    draws: 0, answered: 0, correct: 0, wrong: {}, logs: [], pending: null, crafts: 0
  }, raw || {});
  ["inv", "worn", "pity", "mdraws", "wrong"].forEach(k => { if (!d[k] || typeof d[k] !== "object") d[k] = {}; });
  if (!Array.isArray(d.logs)) d.logs = [];
  if (d.freeDay !== todayKey()) { d.freeDay = todayKey(); d.freeUsed = 0; }
  return d;
}
function dressOpenCount(stu) {
  const n = Number(stu && stu.dressOpen);
  return Number.isFinite(n) ? Math.max(0, Math.min(DRESS_MACHINES.length, Math.floor(n))) : 0;
}
const freeLeft = () => Math.max(0, FREE_PER_DAY - (D.freeDay === todayKey() ? D.freeUsed : 0));

async function save(coinDelta = 0) {
  STU.dress = D;
  try {
    await saveGameData(STU, "dress", coinDelta);
    return true;
  } catch (e) {
    reportError("存檔", e);
    return false;
  } finally {
    renderTop();
  }
}

/* ---------------- 角色圖層 ---------------- */
function avatarLayers(av, worn) {
  if (!av) return [];
  const g = av.g;
  const layers = [];
  const full = worn["全身"] && itemById(worn["全身"]);
  const onepiece = worn["連身"] && itemById(worn["連身"]);
  const hideHair = !!full || !!(onepiece && onepiece.hideHair);
  LAYER_ORDER.forEach(L => {
    if (L === "base") { layers.push(`${DRESS_IMG}base/${hideHair ? g : av.hair}.webp`); return; }
    if (L === "hair") { if (!hideHair) layers.push(`${DRESS_IMG}hair/${av.hair}_${av.color}.webp`); return; }
    if (full && L !== "全身") return;
    const id = worn[L];
    if (!id || !itemById(id)) return;
    if (onepiece && (L === "上衣" || L === "下身")) return;
    layers.push(`${DRESS_IMG}items/${id}_${g}.webp`);
  });
  return layers;
}
function renderStage(el, av, worn) {
  el.innerHTML = avatarLayers(av, worn || {}).map(src => `<img src="${src}" alt="" draggable="false" />`).join("");
}

/* ---------------- 頁面 ---------------- */
window.onPageReady = async () => {
  STU = await loadSessionStudentOrRedirect();
  if (!STU) return;
  document.getElementById("viewLoading").classList.add("hidden");
  if (dressOpenCount(STU) < 1) { document.getElementById("viewLocked").classList.remove("hidden"); return; }
  D = normalizeDress(STU.dress);
  if (D.av && !ALL_HAIRS.some(h => h.id === D.av.hair)) D.av = null;   // 舊版髮型已移除，請重新選
  document.getElementById("viewGame").classList.remove("hidden");
  document.getElementById("dStuId").textContent = STU.id;
  document.getElementById("dStuName").textContent = STU.name || "";
  renderAll();
  if (!D.av) openMaker(true);
  else if (D.pending) resumePending();
};

function renderTop() {
  document.getElementById("dCoins").textContent = STU.coins || 0;
  document.getElementById("dFreeLeft").textContent = freeLeft();
  document.getElementById("dAnswered").textContent = D.answered || 0;
  document.getElementById("dAcc").textContent = D.answered ? Math.round(D.correct / D.answered * 100) + "%" : "—";
}
function renderAll() {
  renderTop();
  renderStage(document.getElementById("myStage"), D.av, D.worn);
  renderMachines();
  renderCloset();
  renderCraft();
}
function switchTab(name) {
  document.querySelectorAll(".k-tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === name));
  ["gacha", "closet", "craft", "help"].forEach(t => document.getElementById("tab_" + t).classList.toggle("hidden", t !== name));
}
function dLogout() { clearSessionStudent(); location.href = "index.html"; }

/* ---------------- 捏臉 ---------------- */
let maker = null;
function openMaker(first) {
  maker = Object.assign({ g: "f", hair: "pony", color: "orig" }, D.av || {});
  const h0 = ALL_HAIRS.find(x => x.id === maker.hair);
  if (!h0) { maker.hair = "pony"; maker.g = "f"; } else maker.g = h0.g;
  if (!DRESS_HAIR_COLORS.some(c => c.id === maker.color)) maker.color = "orig";
  document.getElementById("btnMakerCancel").classList.toggle("hidden", !!first);
  document.getElementById("modalMaker").classList.remove("hidden");
  renderMaker();
}
// 髮型決定用哪一個人物，畫面上不顯示性別
const ALL_HAIRS = (() => {
  const a = DRESS_HAIRS.m.map(h => ({ ...h, g: "m" })), b = DRESS_HAIRS.f.map(h => ({ ...h, g: "f" }));
  const out = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (b[i]) out.push(b[i]); if (a[i]) out.push(a[i]); }
  return out;
})();
function makerSet(k, v) {
  maker[k] = v;
  if (k === "hair") { const h = ALL_HAIRS.find(x => x.id === v); if (h) maker.g = h.g; }
  renderMaker();
}
function renderMaker() {
  document.getElementById("makerHair").innerHTML = ALL_HAIRS.map(h => `
    <button onclick="makerSet('hair','${h.id}')" class="dz-item ${h.id === maker.hair ? "is-pick" : ""}" title="${h.name}" style="padding:0;overflow:hidden">
      <img src="${DRESS_IMG}icons/hair_${h.id}.webp" alt="${h.name}" style="border-radius:12px" />
    </button>`).join("");
  document.getElementById("makerColor").innerHTML = DRESS_HAIR_COLORS.map(c => `
    <button onclick="makerSet('color','${c.id}')" title="${c.name}" aria-label="${c.name}"
      style="width:2.3rem;height:2.3rem;border-radius:50%;border:3px solid var(--ink);background:${c.hex};${c.id === maker.color ? "box-shadow:0 0 0 3px #fff,0 0 0 6px var(--ink)" : ""}"></button>`).join("");
  renderStage(document.getElementById("makerStage"), maker, D.worn);
}
async function saveMaker() {
  D.av = { g: maker.g, hair: maker.hair, color: maker.color };
  closeModal("modalMaker");
  renderAll();
  await save();
  if (D.pending) resumePending();
}

/* ---------------- 扭蛋機 ---------------- */
function machineSvg(m, cls = "machine", knobId = "") {
  const caps = [["#F2644E", 32, 52], ["#FFC83D", 52, 40], ["#5BB8F0", 70, 54], ["#4CB782", 44, 66], ["#F7A8C4", 62, 70], ["#fff", 82, 64], [m.main, 38, 44], ["#8A63D2", 76, 44]];
  return `<svg class="${cls}" viewBox="0 0 120 150" aria-hidden="true">
    <rect x="22" y="78" width="76" height="62" rx="10" fill="${m.main}" stroke="#1E2A33" stroke-width="3.5"/>
    <rect x="16" y="134" width="88" height="12" rx="5" fill="${m.light}" stroke="#1E2A33" stroke-width="3.5"/>
    <circle cx="60" cy="54" r="40" fill="#EAF6FF" stroke="#1E2A33" stroke-width="3.5"/>
    ${caps.map(([c, x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}" stroke="#1E2A33" stroke-width="2.5"/>`).join("")}
    <path d="M34 30 Q44 20 58 18" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>
    <rect x="30" y="86" width="60" height="16" rx="5" fill="${m.light}" stroke="#1E2A33" stroke-width="3"/>
    <text x="60" y="98.5" text-anchor="middle" font-size="10" font-weight="900" fill="#1E2A33" font-family="Huninn, sans-serif">${m.name}</text>
    <g ${knobId ? `id="${knobId}"` : ""}><circle cx="44" cy="119" r="10" fill="#fff" stroke="#1E2A33" stroke-width="3"/><rect x="41" y="110" width="6" height="18" rx="3" fill="#1E2A33"/></g>
    <rect x="66" y="110" width="22" height="18" rx="4" fill="#1E2A33"/>
    <rect x="70" y="114" width="14" height="10" rx="3" fill="#33434F"/>
    <text x="60" y="13" text-anchor="middle" font-size="16">${m.emblem}</text>
  </svg>`;
}
function ownedCount(mid) { return DRESS_ITEMS.filter(i => i.m === mid && (D.inv[i.id] || 0) > 0).length; }
function renderMachines() {
  const open = dressOpenCount(STU);
  const fl = freeLeft();
  document.getElementById("machineGrid").innerHTML = DRESS_MACHINES.map((m, idx) => {
    const locked = idx >= open;
    const items = DRESS_ITEMS.filter(i => i.m === m.id);
    const show = [...items.filter(i => i.r === "S"), ...items.filter(i => i.r === "R").slice(0, 2)];
    const p = D.pity[m.id] || 0;
    const left = PITY - p;
    return `
    <div class="dz-mach ${locked ? "is-locked" : ""}">
      <div class="dz-mach-top" style="background:${m.light}">${machineSvg(m)}</div>
      <div class="p-3">
        <div class="flex items-center justify-between">
          <h3 class="k-display text-xl">${m.name}</h3>
          <span class="text-xs font-black text-[#5B6B78]">收集 ${ownedCount(m.id)} / ${items.length}</span>
        </div>
        <div class="flex gap-2 mt-2">
          ${show.map(i => `<div class="dz-prize is-${i.r} ${(D.inv[i.id] || 0) ? "" : "not-owned"}" title="${i.name}（${DRESS_RARITY[i.r].name}）">
            <img src="${DRESS_IMG}icons/${i.id}.webp" alt="${i.name}" loading="lazy"/></div>`).join("")}
        </div>
        <div class="mt-3 text-xs font-bold text-[#5B6B78] flex justify-between"><span>再 ${left} 次必出超稀有</span><span>${p}/${PITY}</span></div>
        <div class="dz-pity mt-1"><div style="width:${p / PITY * 100}%"></div></div>
        <button ${locked ? "disabled" : ""} onclick="startDraw('${m.id}')" class="k-btn ${fl ? "k-btn--leaf" : "k-btn--yellow"} w-full mt-3 py-2">
          ${locked ? "老師還沒開放" : (fl ? `免費扭蛋（今天剩 ${fl} 次）` : `<span class="k-coin"></span> ${DRAW_COST} 金幣扭一次`)}
        </button>
      </div>
    </div>`;
  }).join("");
}

let busy = false;
async function startDraw(mid) {
  if (busy) return;
  if (D.pending) { resumePending(); return; }
  const idx = DRESS_MACHINES.findIndex(m => m.id === mid);
  if (idx >= dressOpenCount(STU)) return;
  busy = true;
  try {
    const free = freeLeft() > 0;
    if (!free) {
      // 重新讀一次金幣，避免在別的遊戲花掉了還以為夠
      const fresh = await fetchStudent(STU.id);
      if (fresh) STU.coins = fresh.coins || 0;
      if ((STU.coins || 0) < DRAW_COST) {
        renderTop();
        alert(`金幣不夠喔！扭一次要 ${DRAW_COST} 金幣，去其他遊戲答題賺金幣吧。`);
        return;
      }
      if (!confirm(`要用 ${DRAW_COST} 金幣扭「${machById(mid).name}」嗎？\n要先答 3 題，答對 2 題以上才能轉扭蛋。`)) return;
    }
    if (free) { D.freeDay = todayKey(); D.freeUsed = (D.freeUsed || 0) + 1; }
    D.pending = { m: mid, free, done: 0, ok: 0 };
    const ok = await save(free ? 0 : -DRAW_COST);
    if (!ok) return;
    renderMachines();
    runQuiz();
  } finally { busy = false; }
}
function resumePending() {
  if (!D.pending || !machById(D.pending.m)) { D.pending = null; return; }
  runQuiz();
}

/* ---------------- 答題 ---------------- */
let QS_CUR = [], qAnswered = false;
function runQuiz() {
  const p = D.pending;
  QS_CUR = makeQuestionSet(3 - p.done);
  document.getElementById("modalQuiz").classList.remove("hidden");
  showQuestion();
}
function quizHeader() {
  const p = D.pending;
  document.getElementById("quizTitle").textContent = `${machById(p.m).name}・第 ${Math.min(p.done + 1, 3)} / 3 題`;
  const marks = (p.marks || []);
  document.getElementById("quizDots").innerHTML = [0, 1, 2].map(i =>
    `<span class="k-stamp ${marks[i] === 1 ? "is-on" : ""}" style="${marks[i] === 0 ? "background:#FFE3DE;border:2.5px solid var(--ink)" : ""}"></span>`).join("");
}
function showQuestion() {
  const p = D.pending;
  quizHeader();
  qAnswered = false;
  const q = QS_CUR[0];
  const body = document.getElementById("quizBody");
  let html = `<div class="k-question p-4 sm:p-5"><p class="text-lg sm:text-xl font-bold leading-relaxed">${q.prompt}</p></div>`;
  if (q.figure) html += `<div class="flex justify-center mt-3"><div class="dz-fig border-[3px] border-[#1E2A33]">${q.figure}</div></div>`;
  if (q.type === "choice") {
    html += `<div class="grid ${q.grid4 ? "grid-cols-2" : (q.options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")} gap-3 mt-4">` +
      q.options.map((o, i) => `
        <button class="k-opt ${o.html ? "dz-opt-fig" : ""}" data-i="${i}" onclick="answerChoice(${i})">
          <span class="k-opt-key">${"ABCD"[i]}</span>${o.html ? o.html : `<span class="text-lg font-bold">${o.text}</span>`}
        </button>`).join("") + `</div>`;
  } else {
    html += gridHtml(q.grid) + `<div class="flex justify-center mt-4"><button id="btnGridOk" onclick="answerGrid()" class="k-btn k-btn--yellow px-8 py-2.5">我塗好了</button></div>`;
  }
  html += `<div id="quizFeedback"></div>`;
  body.innerHTML = html;
  if (q.type === "grid") { GRID_ON = new Set(); }
}

let GRID_ON = new Set();
function gridHtml(g) {
  const given = new Set(g.given);
  const size = g.vertical ? "max-w-[360px]" : "max-w-[270px]";
  let cells = "";
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const k = r + "," + c;
    const other = g.vertical ? c >= g.half : r >= g.half;
    cells += `<div class="dz-cell ${given.has(k) ? "is-given" : ""} ${other ? "can" : ""}" data-k="${k}" ${other ? `onclick="toggleCell(this)"` : ""}></div>`;
  }
  const axis = g.vertical
    ? `<div class="dz-axis" style="left:calc(50% - 2px);top:-8px;bottom:-8px;width:4px"></div>`
    : `<div class="dz-axis" style="top:calc(50% - 2px);left:-8px;right:-8px;height:4px"></div>`;
  return `<div class="mt-4 mx-auto ${size} w-full"><div class="dz-grid" style="grid-template-columns:repeat(${g.cols},1fr)">${cells}${axis}</div></div>`;
}
function toggleCell(el) {
  if (qAnswered) return;
  const k = el.dataset.k;
  if (GRID_ON.has(k)) GRID_ON.delete(k); else GRID_ON.add(k);
  el.classList.toggle("is-on", GRID_ON.has(k));
}
function answerGrid() {
  if (qAnswered) return;
  const g = QS_CUR[0].grid;
  if (GRID_ON.size === 0) { alert("先點方格把另一半塗起來喔！"); return; }
  const ans = new Set(g.answer);
  const ok = ans.size === GRID_ON.size && [...ans].every(k => GRID_ON.has(k));
  document.querySelectorAll(".dz-cell").forEach(el => {
    const k = el.dataset.k;
    if (ans.has(k) && !GRID_ON.has(k)) el.classList.add("is-miss");
    if (!ans.has(k) && GRID_ON.has(k)) { el.classList.remove("is-on"); el.classList.add("is-extra"); }
  });
  document.getElementById("btnGridOk").remove();
  finishAnswer(ok, ok ? "" : "斜線格是少塗的，紅色格是多塗的。");
}
function answerChoice(i) {
  if (qAnswered) return;
  const q = QS_CUR[0];
  const ok = i === q.answer;
  document.querySelectorAll("#quizBody .k-opt").forEach(b => {
    const j = Number(b.dataset.i);
    b.disabled = true;
    if (j === q.answer) b.classList.add("is-right");
    else if (j === i) b.classList.add("is-wrong");
  });
  finishAnswer(ok, "");
}
async function finishAnswer(ok, extra) {
  qAnswered = true;
  const q = QS_CUR[0];
  const p = D.pending;
  p.done += 1; if (ok) p.ok += 1;
  p.marks = (p.marks || []).concat(ok ? 1 : 0);
  D.answered = (D.answered || 0) + 1;
  if (ok) D.correct = (D.correct || 0) + 1;
  else { const t = q.key.split(":")[0].replace("findNot", "find"); D.wrong[t] = (D.wrong[t] || 0) + 1; }
  quizHeader();
  const last = p.done >= 3;
  document.getElementById("quizFeedback").innerHTML = `
    <div class="k-feedback ${ok ? "is-right" : "is-wrong"} p-4 mt-4">
      <p class="k-display text-lg">${ok ? "答對了！" : "答錯了"}</p>
      <p class="text-sm font-bold mt-1 leading-relaxed">${extra ? extra + "<br/>" : ""}${q.explain}</p>
      <div class="flex justify-end mt-3"><button onclick="nextQuestion()" class="k-btn k-btn--yellow px-6 py-2">${last ? "看結果" : "下一題"}</button></div>
    </div>`;
  document.getElementById("quizFeedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
  await save();
}
function nextQuestion() {
  const p = D.pending;
  if (p.done < 3) { QS_CUR.shift(); if (!QS_CUR.length) QS_CUR = makeQuestionSet(3 - p.done); showQuestion(); return; }
  const passed = p.ok >= 2;
  document.getElementById("quizBody").innerHTML = `
    <div class="text-center py-4">
      <p class="k-display text-3xl">${passed ? "可以扭蛋了！" : "差一點點！"}</p>
      <p class="font-bold text-[#5B6B78] mt-2">3 題答對 ${p.ok} 題${passed ? "" : "，要答對 2 題才能扭蛋。下次加油！"}</p>
      <button onclick="${passed ? "doDraw()" : "quizFail()"}" class="k-btn ${passed ? "k-btn--yellow" : "k-btn--chalk"} px-8 py-3 mt-5 text-lg">${passed ? "轉扭蛋！" : "好"}</button>
    </div>`;
}
async function quizFail() {
  D.logs.unshift({ t: Date.now(), m: D.pending.m, ok: D.pending.ok, got: null });
  D.logs = D.logs.slice(0, 30);
  D.pending = null;
  closeModal("modalQuiz");
  await save();
  renderMachines();
}

/* ---------------- 抽獎 ---------------- */
function rollRarity(mid) {
  const p = D.pity[mid] || 0;
  if (p + 1 >= PITY) return "S";
  const x = Math.random();
  return x < RATE.S ? "S" : (x < RATE.S + RATE.R ? "R" : "N");
}
async function doDraw() {
  if (busy || !D.pending) return;
  busy = true;
  const mid = D.pending.m;
  const r = rollRarity(mid);
  const pool = DRESS_ITEMS.filter(i => i.m === mid && i.r === r);
  const item = pick(pool);
  const isNew = !(D.inv[item.id] > 0);
  D.inv[item.id] = (D.inv[item.id] || 0) + 1;
  D.pity[mid] = r === "S" ? 0 : (D.pity[mid] || 0) + 1;
  D.mdraws[mid] = (D.mdraws[mid] || 0) + 1;
  D.draws = (D.draws || 0) + 1;
  D.logs.unshift({ t: Date.now(), m: mid, ok: D.pending.ok, got: item.id });
  D.logs = D.logs.slice(0, 30);
  D.pending = null;
  const saved = await save();
  busy = false;
  closeModal("modalQuiz");
  if (!saved) return;
  renderMachines(); renderCloset(); renderCraft();
  playDraw(machById(mid), item, isNew);
}
const CAP_COLOR = { N: "#8FD3FF", R: "#4A90E2", S: "linear-gradient(135deg,#FFE27A,#F2A93B)" };
function playDraw(m, item, isNew) {
  const el = document.getElementById("drawBody");
  el.innerHTML = `<div class="flex justify-center"><div id="drawMach" style="width:180px">${machineSvg(m, "machine w-full", "drawKnob")}</div></div>
    <p class="k-display text-lg mt-2">轉轉轉…</p>`;
  document.getElementById("modalDraw").classList.remove("hidden");
  requestAnimationFrame(() => {
    document.getElementById("drawKnob").classList.add("dz-knob-spin");
    document.getElementById("drawMach").classList.add("dz-shake");
  });
  setTimeout(() => {
    el.innerHTML = `
      <p class="k-display text-xl mb-4">掉出一顆扭蛋！</p>
      <div class="flex justify-center"><div id="cap" class="dz-capsule ${item.r === "S" ? "is-S" : ""}" onclick="openCapsule()">
        <div class="bot"></div><div class="top" style="background:${CAP_COLOR[item.r]}"></div></div></div>
      <p class="font-bold text-[#5B6B78] mt-4">點扭蛋打開它</p>`;
    window.__drawItem = { item, isNew };
  }, 1000);
}
function openCapsule() {
  const cap = document.getElementById("cap");
  if (!cap || cap.classList.contains("is-open")) return;
  cap.classList.add("is-open");
  setTimeout(() => showReveal(window.__drawItem.item, window.__drawItem.isNew, "抽到了！"), 380);
}
function showReveal(item, isNew, title) {
  const R = DRESS_RARITY[item.r];
  document.getElementById("drawBody").innerHTML = `
    <p class="k-display text-xl">${title}</p>
    <div class="relative mx-auto mt-3" style="width:220px;height:220px">
      ${item.r !== "N" ? `<div class="dz-rays spin absolute inset-0"></div>` : ""}
      <div class="dz-pop absolute inset-[18px] dz-item is-${item.r}" style="padding:10px"><img src="${DRESS_IMG}icons/${item.id}.webp" alt="${item.name}"/>
        ${isNew ? `<span class="dz-worn-tag" style="background:var(--tomato)">NEW</span>` : ""}</div>
    </div>
    <p class="k-display text-2xl mt-3">${item.name}</p>
    <p class="mt-1"><span class="dz-rar" style="position:static;background:${R.color};font-size:.85rem;padding:.1rem .6rem">${R.name}</span>
      <span class="text-sm font-bold text-[#5B6B78] ml-1">${machById(item.m).name}・${item.slot}</span></p>
    ${isNew ? "" : `<p class="text-sm font-bold text-[#5B6B78] mt-2">已經有了，這是第 ${D.inv[item.id]} 件，可以拿去合成。</p>`}
    <div class="flex justify-center gap-2 mt-5">
      <button onclick="wearFromReveal('${item.id}')" class="k-btn k-btn--sky px-5 py-2">穿上看看</button>
      <button onclick="closeModal('modalDraw')" class="k-btn k-btn--yellow px-6 py-2">收下</button>
    </div>`;
}
async function wearFromReveal(id) {
  closeModal("modalDraw");
  if (D.worn[itemById(id).slot] !== id) await toggleWear(id);
  switchTab("closet");
}

/* ---------------- 衣櫃 ---------------- */
async function toggleWear(id) {
  const it = itemById(id);
  if (!it || !(D.inv[id] > 0)) return;
  const w = D.worn;
  if (w[it.slot] === id) delete w[it.slot];
  else {
    if (it.slot === "全身") { Object.keys(w).forEach(k => { if (k !== "背飾") delete w[k]; }); }
    else {
      delete w["全身"];
      if (it.slot === "連身") { delete w["上衣"]; delete w["下身"]; }
      if (it.slot === "上衣" || it.slot === "下身") delete w["連身"];
    }
    w[it.slot] = id;
  }
  renderStage(document.getElementById("myStage"), D.av, D.worn);
  renderCloset(); renderCraft();
  await save();
}
async function undressAll() {
  D.worn = {};
  renderStage(document.getElementById("myStage"), D.av, D.worn);
  renderCloset(); renderCraft();
  await save();
}
function itemCard(it, opts = {}) {
  const n = D.inv[it.id] || 0;
  const worn = D.worn[it.slot] === it.id;
  const R = DRESS_RARITY[it.r];
  return `<button class="dz-item is-${it.r} ${worn && opts.showWorn !== false ? "is-worn" : ""} ${opts.cls || ""}" onclick="${opts.onclick}" title="${it.name}">
    <img src="${DRESS_IMG}icons/${it.id}.webp" alt="${it.name}" loading="lazy"/>
    ${opts.count != null ? (opts.count > 1 || opts.alwaysCount ? `<span class="dz-count">×${opts.count}</span>` : "") : (n > 1 ? `<span class="dz-count">×${n}</span>` : "")}
    <span class="dz-rar" style="background:${R.color}">${R.name}</span>
    ${worn && opts.showWorn !== false ? `<span class="dz-worn-tag">穿著</span>` : ""}
  </button>`;
}
function renderCloset() {
  const owned = DRESS_ITEMS.filter(i => (D.inv[i.id] || 0) > 0);
  const slots = ["全部", ...DRESS_SLOTS.filter(s => owned.some(i => i.slot === s))];
  if (!slots.includes(closetFilter)) closetFilter = "全部";
  document.getElementById("slotChips").innerHTML = slots.map(s =>
    `<button class="dz-chip ${s === closetFilter ? "is-on" : ""}" onclick="closetFilter='${s}';renderCloset()">${s}</button>`).join("");
  const list = owned.filter(i => closetFilter === "全部" || i.slot === closetFilter);
  document.getElementById("closetGrid").innerHTML = list.length
    ? list.map(it => `<div><div>${itemCard(it, { onclick: `toggleWear('${it.id}')` })}</div><p class="text-xs font-bold text-center mt-1.5 leading-tight">${it.name}</p></div>`).join("")
    : `<p class="col-span-full text-center font-bold text-[#5B6B78] py-8">衣櫃還是空的，先去扭蛋吧！</p>`;
}

/* ---------------- 合成 ---------------- */
const NEXT_R = { N: "R", R: "S", S: "S" };
function spare(id) {
  const it = itemById(id);
  return (D.inv[id] || 0) - (D.worn[it.slot] === id ? 1 : 0) - craftSel.filter(x => x === id).length;
}
function renderCraft() {
  document.getElementById("craftRarity").innerHTML = ["N", "R", "S"].map(r =>
    `<button class="dz-chip ${r === craftRarity ? "is-on" : ""}" onclick="setCraftRarity('${r}')">${DRESS_RARITY[r].name}</button>`).join("");
  document.getElementById("craftSlots").innerHTML = [0, 1, 2, 3, 4].map(i => {
    const id = craftSel[i];
    if (!id) return `<div class="dz-item is-empty" style="border-style:dashed;box-shadow:none"></div>`;
    const it = itemById(id);
    return itemCard(it, { onclick: `craftRemove(${i})`, count: 1, showWorn: false });
  }).join("");
  const list = DRESS_ITEMS.filter(i => i.r === craftRarity && spare(i.id) > 0);
  document.getElementById("craftGrid").innerHTML = list.length
    ? list.map(it => itemCard(it, { onclick: `craftAdd('${it.id}')`, count: spare(it.id), alwaysCount: true, showWorn: false })).join("")
    : `<p class="col-span-full text-sm font-bold text-[#5B6B78] py-4">沒有多出來的${DRESS_RARITY[craftRarity].name}物品（正在穿的那一件不算）。</p>`;
  const btn = document.getElementById("btnCraft");
  btn.disabled = craftSel.length !== 5;
  document.getElementById("craftMsg").textContent = `已放 ${craftSel.length} / 5 件`;
}
function setCraftRarity(r) { craftRarity = r; craftSel = []; renderCraft(); }
function craftAdd(id) { if (craftSel.length < 5 && spare(id) > 0) { craftSel.push(id); renderCraft(); } }
function craftRemove(i) { craftSel.splice(i, 1); renderCraft(); }
function craftClear() { craftSel = []; renderCraft(); }
function craftRoll(r) {
  const x = Math.random();
  const same = DRESS_ITEMS.filter(i => i.r === r);
  const unowned = same.filter(i => !(D.inv[i.id] > 0));
  if (r === "S") {   // 超稀有沒有更高一級：一半機率拿到還沒有的
    return (x < 0.5 && unowned.length) ? pick(unowned) : pick(same);
  }
  if (x < 0.10) return pick(DRESS_ITEMS.filter(i => i.r === NEXT_R[r]));
  if (x < 0.55 || !unowned.length) return pick(same);
  return pick(unowned);
}
async function doCraft() {
  if (craftSel.length !== 5 || busy) return;
  const names = craftSel.map(id => itemById(id).name).join("、");
  if (!confirm(`確定要合成嗎？\n\n這 5 件會消失：\n${names}`)) return;
  busy = true;
  const r = craftRarity;
  craftSel.forEach(id => { D.inv[id] -= 1; if (D.inv[id] <= 0) delete D.inv[id]; });
  const got = craftRoll(r);
  const isNew = !(D.inv[got.id] > 0);
  D.inv[got.id] = (D.inv[got.id] || 0) + 1;
  D.crafts = (D.crafts || 0) + 1;
  D.logs.unshift({ t: Date.now(), craft: r, got: got.id });
  D.logs = D.logs.slice(0, 30);
  craftSel = [];
  const ok = await save();
  busy = false;
  renderCraft(); renderCloset(); renderMachines();
  if (!ok) return;
  document.getElementById("modalDraw").classList.remove("hidden");
  showReveal(got, isNew, got.r !== r ? "合成成功，升級了！" : "合成成功！");
}
