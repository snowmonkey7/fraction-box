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
    draws: 0, answered: 0, correct: 0, wrong: {}, recent: [], zhSeen: [], logs: [], pending: null, helped: false
  }, raw || {});
  ["inv", "seen", "found", "made", "stock", "wrong"].forEach(k => { if (!f[k] || typeof f[k] !== "object") f[k] = {}; });
  ["recent", "zhSeen", "logs"].forEach(k => { if (!Array.isArray(f[k])) f[k] = []; });
  if (f.freeDay !== todayKey()) { f.freeDay = todayKey(); f.freeUsed = 0; }
  return f;
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
  renderAll();
  if (F.pending) resumePending();
  else if (!F.helped) { F.helped = true; save(); openHelp(0); }
};
function renderTop() {
  document.getElementById("fCoins").textContent = STU.coins || 0;
  document.getElementById("fFound").textContent = foundCount();
  document.getElementById("fAnswered").textContent = F.answered || 0;
  document.getElementById("fAcc").textContent = F.answered ? Math.round(F.correct / F.answered * 100) + "%" : "—";
}
function renderAll() { renderTop(); renderGacha(); renderPantry(); renderBook(); }
function switchTab(name) {
  document.querySelectorAll(".k-tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === name));
  ["gacha", "pantry", "book"].forEach(t => document.getElementById("tab_" + t).classList.toggle("hidden", t !== name));
}
function fLogout() { clearSessionStudent(); location.href = "index.html"; }

/* ---------------- 怎麼玩 ---------------- */
const HELP_PAGES = [
  { t: "🎰 轉扭蛋拿食材", b: `<p>每天有 <b>3 次免費</b>扭蛋，用完之後每次 <b>2 金幣</b>。</p>
      <p class="mt-2">轉之前要答 <b>3 題</b>（國語第八課和數學線對稱都會出），<b>答對 2 題以上</b>才能轉。</p>
      <p class="mt-2">常見食材一次拿 <b>10 份</b>、少見 <b>5 份</b>、稀有 <b>2 份</b>。轉了 30 次還沒出稀有，第 30 次一定出！</p>` },
  { t: "📖 在圖鑑發現食譜", b: `<p>圖鑑裡有台灣和世界各地的 31 道料理，每一道都是<b>線對稱</b>的喔。</p>
      <p class="mt-2">還沒發現的料理只看得到影子和提示。點它，把你覺得需要的食材放進鍋子按「試試看」，<b>種類全部對了</b>就會發現食譜！</p>
      <p class="mt-2">試做<b>不會用掉食材</b>，放心多試幾次。</p>` },
  { t: "🍳 做料理", b: `<p>發現食譜以後，就看得到<b>每一份要用多少食材</b>。</p>
      <p class="mt-2">選要做幾份，系統會幫你算出總共要用多少食材，再從食材庫扣掉。做好的料理會放進庫存。</p>
      <p class="mt-2">例如滷肉飯每份要 米 2、豬肉 1、醬油 1，做 3 份就要 米 6、豬肉 3、醬油 3。</p>` },
  { t: "🍽️ 對稱擺盤（即將推出）", b: `<p>做料理的時候，可以把配菜擺在盤子上。擺得<b>左右對稱</b>就是「完美料理」，賣的價錢是一般的 <b>1.5 倍</b>！</p>` },
  { t: "🏪 開餐廳（即將推出）", b: `<p>把料理放上菜單，客人會自己來買，就算沒上線也會慢慢賣出。</p>
      <p class="mt-2">賣料理可以賺<b>家鄉幣</b>和<b>人氣</b>。人氣越高，餐廳會從小店變成大餐廳；家鄉幣可以去轉<b>金幣扭蛋機</b>換金幣。</p>
      <p class="fd-note mt-4">⚠️ 遊戲中的食譜、食材用量和圖片都是為了遊戲設計的，只在遊戲裡使用，和真正的做法不一樣，請勿輕易模仿。想在家下廚時，請和大人一起。</p>` }
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
      if (!confirm(`要用 ${DRAW_COST} 金幣轉一次嗎？\n要先答 3 題，答對 2 題以上才能轉。`)) return;
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
function renderPantry() {
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
    const stock = F.stock[d.id] || 0;
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
  else { if (POT.sel.length >= 6) { POT.msg = "鍋子最多放 6 種食材喔！"; renderPot(); return; } POT.sel.push(id); }
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
      <button onclick="cookDish()" class="k-btn k-btn--yellow px-7 py-2" ${max < 1 ? "disabled" : ""}>${max < 1 ? "食材不夠" : `做 ${n} 份`}</button>
    </div>
    <p class="text-center text-xs font-bold text-[#5B6B78] mt-3">已經做過 ${F.made[d.id] || 0} 份・庫存 ${F.stock[d.id] || 0} 份（餐廳開張後可以上架賣）</p>
    <p class="fd-note mt-3" style="font-size:.8rem">⚠️ 遊戲中的食譜、食材用量和圖片都是為了遊戲設計的，只在遊戲裡使用，和真正的做法不一樣，請勿輕易模仿。</p>`;
}
async function cookDish() {
  if (busy) return;
  const d = dishById(COOK.id);
  const n = COOK.n;
  if (n < 1 || maxServings(d) < n) { renderDish(); return; }
  busy = true;
  recKeys(d).forEach(k => { F.inv[k] = (F.inv[k] || 0) - d.rec[k] * n; });
  F.made[d.id] = (F.made[d.id] || 0) + n;
  F.stock[d.id] = (F.stock[d.id] || 0) + n;
  const ok = await save();
  busy = false;
  if (!ok) return;
  renderPantry(); renderBook();
  document.getElementById("dishBody").innerHTML = `
    <div class="text-center py-2">
      <div class="fd-steam h-8"><span></span><span></span><span></span></div>
      <img src="${FOOD_IMG}dish/${d.id}.webp" alt="${d.name}" class="dz-pop mx-auto w-44 h-44 object-contain"/>
      <p class="k-display text-2xl mt-2">${d.name} × ${n} 做好了！</p>
      <p class="text-sm font-bold text-[#5B6B78] mt-1">庫存現在有 ${F.stock[d.id]} 份</p>
      <div class="flex justify-center gap-2 mt-5">
        <button onclick="renderDish()" class="k-btn k-btn--sky px-5 py-2">再做一些</button>
        <button onclick="closeModal('modalDish')" class="k-btn k-btn--yellow px-6 py-2">好</button>
      </div>
    </div>`;
}
