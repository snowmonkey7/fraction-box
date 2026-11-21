/* =========================================================
   對稱美食街｜學生端（第一階段：扭蛋、食材庫、美食圖鑑、做料理）
   進度存在學生資料的 food 欄位；老師的開放設定存在 foodOpen（0 / 1）
   ========================================================= */
const DRAW_COST = 2;          // 免費次數用完後，一次 2 金幣
const FREE_PER_DAY = 3;
const PITY = 30;              // 第 30 次必出稀有
const RATE = { R: 0.05, U: 0.25 };  // 其餘是常見 70%
const REGIONS = ["全部", "台灣", "日本", "韓國", "印度", "義大利", "世界"];

let STU = null, F = null;
let bookRegion = "全部";
const ingById = id => FOOD_INGS.find(x => x.id === id);
const dishById = id => FOOD_DISHES.find(x => x.id === id);
const todayKey = () => new Date().toLocaleDateString("sv-SE");
const recKeys = d => Object.keys(d.rec);

function normalizeFood(raw) {
  const f = Object.assign({
    inv: {}, seen: {}, found: {}, made: {}, stock: {}, pity: 0, freeDay: "", freeUsed: 0,
    draws: 0, answered: 0, correct: 0, wrong: {}, recent: [], zhSeen: [], logs: [], pending: null, helped: false,
    perf: {}, plates: 0, perfects: 0,
    home: 0, homeDay: "", homeToday: 0, homeTotal: 0, pop: 0, decor: {}, coinDraws: 0, coinWon: 0,
    shop: null
  }, raw || {});
  F_SHOP_DEFAULT(f);
  ["inv", "seen", "found", "made", "stock", "wrong", "perf", "decor"].forEach(k => { if (!f[k] || typeof f[k] !== "object") f[k] = {}; });
  ["recent", "zhSeen", "logs"].forEach(k => { if (!Array.isArray(f[k])) f[k] = []; });
  if (f.freeDay !== todayKey()) { f.freeDay = todayKey(); f.freeUsed = 0; }
  if (f.homeDay !== todayKey()) { f.homeDay = todayKey(); f.homeToday = 0; }
  return f;
}
function F_SHOP_DEFAULT(f) {
  const s = Object.assign({ last: 0, menu: [], layout: {}, cols: SHOP_LEVELS[0].cols, log: [], sold: 0 }, f.shop || {});
  if (!Array.isArray(s.menu)) s.menu = [];
  if (!s.layout || typeof s.layout !== "object") s.layout = {};
  if (!Array.isArray(s.log)) s.log = [];
  f.shop = s;
}
const freeLeft = () => Math.max(0, FREE_PER_DAY - (F.freeDay === todayKey() ? F.freeUsed : 0));
const foundCount = () => FOOD_DISHES.filter(d => F.found[d.id]).length;

async function save(coinDelta = 0) {
  STU.food = F;
  try { await saveGameData(STU, "food", coinDelta); return true; }
  catch (e) { reportError("存檔", e); return false; }
  finally { renderTop(); }
}

/* ---------------- 頁面 ---------------- */
window.onPageReady = async () => {
  STU = await loadSessionStudentOrRedirect();
  if (!STU) return;
  document.getElementById("viewLoading").classList.add("hidden");
  if (!((Number(STU.foodOpen) || 0) > 0)) { document.getElementById("viewLocked").classList.remove("hidden"); return; }
  F = normalizeFood(STU.food);
  document.getElementById("viewGame").classList.remove("hidden");
  document.getElementById("fStuId").textContent = STU.id;
  document.getElementById("fStuName").textContent = STU.name || "";
  document.getElementById("fDishTotal").textContent = FOOD_DISHES.length;
  ensureCols();
  const sold = tickShop();
  renderAll();
  if (sold) { await save(); showOffline(sold); }
  setInterval(shopLoop, 5000);
  setInterval(renderCountdown, 1000);
  if (F.pending) resumePending();
  else if (!F.helped) { F.helped = true; save(); openHelp(0); }
};
function renderTop() {
  document.getElementById("fCoins").textContent = STU.coins || 0;
  document.getElementById("fHome").textContent = F.home || 0;
  document.getElementById("fFound").textContent = foundCount();
  document.getElementById("fAnswered").textContent = F.answered || 0;
  document.getElementById("fAcc").textContent = F.answered ? Math.round(F.correct / F.answered * 100) + "%" : "—";
}
function renderAll() { renderTop(); renderGacha(); renderPantry(); renderBook(); renderShop(); }
function switchTab(name) {
  document.querySelectorAll(".k-tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === name));
  ["gacha", "pantry", "book", "shop"].forEach(t => document.getElementById("tab_" + t).classList.toggle("hidden", t !== name));
}
function fLogout() { clearSessionStudent(); location.href = "index.html"; }

/* ---------------- 怎麼玩 ---------------- */
const HELP_PAGES = [
  { t: "🍱 歡迎來到對稱美食街！", b: `<p>你是一間小店的老闆，要收集食材、做出台灣和世界各地的家鄉味，把小店經營成大餐廳。</p>
      <p class="mt-2">這條街上的每一道料理、每一件裝潢，都是<b>線對稱圖形</b>喔！</p>` },
  { t: "🎰 答題抽食材", b: `<p>每次先答 <b>3 題</b>（國語第八課和數學線對稱都會出），<b>答對 2 題以上</b>就能轉美食扭蛋機。</p>
      <p class="mt-2">每天前 <b>3 次免費</b>，之後一次 <b>2 金幣</b>。常見食材一次拿 10 份、少見 5 份、稀有 2 份；轉 30 次還沒出稀有，第 30 次一定出！</p>` },
  { t: "📖 在圖鑑試做料理", b: `<p>挑 2～4 種食材放進鍋子，<b>種類</b>組合對了就會解鎖新料理。</p>
      <p class="mt-2">組合不對<b>不扣食材</b>，還會給你提示。解鎖後才看得到每份要用多少食材。</p>` },
  { t: "🍽️ 做菜和對稱擺盤", b: `<p>選要做幾份，系統會算出要用多少食材。</p>
      <p class="mt-2">最後把配料擺盤：盤子的一半已經擺好，你要把另一半擺成和它<b>對稱</b>。擺對了就是「<b>完美料理</b>」，賣的價錢是 <b>1.5 倍</b>！擺錯也做得出來，只是「普通」。</p>` },
  { t: "🏪 開店賺家鄉幣", b: `<p>把料理放上<b>菜單</b>，客人每 30 秒來買一份，沒上線也會賣（最多累積 8 小時）。每天最多賺 500 家鄉幣。</p>
      <p class="mt-2">家鄉幣可以轉<b>金幣扭蛋機</b>（100 家鄉幣一次），也可以買裝潢。裝潢擺得左右對稱，每賣一份人氣再多 1。<b>人氣</b>越高，店就越大！</p>` }
];
let helpPage = 0;
function openHelp(i) { helpPage = i; document.getElementById("modalHelp").classList.remove("hidden"); renderHelp(); }
function helpGo(d) {
  if (d > 0 && helpPage >= HELP_PAGES.length - 1) { closeModal("modalHelp"); return; }
  helpPage = Math.max(0, helpPage + d); renderHelp();
}
function renderHelp() {
  const p = HELP_PAGES[helpPage];
  document.getElementById("helpBody").innerHTML = `<h2 class="k-display text-2xl mb-3">${p.t}</h2><div class="text-[15px] leading-relaxed font-medium">${p.b}</div>`;
  document.getElementById("helpDots").innerHTML = HELP_PAGES.map((_, i) => `<span class="fd-help-dot ${i === helpPage ? "is-on" : ""}"></span>`).join("");
  document.getElementById("helpPrev").classList.toggle("invisible", helpPage === 0);
  document.getElementById("helpNext").textContent = helpPage === HELP_PAGES.length - 1 ? "開始玩！" : "下一頁";
}

/* ---------------- 扭蛋機 ---------------- */
function ingTile(ing, count, opts = {}) {
  const none = !F.seen[ing.id];
  return `<${opts.onclick ? "button" : "div"} class="fd-tile is-${ing.r} ${none ? "is-none" : ""} ${opts.cls || ""}" ${opts.onclick ? `onclick="${opts.onclick}"` : ""} ${opts.disabled ? "disabled" : ""} title="${ing.name}">
    <img src="${FOOD_IMG}ing/${ing.id}.webp" alt="${ing.name}" loading="lazy" draggable="false"/>
    <div class="nm">${none ? "？？？" : ing.name}</div>
    ${count != null ? `<span class="fd-count ${count ? "" : "is-zero"}">${count}</span>` : ""}
  </${opts.onclick ? "button" : "div"}>`;
}
function renderGacha() {
  const p = F.pity || 0;
  document.getElementById("pityText").textContent = `再 ${PITY - p} 次一定出稀有食材`;
  document.getElementById("pityNum").textContent = `${p} / ${PITY}`;
  document.getElementById("pityBar").style.width = (p / PITY * 100) + "%";
  const fl = freeLeft();
  const btn = document.getElementById("btnDraw");
  btn.className = `k-btn ${F.pending ? "k-btn--sky" : (fl ? "k-btn--leaf" : "k-btn--yellow")} w-full mt-4 py-3 text-lg`;
  btn.innerHTML = F.pending ? "繼續答題" : (fl ? `免費扭蛋（今天剩 ${fl} 次）` : `<span class="k-coin"></span> ${DRAW_COST} 金幣轉一次`);
  const rec = F.recent.slice(0, 12);
  document.getElementById("recentGrid").innerHTML = rec.length
    ? rec.map(r => { const ing = ingById(r.i); return ing ? ingTile(ing, r.n) : ""; }).join("")
    : `<p class="col-span-full text-sm font-bold text-[#5B6B78]">還沒有轉過，先轉一次看看吧！</p>`;
  document.querySelectorAll("#recentGrid .fd-count").forEach(el => el.textContent = "+" + el.textContent);
  const cb = document.getElementById("btnCoin");
  const can = (F.home || 0) >= COIN_COST;
  cb.className = `k-btn ${can ? "k-btn--yellow" : ""} w-full mt-3 py-2.5`;
  cb.style.background = can ? "" : "#fff";
  cb.innerHTML = can ? `用 ${COIN_COST} 家鄉幣轉一次` : `要 ${COIN_COST} 家鄉幣才能轉（現在 ${F.home || 0}）`;
}

let busy = false;
async function startDraw() {
  if (busy) return;
  if (F.pending) { resumePending(); return; }
  busy = true;
  try {
    const free = freeLeft() > 0;
    if (!free) {
      const fresh = await fetchStudent(STU.id);   // 金幣可能在別的遊戲用掉了
      if (fresh) STU.coins = fresh.coins || 0;
      if ((STU.coins || 0) < DRAW_COST) { renderTop(); alert(`金幣不夠喔！轉一次要 ${DRAW_COST} 金幣，去其他遊戲答題賺金幣吧。`); return; }
    }
    if (free) { F.freeDay = todayKey(); F.freeUsed = (F.freeUsed || 0) + 1; }
    const third = Math.random() < 0.5 ? "zh" : "math";
    F.pending = { free, done: 0, ok: 0, marks: [], plan: shuffle(["zh", "math", third]) };
    if (!(await save(free ? 0 : -DRAW_COST))) return;
    renderGacha();
    runQuiz();
  } finally { busy = false; }
}
function resumePending() {
  const p = F.pending;
  if (!p || !Array.isArray(p.plan) || p.plan.length !== 3) { F.pending = null; renderGacha(); return; }
  runQuiz();
}

/* ---------------- 答題 ---------------- */
let CUR = null, qAnswered = false, GRID_ON = new Set();
function makeZhQuestion() {
  const seen = new Set(F.zhSeen);
  let pool = ZH_BANK.filter(q => !seen.has(q.id));
  if (pool.length < 10) { F.zhSeen = []; pool = ZH_BANK.slice(); }
  const src = pick(pool);
  F.zhSeen.push(src.id); F.zhSeen = F.zhSeen.slice(-80);
  const order = shuffle([0, 1, 2, 3]);
  return {
    subj: "zh", key: "z_" + src.t, type: "choice",
    prompt: src.q, passage: src.p ? ZH_PASSAGES[src.p] : null,
    options: order.map(i => ({ text: src.o[i] })), answer: order.indexOf(src.a),
    explain: `正確答案是「${src.o[src.a]}」。`
  };
}
function makeMathQuestion() {
  const q = makeQuestionSet(1)[0];
  return Object.assign({}, q, { subj: "math", key: "m_" + q.key.split(":")[0].replace("findNot", "find") });
}
function runQuiz() {
  const p = F.pending;
  CUR = p.plan[p.done] === "zh" ? makeZhQuestion() : makeMathQuestion();
  document.getElementById("modalQuiz").classList.remove("hidden");
  showQuestion();
}
function quizHeader() {
  const p = F.pending;
  document.getElementById("quizTitle").textContent = `美食扭蛋・第 ${Math.min(p.done + 1, 3)} / 3 題`;
  document.getElementById("quizDots").innerHTML = [0, 1, 2].map(i =>
    `<span class="k-stamp ${p.marks[i] === 1 ? "is-on" : ""}" style="${p.marks[i] === 0 ? "background:#FFE3DE;border:2.5px solid var(--ink)" : ""}"></span>`).join("");
}
function showQuestion() {
  quizHeader();
  qAnswered = false;
  const q = CUR;
  const tag = q.subj === "zh" ? `<span class="fd-subj zh">國語</span>` : `<span class="fd-subj math">數學</span>`;
  let html = "";
  if (q.passage) html += `<div class="fd-passage mb-3"><p class="k-display text-base mb-1">閱讀短文〈${q.passage.title}〉</p>${q.passage.text}</div>`;
  html += `<div class="k-question p-4 sm:p-5"><p class="text-lg sm:text-xl font-bold leading-relaxed">${tag}${q.prompt}</p></div>`;
  if (q.figure) html += `<div class="flex justify-center mt-3"><div class="dz-fig border-[3px] border-[#1E2A33]">${q.figure}</div></div>`;
  if (q.type === "choice") {
    const cols = q.grid4 || q.options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2";
    html += `<div class="grid ${cols} gap-3 mt-4">` + q.options.map((o, i) => `
      <button class="k-opt ${o.html ? "dz-opt-fig" : ""}" data-i="${i}" onclick="answerChoice(${i})">
        <span class="k-opt-key">${"ABCD"[i]}</span>${o.html ? o.html : `<span class="text-lg font-bold">${o.text}</span>`}
      </button>`).join("") + `</div>`;
  } else {
    html += gridHtml(q.grid) + `<div class="flex justify-center mt-4"><button id="btnGridOk" onclick="answerGrid()" class="k-btn k-btn--yellow px-8 py-2.5">我塗好了</button></div>`;
    GRID_ON = new Set();
  }
  html += `<div id="quizFeedback"></div>`;
  document.getElementById("quizBody").innerHTML = html;
}
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
  const g = CUR.grid;
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
  const ok = i === CUR.answer;
  document.querySelectorAll("#quizBody .k-opt").forEach(b => {
    const j = Number(b.dataset.i);
    b.disabled = true;
    if (j === CUR.answer) b.classList.add("is-right"); else if (j === i) b.classList.add("is-wrong");
  });
  finishAnswer(ok, "");
}
async function finishAnswer(ok, extra) {
  qAnswered = true;
  const p = F.pending;
  p.done += 1; if (ok) p.ok += 1;
  p.marks = p.marks.concat(ok ? 1 : 0);
  F.answered = (F.answered || 0) + 1;
  if (ok) F.correct = (F.correct || 0) + 1;
  else F.wrong[CUR.key] = (F.wrong[CUR.key] || 0) + 1;
  quizHeader();
  const last = p.done >= 3;
  document.getElementById("quizFeedback").innerHTML = `
    <div class="k-feedback ${ok ? "is-right" : "is-wrong"} p-4 mt-4">
      <p class="k-display text-lg">${ok ? "答對了！" : "答錯了"}</p>
      <p class="text-sm font-bold mt-1 leading-relaxed">${extra ? extra + "<br/>" : ""}${CUR.explain || ""}</p>
      <div class="flex justify-end mt-3"><button onclick="nextQuestion()" class="k-btn k-btn--yellow px-6 py-2">${last ? "看結果" : "下一題"}</button></div>
    </div>`;
  document.getElementById("quizFeedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
  await save();
}
function nextQuestion() {
  const p = F.pending;
  if (p.done < 3) { runQuiz(); return; }
  const passed = p.ok >= 2;
  document.getElementById("quizBody").innerHTML = `
    <div class="text-center py-4">
      <p class="k-display text-3xl">${passed ? "可以轉扭蛋了！" : "差一點點！"}</p>
      <p class="font-bold text-[#5B6B78] mt-2">3 題答對 ${p.ok} 題${passed ? "" : "，要答對 2 題才能轉。下次加油！"}</p>
      <button onclick="${passed ? "doDraw()" : "quizFail()"}" class="k-btn ${passed ? "k-btn--yellow" : "k-btn--sky"} px-8 py-3 mt-5 text-lg">${passed ? "轉扭蛋！" : "好"}</button>
    </div>`;
}
async function quizFail() {
  F.logs.unshift({ t: Date.now(), ok: F.pending.ok, got: null }); F.logs = F.logs.slice(0, 30);
  F.pending = null;
  closeModal("modalQuiz");
  await save();
  renderGacha();
}

/* ---------------- 抽獎 ---------------- */
function rollRarity() {
  if ((F.pity || 0) + 1 >= PITY) return "R";
  const x = Math.random();
  return x < RATE.R ? "R" : (x < RATE.R + RATE.U ? "U" : "N");
}
async function doDraw() {
  if (busy || !F.pending) return;
  busy = true;
  const r = rollRarity();
  const ing = pick(FOOD_INGS.filter(i => i.r === r));
  const n = FOOD_RARITY[r].give;
  const isNew = !F.seen[ing.id];
  F.inv[ing.id] = (F.inv[ing.id] || 0) + n;
  F.seen[ing.id] = 1;
  F.pity = r === "R" ? 0 : (F.pity || 0) + 1;
  F.draws = (F.draws || 0) + 1;
  F.recent.unshift({ i: ing.id, n }); F.recent = F.recent.slice(0, 12);
  F.logs.unshift({ t: Date.now(), ok: F.pending.ok, got: ing.id }); F.logs = F.logs.slice(0, 30);
  F.pending = null;
  const saved = await save();
  busy = false;
  closeModal("modalQuiz");
  if (!saved) return;
  renderAll();
  playDraw(ing, n, isNew);
}
const CAP_COLOR = { N: "#C9D5DF", U: "#4A90E2", R: "linear-gradient(135deg,#FFE27A,#F2A93B)" };
function playDraw(ing, n, isNew) {
  const el = document.getElementById("drawBody");
  el.innerHTML = `<div class="flex justify-center"><img id="drawMach" src="${FOOD_IMG}machine/food.webp" alt="" style="width:200px"/></div>
    <p class="k-display text-lg mt-2">轉轉轉…</p>`;
  document.getElementById("modalDraw").classList.remove("hidden");
  requestAnimationFrame(() => document.getElementById("drawMach").classList.add("dz-shake"));
  setTimeout(() => {
    el.innerHTML = `
      <p class="k-display text-xl mb-4">掉出一顆扭蛋！</p>
      <div class="flex justify-center"><div id="cap" class="dz-capsule is-${ing.r}" onclick="openCapsule()">
        <div class="bot"></div><div class="top" style="background:${CAP_COLOR[ing.r]}"></div></div></div>
      <p class="font-bold text-[#5B6B78] mt-4">點扭蛋打開它</p>`;
    window.__drawGot = { ing, n, isNew };
  }, 1000);
}
function openCapsule() {
  const cap = document.getElementById("cap");
  if (!cap || cap.classList.contains("is-open")) return;
  cap.classList.add("is-open");
  setTimeout(showReveal, 380);
}
function showReveal() {
  const { ing, n, isNew } = window.__drawGot;
  const R = FOOD_RARITY[ing.r];
  const canTry = FOOD_DISHES.filter(d => !F.found[d.id] && d.rec[ing.id]).length;
  document.getElementById("drawBody").innerHTML = `
    <p class="k-display text-xl">轉到了！</p>
    <div class="relative mx-auto mt-3" style="width:220px;height:220px">
      ${ing.r !== "N" ? `<div class="dz-rays spin absolute inset-0"></div>` : ""}
      <div class="dz-pop absolute inset-[18px] fd-tile is-${ing.r}" style="padding:12px"><img src="${FOOD_IMG}ing/${ing.id}.webp" alt="${ing.name}"/>
        ${isNew ? `<span class="fd-stock" style="background:var(--tomato);left:50%;right:auto;top:-12px;transform:translateX(-50%)">NEW</span>` : ""}</div>
    </div>
    <p class="k-display text-3xl mt-3">${ing.name} <span class="text-2xl">× ${n}</span></p>
    <p class="mt-1"><span class="fd-rar" style="background:${R.color};font-size:.85rem;padding:.1rem .6rem">${R.name}</span>
      <span class="text-sm font-bold text-[#5B6B78] ml-1">現在有 ${F.inv[ing.id]} 份</span></p>
    ${canTry ? `<p class="text-sm font-bold text-[#5B6B78] mt-2">圖鑑裡還有料理會用到它，去試做看看吧！</p>` : ""}
    <div class="flex justify-center gap-2 mt-5">
      <button onclick="closeModal('modalDraw');switchTab('book')" class="k-btn k-btn--sky px-5 py-2">去圖鑑</button>
      <button onclick="closeModal('modalDraw')" class="k-btn k-btn--yellow px-6 py-2">收下</button>
    </div>`;
}

/* ---------------- 食材庫 ---------------- */
function renderUnlockHint() {
  const ready = FOOD_DISHES.filter(d => !F.found[d.id] && recKeys(d).every(k => F.seen[k]));
  const el = document.getElementById("unlockHint");
  el.innerHTML = ready.length
    ? `<div class="fd-note" style="background:#DFF5E8">🔓 你的食材可以解鎖：
        ${ready.map(d => `<button onclick="openPot('${d.id}')" class="fd-chip" style="margin:.15rem .1rem">${d.name}</button>`).join("")}
        <div class="text-xs mt-1 text-[#33434F]">點料理名稱去試做看看，要自己想想需要哪些食材喔！</div></div>`
    : `<div class="fd-note" style="background:#fff">🔒 你的食材還沒辦法解鎖新的美食，再去扭蛋機轉轉看吧！</div>`;
}
function renderPantry() {
  renderUnlockHint();
  document.getElementById("pantryGrid").innerHTML = ["N", "U", "R"].map(r => {
    const list = FOOD_INGS.filter(i => i.r === r);
    const R = FOOD_RARITY[r];
    return `<div>
      <h3 class="k-display text-lg mb-2"><span class="fd-rar" style="background:${R.color};font-size:.85rem;padding:.1rem .6rem">${R.name}</span>
        <span class="text-sm text-[#5B6B78] ml-1">收集 ${list.filter(i => F.seen[i.id]).length} / ${list.length}</span></h3>
      <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">${list.map(i => ingTile(i, F.inv[i.id] || 0)).join("")}</div>
    </div>`;
  }).join("");
}

/* ---------------- 美食圖鑑 ---------------- */
function renderBook() {
  document.getElementById("regionChips").innerHTML = REGIONS.map(r => {
    const list = r === "全部" ? FOOD_DISHES : FOOD_DISHES.filter(d => d.region === r);
    return `<button onclick="bookRegion='${r}';renderBook()" class="fd-chip ${r === bookRegion ? "is-on" : ""}">${r} ${list.filter(d => F.found[d.id]).length}/${list.length}</button>`;
  }).join("");
  const list = bookRegion === "全部" ? FOOD_DISHES : FOOD_DISHES.filter(d => d.region === bookRegion);
  document.getElementById("bookGrid").innerHTML = list.map(d => {
    const f = !!F.found[d.id];
    const stock = (F.stock[d.id] || 0) + (F.perf[d.id] || 0);
    return `<div class="fd-dish ${f ? "" : "is-lock"}">
      <div class="pic"><img src="${FOOD_IMG}dish/${d.id}.webp" alt="${f ? d.name : "還沒發現的料理"}" loading="lazy" draggable="false"/>
        <span class="fd-flag">${d.country}</span>${stock ? `<span class="fd-stock">庫存 ${stock}</span>` : ""}</div>
      <div class="p-3 flex-1 flex flex-col">
        <h4 class="k-display text-lg leading-tight">${d.name}</h4>
        <p class="text-xs font-bold text-[#5B6B78] mt-1 flex-1">${f ? `售價 ${d.price} 家鄉幣` : `提示：${d.hint}`}</p>
        <button onclick="${f ? `openDish('${d.id}')` : `openPot('${d.id}')`}" class="k-btn ${f ? "k-btn--yellow" : "k-btn--sky"} k-btn--sm w-full mt-2">${f ? "看食譜・做料理" : "試做看看"}</button>
      </div>
    </div>`;
  }).join("");
}

/* ---- 試做鍋：選食材種類，種類全對就發現食譜（不會用掉食材） ---- */
let POT = { target: null, sel: [], msg: "" };
function openPot(targetId) {
  POT = { target: targetId, sel: [], msg: "" };
  document.getElementById("modalPot").classList.remove("hidden");
  renderPot();
}
function potToggle(id) {
  const i = POT.sel.indexOf(id);
  if (i >= 0) POT.sel.splice(i, 1);
  else { if (POT.sel.length >= 4) { POT.msg = "鍋子最多放 4 種食材喔！"; renderPot(); return; } POT.sel.push(id); }
  POT.msg = "";
  renderPot();
}
function renderPot() {
  const t = POT.target ? dishById(POT.target) : null;
  const sel = new Set(POT.sel);
  const seenIngs = FOOD_INGS.filter(i => F.seen[i.id]);
  document.getElementById("potBody").innerHTML = `
    <div class="flex items-start gap-3">
      ${t ? `<div class="fd-dish is-lock shrink-0" style="width:96px;box-shadow:3px 3px 0 var(--ink)"><div class="pic" style="padding:4px;border:0"><img src="${FOOD_IMG}dish/${t.id}.webp" alt=""/></div></div>` : `<div class="text-5xl">🍲</div>`}
      <div class="flex-1 min-w-0">
        <h2 class="k-display text-2xl">${t ? `試做：${t.name}` : "自由試做"}</h2>
        <p class="text-sm font-bold text-[#5B6B78] mt-1">${t ? `提示：${t.hint}` : "隨便組合看看，說不定會發現新料理！"}</p>
        <p class="text-xs font-bold text-[#5B6B78] mt-1">只要選<b>食材的種類</b>，不用管數量。試做不會用掉食材。</p>
      </div>
    </div>
    <div class="fd-pot mt-4">
      ${POT.sel.length ? POT.sel.map(id => { const g = ingById(id); return `<div class="fd-pot-item" title="${g.name}"><img src="${FOOD_IMG}ing/${id}.webp" alt="${g.name}"/><button class="x" onclick="potToggle('${id}')" aria-label="拿掉${g.name}">×</button></div>`; }).join("")
        : `<span class="font-bold text-[#9AA8B3]">點下面的食材放進鍋子</span>`}
    </div>
    <div id="potMsg" class="min-h-[1.5rem] mt-2 text-center font-black ${POT.msg.startsWith("✔") ? "text-emerald-600" : "text-[#C2412D]"}">${POT.msg}</div>
    <div class="flex justify-center gap-2 mt-1">
      <button onclick="closeModal('modalPot')" class="k-btn px-5 py-2" style="background:#fff">關閉</button>
      <button onclick="POT.sel=[];POT.msg='';renderPot()" class="k-btn k-btn--sm px-4" style="background:#fff">清空</button>
      <button onclick="tryPot()" class="k-btn k-btn--yellow px-7 py-2" ${POT.sel.length ? "" : "disabled"}>試試看！</button>
    </div>
    <h3 class="k-display text-base mt-5 mb-2">我轉到過的食材</h3>
    ${seenIngs.length ? `<div class="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 gap-2">${seenIngs.map(i => ingTile(i, null, { onclick: `potToggle('${i.id}')`, cls: sel.has(i.id) ? "is-pick" : "" })).join("")}</div>`
      : `<p class="text-sm font-bold text-[#5B6B78]">還沒有食材，先去扭蛋機轉一轉吧！</p>`}
    ${FOOD_INGS.length > seenIngs.length ? `<p class="text-xs font-bold text-[#9AA8B3] mt-2">還有 ${FOOD_INGS.length - seenIngs.length} 種食材沒轉到過，轉到以後才能放進鍋子。</p>` : ""}`;
}
async function tryPot() {
  if (!POT.sel.length) return;
  const sel = new Set(POT.sel);
  const same = d => { const k = recKeys(d); return k.length === sel.size && k.every(x => sel.has(x)); };
  const hit = FOOD_DISHES.find(same);
  if (hit) {
    if (F.found[hit.id]) { POT.msg = `✔ 這是「${hit.name}」，你已經發現過了！`; renderPot(); return; }
    F.found[hit.id] = Date.now();
    await save();
    closeModal("modalPot");
    renderBook(); renderTop();
    openDish(hit.id, true);
    return;
  }
  // 沒對上：有目標就比對目標，沒目標就說還不是料理
  const t = POT.target ? dishById(POT.target) : null;
  if (!t) { POT.msg = "這個組合還做不出料理，換換看吧！"; renderPot(); return; }
  const need = new Set(recKeys(t));
  const right = POT.sel.filter(x => need.has(x)).length;
  const extra = POT.sel.length - right, lack = need.size - right;
  if (extra === 0) POT.msg = `方向對了！還少了 ${lack} 種食材。`;
  else if (lack === 0) POT.msg = `食材都有了，但多放了 ${extra} 種不需要的。`;
  else POT.msg = `有 ${right} 種放對了，還有 ${extra} 種不對。這道菜一共要 ${need.size} 種。`;
  renderPot();
}

/* ---- 料理資訊與製作 ---- */
let COOK = { id: null, n: 1 };
function maxServings(d) { return Math.min(...recKeys(d).map(k => Math.floor((F.inv[k] || 0) / d.rec[k]))); }
function openDish(id, isNew = false) {
  COOK = { id, n: 1 };
  document.getElementById("modalDish").classList.remove("hidden");
  renderDish(isNew);
}
function renderDish(isNew = false) {
  const d = dishById(COOK.id);
  const max = maxServings(d);
  if (COOK.n > Math.max(1, max)) COOK.n = Math.max(1, max);
  const n = COOK.n;
  document.getElementById("dishBody").innerHTML = `
    ${isNew ? `<p class="k-display text-2xl text-center">🎉 發現新食譜！</p>` : ""}
    <div class="relative mx-auto mt-2" style="width:200px;height:200px">
      ${isNew ? `<div class="dz-rays spin absolute inset-0"></div>` : ""}
      <img src="${FOOD_IMG}dish/${d.id}.webp" alt="${d.name}" class="${isNew ? "dz-pop" : ""} absolute inset-[10px] w-[180px] h-[180px] object-contain"/>
    </div>
    <h2 class="k-display text-3xl text-center mt-1">${d.name}</h2>
    <p class="text-center text-sm font-bold text-[#5B6B78]">${d.country}・售價 ${d.price} 家鄉幣（完美擺盤 ${Math.floor(d.price * 1.5)}）</p>
    <p class="mt-3 text-[15px] font-medium leading-relaxed">${d.intro}</p>
    <h3 class="k-display text-lg mt-4 mb-2">做 <b>${n}</b> 份要用</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      ${recKeys(d).map(k => { const g = ingById(k), need = d.rec[k] * n, have = F.inv[k] || 0; return `
        <div class="fd-rec ${have < need ? "is-short" : ""}"><img src="${FOOD_IMG}ing/${k}.webp" alt=""/>
          <div class="flex-1 font-black leading-tight">${g.name}<div class="text-xs font-bold text-[#5B6B78]">每份 ${d.rec[k]} × ${n} 份＝ <b class="text-[#1E2A33]">${need}</b></div></div>
          <div class="text-xs font-black ${have < need ? "text-[#C2412D]" : "text-emerald-700"}">有 ${have}</div></div>`; }).join("")}
    </div>
    <div class="flex items-center justify-center gap-3 mt-4">
      <button class="fd-step" onclick="COOK.n=Math.max(1,COOK.n-1);renderDish()" ${n <= 1 ? "disabled" : ""} aria-label="少做一份">−</button>
      <div class="text-center min-w-[5rem]"><div class="k-display text-3xl">${n}</div><div class="text-xs font-bold text-[#5B6B78]">份（最多 ${max}）</div></div>
      <button class="fd-step" onclick="COOK.n=COOK.n+1;renderDish()" ${n >= max ? "disabled" : ""} aria-label="多做一份">＋</button>
    </div>
    <div class="flex justify-center gap-2 mt-4">
      <button onclick="closeModal('modalDish')" class="k-btn px-5 py-2" style="background:#fff">關閉</button>
      <button onclick="startPlating()" class="k-btn k-btn--yellow px-7 py-2" ${max < 1 ? "disabled" : ""}>${max < 1 ? "食材不夠" : `做 ${n} 份，去擺盤 →`}</button>
    </div>
    <p class="text-center text-xs font-bold text-[#5B6B78] mt-3">已經做過 ${F.made[d.id] || 0} 份・庫存 普通 ${F.stock[d.id] || 0} 份、完美 ${F.perf[d.id] || 0} 份</p>
    <p class="fd-note mt-3" style="font-size:.8rem">⚠️ 遊戲中的食譜、食材用量和圖片都是為了遊戲設計的，只在遊戲裡使用，和真正的做法不一樣，請勿輕易模仿。</p>`;
}


/* =========================================================
   對稱擺盤：盤子一半已經擺好，學生把另一半擺成對稱
   12 個位置圍成一圈，0 號在正上方、順時針
   ========================================================= */
let PLATE = null;
function startPlating() {
  const d = dishById(COOK.id);
  if (maxServings(d) < COOK.n) { renderDish(); return; }
  const axis = Math.random() < 0.5 ? "v" : "h";
  const mir = axis === "v" ? (i => (12 - i) % 12) : (i => (18 - i) % 12);
  const given = axis === "v" ? [7, 8, 9, 10, 11] : [10, 11, 0, 1, 2];
  const onAxis = axis === "v" ? [0, 6] : [3, 9];
  const g = Array(12).fill(null);
  const types = sample(GARNISH.map(x => x.id), 2 + rnd(2));
  sample(given, 3).forEach(i => { g[i] = pick(types); });
  if (Math.random() < 0.5) g[pick(onAxis)] = pick(types);   // 有時候對稱軸上也放一個
  PLATE = { d: d.id, n: COOK.n, axis, mir, given: new Set(given), g, tool: types[0], done: false, wrong: [] };
  renderPlate();
}
function plateXY(i, R) { const a = i * Math.PI / 6; return [160 + R * Math.sin(a), 160 - R * Math.cos(a)]; }
function plateSvg() {
  const P = PLATE, R = 124;
  const half = P.axis === "v"
    ? `<path d="M160 10 A150 150 0 0 0 160 310 Z" fill="#FFF3C4" opacity=".75"/>`
    : `<path d="M10 160 A150 150 0 0 1 310 160 Z" fill="#FFF3C4" opacity=".75"/>`;
  const axisLine = P.axis === "v"
    ? `<line x1="160" y1="2" x2="160" y2="318" stroke="#E5484D" stroke-width="4" stroke-dasharray="10 7"/>`
    : `<line x1="2" y1="160" x2="318" y2="160" stroke="#E5484D" stroke-width="4" stroke-dasharray="10 7"/>`;
  let spots = "";
  for (let i = 0; i < 12; i++) {
    const [x, y] = plateXY(i, R);
    const locked = P.given.has(i);
    const gid = P.g[i];
    const bad = P.wrong.includes(i);
    const gs = gid ? `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${i * 30}) scale(1.3)" stroke="${ART_INK}" stroke-width="2.3" stroke-linejoin="round">${garnishById(gid).svg}</g>` : "";
    const ring = !locked && !P.done ? `<circle cx="${x}" cy="${y}" r="21" fill="${gid ? "none" : "rgba(255,255,255,.6)"}" stroke="#9AA8B3" stroke-width="2" stroke-dasharray="4 4"/>` : "";
    const badRing = bad ? `<circle cx="${x}" cy="${y}" r="24" fill="none" stroke="#E5484D" stroke-width="4"/>` : "";
    spots += `<g class="${locked || P.done ? "" : "spot"}" ${locked || P.done ? "" : `onclick="plateTap(${i})"`}>${ring}<circle cx="${x}" cy="${y}" r="22" fill="transparent"/>${gs}${badRing}</g>`;
  }
  return `<svg class="fd-plate" viewBox="0 0 320 320">
    <circle cx="160" cy="160" r="152" fill="#fff" stroke="${ART_INK}" stroke-width="4"/>
    ${half}
    <circle cx="160" cy="160" r="98" fill="#F7FAFC" stroke="#C9D5DF" stroke-width="3"/>
    <image href="${FOOD_IMG}dish/${P.d}.webp" x="70" y="70" width="180" height="180"/>
    ${axisLine}${spots}
  </svg>`;
}
function renderPlate() {
  const P = PLATE, d = dishById(P.d);
  const sideName = P.axis === "v" ? ["左", "右"] : ["上", "下"];
  document.getElementById("dishBody").innerHTML = `
    <h2 class="k-display text-2xl text-center">對稱擺盤：${d.name} × ${P.n}</h2>
    <p class="text-center text-sm font-bold text-[#5B6B78] mt-1">${sideName[0]}半邊（黃色）已經擺好了。紅色虛線是對稱軸，請把${sideName[1]}半邊擺成和它對稱。</p>
    <div class="mt-3">${plateSvg()}</div>
    ${P.done ? "" : `
    <div class="flex flex-wrap justify-center gap-2 mt-3">
      ${GARNISH.map(g => `<button onclick="PLATE.tool='${g.id}';renderPlate()" class="fd-gpick ${P.tool === g.id ? "is-on" : ""}">
        <svg width="26" height="26" viewBox="-16 -16 32 32"><g stroke="${ART_INK}" stroke-width="2.3">${g.svg}</g></svg>${g.name}</button>`).join("")}
      <button onclick="PLATE.tool='erase';renderPlate()" class="fd-gpick ${P.tool === "erase" ? "is-on" : ""}">🧽 拿掉</button>
    </div>
    <p class="text-center text-xs font-bold text-[#5B6B78] mt-2">先選配料，再點盤子上的虛線圈。點同一種配料可以拿掉。</p>
    <div class="flex justify-center gap-2 mt-4">
      <button onclick="renderDish()" class="k-btn px-5 py-2" style="background:#fff">上一步</button>
      <button onclick="serveDish()" class="k-btn k-btn--yellow px-7 py-2">擺好了，上菜！</button>
    </div>`}`;
}
function plateTap(i) {
  const P = PLATE;
  if (P.done || P.given.has(i)) return;
  if (P.tool === "erase" || P.g[i] === P.tool) P.g[i] = null; else P.g[i] = P.tool;
  renderPlate();
}
async function serveDish() {
  if (busy || !PLATE || PLATE.done) return;
  const P = PLATE, d = dishById(P.d), n = P.n;
  if (maxServings(d) < n) { alert("食材不夠了，請重新選份數。"); renderDish(); return; }
  const wrong = [];
  for (let i = 0; i < 12; i++) if (!P.given.has(i) && P.g[i] !== P.g[P.mir(i)]) wrong.push(i);
  const ok = wrong.length === 0;
  busy = true;
  recKeys(d).forEach(k => { F.inv[k] = (F.inv[k] || 0) - d.rec[k] * n; });
  F.made[d.id] = (F.made[d.id] || 0) + n;
  if (ok) F.perf[d.id] = (F.perf[d.id] || 0) + n; else F.stock[d.id] = (F.stock[d.id] || 0) + n;
  F.plates = (F.plates || 0) + 1; if (ok) F.perfects = (F.perfects || 0) + 1;
  const saved = await save();
  busy = false;
  if (!saved) return;
  P.done = true; P.wrong = wrong;
  renderPantry(); renderBook(); renderShop();
  const price = ok ? Math.floor(d.price * 1.5) : d.price;
  const onMenu = F.shop.menu.includes(d.id);
  const canMenu = !onMenu && F.shop.menu.length < shopLevel().menu;
  document.getElementById("dishBody").innerHTML = `
    <div class="text-center">
      ${ok ? `<p class="k-display text-3xl">✨ 完美料理！</p><p class="font-bold text-[#5B6B78] mt-1">配料完全對稱，每份可以賣 ${price} 家鄉幣！</p>`
           : `<p class="k-display text-3xl">做好了！</p><p class="font-bold text-[#5B6B78] mt-1">有 ${wrong.length} 個位置沒有對稱（紅圈），這次是普通料理，每份賣 ${price} 家鄉幣。</p>`}
      <div class="mt-3">${plateSvg()}</div>
      <p class="k-display text-xl mt-2">${d.name} × ${n} ${ok ? `<span class="fd-rar fd-perf">完美</span>` : ""}</p>
      <div class="flex flex-wrap justify-center gap-2 mt-4">
        ${canMenu ? `<button onclick="menuAdd('${d.id}');closeModal('modalDish');switchTab('shop')" class="k-btn k-btn--sky px-5 py-2">放上菜單</button>` : ""}
        <button onclick="renderDish()" class="k-btn px-5 py-2" style="background:#fff">再做一些</button>
        <button onclick="closeModal('modalDish')" class="k-btn k-btn--yellow px-6 py-2">好</button>
      </div>
    </div>`;
}

/* =========================================================
   我的餐廳：菜單自動販賣、人氣、裝潢
   ========================================================= */
const SALE_MS = 30 * 1000;            // 有料理在菜單上時，每 30 秒來一位客人
const OFFLINE_MAX = 8 * 3600 * 1000;  // 沒上線最多累積 8 小時
const HOME_CAP = 500;                 // 每天最多賺 500 家鄉幣
const COIN_COST = 100;
const COIN_TABLE = [[2, 0.50], [3, 0.30], [5, 0.15], [7, 0.04], [10, 0.01]];

function levelOf(pop) { let l = 0; SHOP_LEVELS.forEach((L, i) => { if ((pop || 0) >= L.need) l = i; }); return l; }
const shopLevel = () => SHOP_LEVELS[levelOf(F.pop)];
function ensureCols() {
  const L = shopLevel(), s = F.shop;
  if (s.cols === L.cols) return;
  const shift = Math.round((L.cols - (s.cols || L.cols)) / 2);   // 店變大時，原本的擺設往中間移
  const lay = {};
  Object.entries(s.layout).forEach(([k, v]) => { const [r, c] = k.split(",").map(Number); const nc = c + shift; if (nc >= 0 && nc < L.cols) lay[r + "," + nc] = v; });
  s.layout = lay; s.cols = L.cols;
}
function placedCount(id) { return Object.values(F.shop.layout).filter(v => v === id).length; }
function decorSym() {
  const lay = F.shop.layout, cols = F.shop.cols;
  if (Object.keys(lay).length < 2) return false;
  for (let r = 0; r < SHOP_ROWS; r++) for (let c = 0; c < cols; c++) {
    if ((lay[r + "," + c] || null) !== (lay[r + "," + (cols - 1 - c)] || null)) return false;
  }
  return true;
}
const sellable = () => F.shop.menu.filter(id => (F.stock[id] || 0) + (F.perf[id] || 0) > 0);
function tickShop() {
  if (F.homeDay !== todayKey()) { F.homeDay = todayKey(); F.homeToday = 0; }
  const s = F.shop, now = Date.now();
  if (!s.last || s.last > now) { s.last = now; return 0; }
  if (now - s.last > OFFLINE_MAX) s.last = now - OFFLINE_MAX;
  const lv0 = levelOf(F.pop);
  let sold = 0;
  const sym = decorSym();
  while (now - s.last >= SALE_MS) {
    const avail = sellable();
    if (!avail.length || F.homeToday >= HOME_CAP) { s.last = now; break; }
    const id = pick(avail), d = dishById(id);
    const perfect = (F.perf[id] || 0) > 0;
    if (perfect) F.perf[id] -= 1; else F.stock[id] -= 1;
    const earn = Math.min(perfect ? Math.floor(d.price * 1.5) : d.price, HOME_CAP - F.homeToday);
    F.home += earn; F.homeToday += earn; F.homeTotal = (F.homeTotal || 0) + earn;
    const pop = (perfect ? 2 : 1) + (sym ? 1 : 0);
    F.pop = (F.pop || 0) + pop;
    s.last += SALE_MS; s.sold = (s.sold || 0) + 1; sold++;
    s.log.unshift({ t: s.last, d: id, p: perfect ? 1 : 0, e: earn, pop });
  }
  s.log = s.log.slice(0, 15);
  if (levelOf(F.pop) > lv0) { ensureCols(); window.__levelUp = levelOf(F.pop); }
  return sold;
}
let shopSaving = false;
async function shopLoop() {
  if (shopSaving || busy || F.pending) return;
  const sold = tickShop();
  if (!sold) return;
  shopSaving = true;
  await save();
  shopSaving = false;
  renderShop(); renderGacha(); renderBook();
  if (window.__levelUp != null) showLevelUp();
}
function showOffline(n) {
  const got = F.shop.log.slice(0, n).reduce((x, l) => x + l.e, 0);
  document.getElementById("drawBody").innerHTML = `
    <p class="k-display text-2xl">🏪 你不在的時候…</p>
    <p class="font-bold mt-3">餐廳賣出了 <b>${n}</b> 份料理，賺了 <b>${got}</b> 家鄉幣！</p>
    <button onclick="closeModal('modalDraw');${window.__levelUp != null ? "showLevelUp()" : ""}" class="k-btn k-btn--yellow px-6 py-2 mt-5">太好了</button>`;
  document.getElementById("modalDraw").classList.remove("hidden");
}
function showLevelUp() {
  const lv = window.__levelUp; window.__levelUp = null;
  const L = SHOP_LEVELS[lv];
  document.getElementById("drawBody").innerHTML = `
    <p class="k-display text-3xl">🎉 餐廳升級了！</p>
    <div class="fd-stage mt-4">${shopBgSvg(lv, false)}</div>
    <p class="font-bold mt-3">你的店變成「<b>${L.name}</b>」了！<br/>擺裝潢的位置變多，菜單也可以放 <b>${L.menu}</b> 道料理。</p>
    <button onclick="closeModal('modalDraw');switchTab('shop')" class="k-btn k-btn--yellow px-6 py-2 mt-5">去看看</button>`;
  document.getElementById("modalDraw").classList.remove("hidden");
}
function renderCountdown() {
  const el = document.getElementById("nextCustomer");
  if (!el || !F) return;
  if (F.homeToday >= HOME_CAP) { el.textContent = "今天的家鄉幣已經賺滿了，明天客人會再來！"; return; }
  if (!sellable().length) { el.textContent = F.shop.menu.length ? "菜單上的料理都賣完了，快去做菜補貨！" : "把料理放上菜單，客人就會來買。"; return; }
  const left = Math.max(0, F.shop.last + SALE_MS - Date.now());
  const m = Math.floor(left / 60000), sec = Math.floor(left / 1000) % 60;
  el.textContent = m ? `下一位客人大約 ${m} 分 ${sec} 秒後來` : `下一位客人大約 ${sec} 秒後來`;
  if (left === 0) shopLoop();
}

let SHOP_EDIT = false;
function toggleEdit() { SHOP_EDIT = !SHOP_EDIT; renderShop(); }
function renderShop() {
  if (!F) return;
  ensureCols();
  const lv = levelOf(F.pop), L = SHOP_LEVELS[lv], next = SHOP_LEVELS[lv + 1];
  document.getElementById("shopName").textContent = `${L.title}（${L.name}）`;
  document.getElementById("shopNext").textContent = next ? `人氣 ${F.pop}，到 ${next.need} 會升級成「${next.name}」` : `人氣 ${F.pop}，已經是最大的餐廳了！`;
  document.getElementById("popBar").style.width = (next ? Math.min(100, (F.pop - L.need) / (next.need - L.need) * 100) : 100) + "%";
  document.getElementById("homeToday").textContent = F.homeToday || 0;
  document.getElementById("homeBar").style.width = Math.min(100, (F.homeToday || 0) / HOME_CAP * 100) + "%";
  document.getElementById("btnEdit").textContent = SHOP_EDIT ? "✔ 擺好了" : "🪑 擺裝潢";
  // 舞台
  const W = shopW(L.cols), lay = F.shop.layout, cols = L.cols;
  let slots = "";
  for (let r = 0; r < SHOP_ROWS; r++) for (let c = 0; c < cols; c++) {
    const k = r + "," + c, rc = slotRect(r, c), id = lay[k];
    const bad = SHOP_EDIT && (lay[k] || null) !== (lay[r + "," + (cols - 1 - c)] || null);
    slots += `<div class="fd-slot ${bad ? "is-bad" : ""}" style="left:${rc.x / W * 100}%;top:${rc.y / SHOP_H * 100}%;width:${rc.w / W * 100}%;height:${rc.h / SHOP_H * 100}%"
      ${SHOP_EDIT ? `onclick="pickSlot(${r},${c})"` : ""}>${id ? decorSvg(id) : (SHOP_EDIT ? `<span class="text-2xl font-black text-[#1E2A33]/30">＋</span>` : "")}</div>`;
  }
  const stage = document.getElementById("shopStage");
  stage.classList.toggle("is-edit", SHOP_EDIT);
  stage.innerHTML = shopBgSvg(lv, SHOP_EDIT) + slots;
  const sym = decorSym();
  document.getElementById("symBadge").innerHTML = sym
    ? `<div class="fd-note" style="background:#DFF5E8">✨ 裝潢左右對稱！每賣出一份料理，人氣多 +1。</div>`
    : `<div class="fd-note" style="background:#fff">${SHOP_EDIT ? "紅色的格子和對面的格子擺得不一樣。" : ""}把裝潢擺成<b>以紅色虛線為對稱軸的左右對稱</b>（至少 2 件），每賣出一份料理人氣多 +1。</div>`;
  // 菜單
  const menu = F.shop.menu;
  let mh = menu.map((id, idx) => {
    const d = dishById(id), a = F.stock[id] || 0, b = F.perf[id] || 0;
    return `<div class="fd-menu ${a + b ? "" : "is-out"}"><img src="${FOOD_IMG}dish/${id}.webp" alt=""/>
      <div class="flex-1 min-w-0"><div class="font-black">${d.name}</div>
        <div class="text-xs font-bold text-[#5B6B78]">${a + b ? `普通 ${a}（${d.price}）・完美 ${b}（${Math.floor(d.price * 1.5)}）` : "賣完了，去做菜補貨"}</div></div>
      <button onclick="menuRemove(${idx})" class="k-btn k-btn--sm" style="background:#fff">拿下</button></div>`;
  }).join("");
  for (let i = menu.length; i < L.menu; i++) mh += `<div class="fd-menu is-empty" onclick="openMenuPick()">＋ 放上料理</div>`;
  if (next) mh += `<p class="text-xs font-bold text-[#9AA8B3]">升級成「${next.name}」後，菜單可以放 ${next.menu} 道。</p>`;
  document.getElementById("menuList").innerHTML = mh;
  document.getElementById("saleLog").innerHTML = F.shop.log.length ? F.shop.log.slice(0, 8).map(l => {
    const d = dishById(l.d), t = new Date(l.t);
    return `<div class="flex justify-between gap-2"><span>${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")} ${d ? d.name : ""}${l.p ? ` <span class="fd-rar fd-perf">完美</span>` : ""}</span><span class="text-[#5B6B78]">+${l.e} 鄉・人氣 +${l.pop}</span></div>`;
  }).join("") : `<p class="text-[#9AA8B3]">還沒有賣出料理。</p>`;
  renderCountdown();
}
function openMenuPick() {
  const list = FOOD_DISHES.filter(d => !F.shop.menu.includes(d.id) && (F.stock[d.id] || 0) + (F.perf[d.id] || 0) > 0);
  document.getElementById("pickBody").innerHTML = `
    <h2 class="k-display text-2xl mb-1">放上菜單</h2>
    <p class="text-sm font-bold text-[#5B6B78] mb-4">只能放已經做好、還有庫存的料理。完美料理會先賣。</p>
    ${list.length ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${list.map(d => `
      <button class="fd-tile" onclick="menuAdd('${d.id}');closeModal('modalPick')"><img src="${FOOD_IMG}dish/${d.id}.webp" alt=""/>
        <div class="nm">${d.name}</div><div class="text-xs font-bold text-[#5B6B78]">普通 ${F.stock[d.id] || 0}・完美 ${F.perf[d.id] || 0}</div></button>`).join("")}</div>`
      : `<p class="fd-note" style="background:#fff">還沒有可以賣的料理。先去「美食圖鑑」做菜吧！</p>`}
    <div class="flex justify-end mt-5"><button onclick="closeModal('modalPick')" class="k-btn px-5 py-2" style="background:#fff">關閉</button></div>`;
  document.getElementById("modalPick").classList.remove("hidden");
}
async function menuAdd(id) {
  const s = F.shop;
  if (s.menu.includes(id) || s.menu.length >= shopLevel().menu) return;
  if (!sellable().length) s.last = Date.now();   // 原本沒東西賣，從現在開始計時
  s.menu.push(id);
  renderShop();
  await save();
}
async function menuRemove(idx) {
  F.shop.menu.splice(idx, 1);
  renderShop();
  await save();
}

/* ---- 裝潢 ---- */
function pickSlot(r, c) {
  const k = r + "," + c, cur = F.shop.layout[k];
  const kind = r === 0 ? "w" : "f";
  const owned = DECOR.filter(d => d.k === kind && (F.decor[d.id] || 0) - placedCount(d.id) > 0);
  const mirrorId = F.shop.layout[r + "," + (F.shop.cols - 1 - c)];
  document.getElementById("pickBody").innerHTML = `
    <h2 class="k-display text-2xl mb-1">${r === 0 ? "牆上" : "地上"}的位置</h2>
    <p class="text-sm font-bold text-[#5B6B78] mb-4">${mirrorId && mirrorId !== cur ? `對面的格子放的是「${decorById(mirrorId).name}」。` : "選一件你有的裝潢放上去。"}</p>
    ${owned.length ? `<div class="grid grid-cols-3 sm:grid-cols-4 gap-3">${owned.map(d => `
      <button class="fd-tile ${mirrorId === d.id ? "is-pick" : ""}" onclick="placeDecor('${k}','${d.id}')">${decorSvg(d.id, 90)}<div class="nm">${d.name}</div>
        <span class="fd-count">${(F.decor[d.id] || 0) - placedCount(d.id)}</span></button>`).join("")}</div>`
      : `<p class="fd-note" style="background:#fff">你沒有可以放在${r === 0 ? "牆上" : "地上"}的裝潢了，去裝潢店買吧！</p>`}
    <div class="flex flex-wrap justify-end gap-2 mt-5">
      ${cur ? `<button onclick="placeDecor('${k}',null)" class="k-btn k-btn--tomato px-5 py-2">拿掉${decorById(cur).name}</button>` : ""}
      <button onclick="openDecorShop()" class="k-btn k-btn--yellow px-5 py-2">去裝潢店</button>
      <button onclick="closeModal('modalPick')" class="k-btn px-5 py-2" style="background:#fff">關閉</button>
    </div>`;
  document.getElementById("modalPick").classList.remove("hidden");
}
async function placeDecor(k, id) {
  if (id) F.shop.layout[k] = id; else delete F.shop.layout[k];
  closeModal("modalPick");
  renderShop();
  await save();
}
function openDecorShop() {
  const grp = k => DECOR.filter(d => d.k === k).map(d => {
    const own = F.decor[d.id] || 0, can = (F.home || 0) >= d.price;
    return `<div class="fd-tile">${decorSvg(d.id, 90)}<div class="nm">${d.name}</div>
      ${own ? `<span class="fd-count">${own}</span>` : ""}
      <button onclick="buyDecor('${d.id}')" class="k-btn ${can ? "k-btn--yellow" : ""} k-btn--sm w-full mt-1" style="${can ? "" : "background:#fff;opacity:.6"}">${d.price} 鄉</button></div>`;
  }).join("");
  document.getElementById("pickBody").innerHTML = `
    <div class="flex items-center justify-between gap-2"><h2 class="k-display text-2xl">🛋️ 裝潢店</h2>
      <span class="k-wallet text-base bg-white"><span class="fd-home">鄉</span>${F.home || 0}</span></div>
    <p class="text-sm font-bold text-[#5B6B78] mt-1 mb-4">用家鄉幣買裝潢。每一件裝潢都是線對稱圖形喔！想讓餐廳左右對稱，同一件通常要買 2 個。</p>
    <h3 class="k-display text-lg mb-2">掛在牆上</h3>
    <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">${grp("w")}</div>
    <h3 class="k-display text-lg mt-5 mb-2">放在地上</h3>
    <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">${grp("f")}</div>
    <div class="flex justify-end mt-5"><button onclick="closeModal('modalPick')" class="k-btn px-5 py-2" style="background:#fff">關閉</button></div>`;
  document.getElementById("modalPick").classList.remove("hidden");
}
async function buyDecor(id) {
  if (busy) return;
  const d = decorById(id);
  if ((F.home || 0) < d.price) { alert(`家鄉幣不夠喔！「${d.name}」要 ${d.price} 家鄉幣。`); return; }
  busy = true;
  F.home -= d.price;
  F.decor[id] = (F.decor[id] || 0) + 1;
  const ok = await save();
  busy = false;
  if (!ok) return;
  renderGacha();
  openDecorShop();
}

/* ---- 金幣扭蛋機 ---- */
async function coinDraw() {
  if (busy) return;
  if ((F.home || 0) < COIN_COST) { alert(`家鄉幣不夠喔！轉一次要 ${COIN_COST} 家鄉幣，讓餐廳多賣一些料理吧。`); return; }
  busy = true;
  let x = Math.random(), got = COIN_TABLE[0][0];
  for (const [c, p] of COIN_TABLE) { if (x < p) { got = c; break; } x -= p; }
  F.home -= COIN_COST;
  F.coinDraws = (F.coinDraws || 0) + 1;
  F.coinWon = (F.coinWon || 0) + got;
  const ok = await save(got);
  busy = false;
  if (!ok) return;
  renderGacha();
  const el = document.getElementById("drawBody");
  el.innerHTML = `<div class="flex justify-center"><img id="drawMach" src="${FOOD_IMG}machine/coin.webp" alt="" style="width:200px"/></div><p class="k-display text-lg mt-2">轉轉轉…</p>`;
  document.getElementById("modalDraw").classList.remove("hidden");
  requestAnimationFrame(() => document.getElementById("drawMach").classList.add("dz-shake"));
  setTimeout(() => {
    const big = got >= 7;
    el.innerHTML = `<p class="k-display text-xl mb-4">掉出一顆扭蛋！</p>
      <div class="flex justify-center"><div id="cap" class="dz-capsule ${big ? "is-R" : ""}" onclick="openCoinCap(${got})">
        <div class="bot"></div><div class="top" style="background:${big ? CAP_COLOR.R : "#FFC83D"}"></div></div></div>
      <p class="font-bold text-[#5B6B78] mt-4">點扭蛋打開它</p>`;
  }, 1000);
}
function openCoinCap(got) {
  const cap = document.getElementById("cap");
  if (!cap || cap.classList.contains("is-open")) return;
  cap.classList.add("is-open");
  setTimeout(() => {
    document.getElementById("drawBody").innerHTML = `
      <p class="k-display text-xl">轉到了！</p>
      <div class="relative mx-auto mt-3" style="width:200px;height:200px">
        ${got >= 5 ? `<div class="dz-rays spin absolute inset-0"></div>` : ""}
        <div class="dz-pop absolute inset-0 flex items-center justify-center"><span class="k-coin" style="width:110px;height:110px;font-size:3rem"></span></div>
      </div>
      <p class="k-display text-4xl mt-2">${got} 金幣</p>
      <p class="text-sm font-bold text-[#5B6B78] mt-1">現在有 ${STU.coins} 金幣・家鄉幣剩 ${F.home}</p>
      <div class="flex justify-center gap-2 mt-5"><button onclick="closeModal('modalDraw')" class="k-btn k-btn--yellow px-6 py-2">收下</button></div>`;
  }, 380);
}
