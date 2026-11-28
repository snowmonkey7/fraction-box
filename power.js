/* =========================================================
   小小的力量｜遊戲主程式
   個人：答題得火光 → 花火光點亮世界地圖上的 19 個地點（五區依序開放）
   全班：每答對 +1 盞燈、答錯 −1 盞（每人最多貢獻 cfg.cap 盞），一起點亮學校地圖
   全班的燈存在 _power_老師代號：c.座號 = 這位同學目前的貢獻；e.座號 = 最近點亮的地點；d.座號 = 今天點了幾盞
   學生和測試帳號共用這筆資料，但分開計算（測試帳號只算測試帳號的）
   ========================================================= */
let STU = null, P = null, TEACHER = null, CLS = null, CFG = Object.assign({}, POWER_DEFAULT_CFG);
let POOL_IDS = [];         // 和我同一組（學生或測試帳號）且老師有開放的座號
let SEL = null, MISSION = null, BUSY = false;
const $ = id => document.getElementById(id);
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const QBY = {};
POWER_QUESTIONS.forEach(q => { QBY[q.id] = q; });
const LOC = {};
POWER_LOCS.forEach(L => { LOC[L.id] = L; });
const READ_OF = {};
POWER_QUESTIONS.forEach(q => { if (q.loc && !READ_OF[q.loc]) READ_OF[q.loc] = { title: q.pt, text: q.p }; });

function blankPower() {
  return { fire: 0, lit: {}, give: 0, ans: 0, cor: 0, zhA: 0, zhC: 0, mA: 0, mC: 0, factC: 0, readC: 0,
    wrong: {}, seen: [], dayKey: "", dayCoins: 0, days: [], claimed: [], missions: 0 };
}
function normPower(p) {
  const b = blankPower();
  p = Object.assign(b, p || {});
  ["fire", "give", "ans", "cor", "zhA", "zhC", "mA", "mC", "factC", "readC", "dayCoins", "missions"].forEach(k => { p[k] = Math.max(0, Number(p[k]) || 0); });
  if (!p.lit || typeof p.lit !== "object") p.lit = {};
  if (!p.wrong || typeof p.wrong !== "object") p.wrong = {};
  ["seen", "days", "claimed"].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
  return p;
}
function classDocId() { return "_power_" + (TEACHER ? TEACHER.id : "x"); }

/* ---------------- 資料讀寫 ---------------- */
async function loadClass() {
  let d = null;
  if (isCloudMode) {
    const doc = await withTimeout(db.collection(COLLECTION_NAME).doc(classDocId()).get());
    d = doc.exists ? doc.data() : null;
  } else {
    d = getLocalStore()[classDocId()] || null;
  }
  CLS = Object.assign({ c: {}, e: {}, d: {}, cfg: {} }, d || {});
  CFG = Object.assign({}, POWER_DEFAULT_CFG, CLS.cfg || {});
}
async function writeClass(fields) {
  // 只寫自己的那幾格（c.座號、e.座號、d.座號），不會蓋掉其他同學
  const data = {};
  Object.entries(fields).forEach(([k, v]) => { data[k + "." + STU.id] = v; });
  if (isCloudMode) {
    const ref = db.collection(COLLECTION_NAME).doc(classDocId());
    try { await withTimeout(ref.update(data)); }
    catch (e) {
      if (e && (e.code === "not-found" || /No document/i.test(e.message || ""))) {
        const obj = {};
        Object.entries(fields).forEach(([k, v]) => { obj[k] = { [STU.id]: v }; });
        await withTimeout(ref.set(obj, { merge: true }));
      } else throw e;
    }
  } else {
    const store = getLocalStore();
    const doc = store[classDocId()] || (store[classDocId()] = { c: {}, e: {}, d: {} });
    Object.entries(fields).forEach(([k, v]) => { (doc[k] = doc[k] || {})[STU.id] = v; });
    saveLocalStore(store);
  }
  Object.entries(fields).forEach(([k, v]) => { (CLS[k] = CLS[k] || {})[STU.id] = v; });
}
async function savePower(coinDelta = 0) {
  STU.power = P;
  await saveGameData(STU, "power", coinDelta);
}
async function loadPool() {
  const mineTest = isTestAccount(STU.id);
  try {
    const list = await fetchAllStudents();
    POOL_IDS = list.filter(s => {
      const t = teacherOfStudent(s.id);
      return t && TEACHER && t.id === TEACHER.id && isPowerOpen(s) && isTestAccount(s.id) === mineTest;
    }).map(s => s.id);
  } catch (e) { POOL_IDS = [STU.id]; }
  if (!POOL_IDS.includes(STU.id)) POOL_IDS.push(STU.id);
}

/* ---------------- 全班進度 ---------------- */
function poolState() {
  const cap = CFG.cap, n = Math.max(1, POOL_IDS.length);
  const give = id => Math.max(0, Math.min(cap, Number((CLS.c || {})[id]) || 0));
  const total = POOL_IDS.reduce((a, id) => a + give(id), 0);
  const goal = CFG.per * n;
  const marks = POWER_SPOTS.map((_, i) => Math.round(goal * (i + 1) / POWER_SPOTS.length));
  const under = POOL_IDS.filter(id => give(id) < CFG.min).length;
  let lit = 0;
  for (let i = 0; i < marks.length; i++) {
    if (total < marks[i]) break;
    if (i === marks.length - 1 && under > 0) break;   // 最後一站：每個人都要達到最低貢獻
    lit = i + 1;
  }
  const today = POOL_IDS.reduce((a, id) => { const x = (CLS.d || {})[id]; return a + (x && x.k === todayKey() ? Number(x.n) || 0 : 0); }, 0);
  return { n, total, goal, marks, under, lit, today };
}

/* ---------------- 地區與地點 ---------------- */
function regionOpen(rid) {
  const i = POWER_REGIONS.findIndex(r => r.id === rid);
  if (i <= 0) return true;
  const prev = POWER_REGIONS[i - 1].id;
  return POWER_LOCS.filter(L => L.r === prev).every(L => P.lit[L.id]);
}
const regionOf = rid => POWER_REGIONS.find(r => r.id === rid);
const costOf = L => regionOf(L.r).cost;
function litCount() { return POWER_LOCS.filter(L => P.lit[L.id]).length; }

/* ---------------- 畫面 ---------------- */
function renderTop() {
  $("pwFireTop").textContent = P.fire;
  $("pwCoins").textContent = STU.coins || 0;
  $("pwGive").textContent = P.give;
  $("pwDayCoins").textContent = P.dayKey === todayKey() ? P.dayCoins : 0;
  document.querySelectorAll(".jsGain").forEach(e => e.textContent = CFG.gain);
  document.querySelectorAll(".jsLoss").forEach(e => e.textContent = CFG.loss);
  document.querySelectorAll(".jsCap").forEach(e => e.textContent = CFG.cap);
  document.querySelectorAll(".jsLen").forEach(e => e.textContent = POWER_MISSION_LEN);
}
function renderWorld() {
  const open = {};
  POWER_REGIONS.forEach(r => { open[r.id] = regionOpen(r.id); });
  if (!SEL) SEL = (POWER_LOCS.find(L => open[L.r] && !P.lit[L.id]) || POWER_LOCS[0]).id;
  $("worldMap").innerHTML = worldMapSVG({ lit: P.lit, open, sel: SEL });
  $("worldMap").querySelectorAll(".pw-pin").forEach(g => {
    const go = () => { SEL = g.dataset.id; renderWorld(); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
  $("regionBar").innerHTML = POWER_REGIONS.map((r, i) => {
    const locs = POWER_LOCS.filter(L => L.r === r.id), done = locs.filter(L => P.lit[L.id]).length, op = open[r.id];
    return `<div class="px-3 py-2 rounded-xl border-2 ${op ? "border-[#FFC857] bg-[#2A3B58]" : "border-[#3B5277] bg-[#15233B] opacity-70"} text-sm font-bold">
      <span class="text-[#FFE6A6]">${i + 1}. ${r.name}</span> <span class="text-[#C9D6E6]">${op ? `${done}/${locs.length}・每個 ${r.cost} 火光` : "前一區全部點亮後開放"}</span></div>`;
  }).join("");
  renderLocPanel();
}
function renderLocPanel() {
  const L = LOC[SEL], on = !!P.lit[L.id], op = regionOpen(L.r), cost = costOf(L);
  const pct = Math.min(100, Math.round(P.fire / cost * 100));
  let action;
  if (on) action = `<p class="font-bold text-[#15803D]">已經點亮了！</p><button onclick="showStory('${L.id}')" class="k-btn bg-white px-4 py-2 mt-2">看故事卡</button>`;
  else if (!op) action = `<p class="font-bold text-[#5B6B78]">要先把「${regionOf(POWER_REGIONS[POWER_REGIONS.findIndex(r => r.id === L.r) - 1].id).name}」的地點全部點亮，這一區才會開放。</p>`;
  else if (P.fire >= cost) action = `<button onclick="lightLoc('${L.id}')" class="k-btn k-btn--yellow px-6 py-2.5 text-lg">花 ${cost} 火光點亮這裡</button>`;
  else action = `<p class="font-bold text-sm">還差 <b class="text-[#C2410C]">${cost - P.fire}</b> 火光。完成行動任務來收集火光吧！</p>
    <div class="pw-bar mt-2"><div style="width:${pct}%"></div></div>
    <button onclick="startMission()" class="k-btn k-btn--yellow px-5 py-2 mt-3">開始行動任務</button>`;
  $("locPanel").innerHTML = `<div class="grid grid-cols-[110px_1fr] md:grid-cols-[150px_1fr] gap-4 items-center">
    <div class="pw-thumb ${on ? "" : "is-dark"}"><img src="images/power/${L.id}.webp" alt="" loading="lazy"/></div>
    <div>
      <span class="k-chip k-chip--yellow">${regionOf(L.r).name}・第 ${Number(L.id.slice(1))} 站</span>
      <p class="k-display text-2xl mt-1">${L.title}</p>
      <p class="text-sm font-bold text-[#5B6B78]">${L.place}・${L.act}</p>
      <div class="mt-3">${action}</div>
    </div></div>`;
}
function renderSchool() {
  const st = poolState(), mine = isTestAccount(STU.id);
  $("schoolMap").innerHTML = schoolMapSVG(st.lit);
  $("schoolMap").querySelectorAll(".pw-spot").forEach(g => g.addEventListener("click", () => {
    const i = POWER_SPOTS.findIndex(s => s.id === g.dataset.spot);
    showSpot(i, st);
  }));
  $("poolTitle").textContent = mine ? "測試帳號的學校地圖" : "全班一起點亮學校";
  $("poolInfo").textContent = mine
    ? `這是測試帳號專用的進度，不會影響學生。一起計算的有 ${st.n} 個測試帳號。`
    : `一起努力的同學：${st.n} 位。全班目標 ${st.goal} 盞燈（每人 ${CFG.per} 盞 × ${st.n} 人）。`;
  const nextMark = st.marks[st.lit];
  const prevMark = st.lit ? st.marks[st.lit - 1] : 0;
  const pct = st.lit >= POWER_SPOTS.length ? 100 : Math.min(100, Math.round((st.total - prevMark) / Math.max(1, nextMark - prevMark) * 100));
  $("poolBar").style.width = pct + "%";
  $("poolNext").innerHTML = st.lit >= POWER_SPOTS.length
    ? `全校都亮起來了！一共 <b>${st.total}</b> 盞燈。`
    : `目前 <b>${st.total}</b> 盞燈，再 <b>${Math.max(0, nextMark - st.total)}</b> 盞就能點亮第 ${st.lit + 1} 站「${POWER_SPOTS[st.lit].name}」。`;
  $("poolMin").textContent = st.lit >= POWER_SPOTS.length - 1 && st.lit < POWER_SPOTS.length && st.under > 0
    ? `最後一站需要每個人都至少貢獻 ${CFG.min} 盞燈：還有 ${st.under} 位同學還沒達到。`
    : (st.under > 0 ? `最後一站「校門口」需要每個人至少貢獻 ${CFG.min} 盞燈（目前還有 ${st.under} 位還沒達到）。` : "");
  $("poolToday").textContent = st.today;
  const feed = POOL_IDS.map(id => ({ id, e: (CLS.e || {})[id] })).filter(x => x.e && LOC[x.e.loc]).sort((a, b) => b.e.t - a.e.t).slice(0, 6);
  $("poolFeed").innerHTML = feed.length ? feed.map(x => `<li><span class="pw-flame align-middle"></span> ${escapeHtml(String(x.id).slice(-2))} 號點亮了「${LOC[x.e.loc].title}」</li>`).join("")
    : `<li class="text-[#5B6B78]">還沒有人點亮地點，成為第一道火光吧！</li>`;
  $("spotList").innerHTML = POWER_SPOTS.map((s, i) => `<li class="flex gap-2 ${i < st.lit ? "" : "opacity-60"}">
    <span class="shrink-0 w-6 h-6 rounded-full border-2 border-[#1E2A33] text-xs font-black flex items-center justify-center ${i < st.lit ? "bg-[#FFC857]" : "bg-white"}">${i + 1}</span>
    <span><b>${s.name}</b>・${s.act}</span></li>`).join("");
}
function showSpot(i, st) {
  const s = POWER_SPOTS[i], on = i < st.lit;
  openModal(`<p class="k-chip k-chip--yellow">第 ${i + 1} 站</p>
    <p class="k-display text-2xl mt-2">${s.name}</p>
    <p class="font-bold mt-3">在這裡可以做的小行動：</p>
    <p class="text-lg font-bold text-[#C2410C] mt-1">${s.act}</p>
    <p class="text-sm font-bold text-[#5B6B78] mt-3">${on ? "這裡已經被全班點亮了！" : `全班累積到 ${st.marks[i]} 盞燈就會點亮${i === POWER_SPOTS.length - 1 ? `（而且每個人都要至少貢獻 ${CFG.min} 盞）` : ""}。`}</p>
    <div class="text-right mt-5"><button onclick="closeModal('modalPw')" class="k-btn k-btn--yellow px-6 py-2">知道了</button></div>`);
}
function renderCards() {
  $("cardGrid").innerHTML = POWER_LOCS.map(L => {
    const on = !!P.lit[L.id];
    return `<button onclick="${on ? `showStory('${L.id}')` : ""}" class="text-left ${on ? "" : "cursor-default"}">
      <div class="pw-thumb ${on ? "" : "is-dark"}"><img src="images/power/${L.id}.webp" alt="" loading="lazy"/></div>
      <p class="text-sm font-black mt-1 ${on ? "text-[#FFE6A6]" : "text-[#7D90A6]"}">${on ? L.title : "？？？"}</p>
      <p class="text-[11px] font-bold text-[#9FB1C8]">${Number(L.id.slice(1))}. ${L.place}</p></button>`;
  }).join("");
}
const BADGES = [
  { id: "b1", name: "第一盞燈", tip: "點亮第一個地點", ok: () => litCount() >= 1, c: "#FFC857" },
  { id: "b2", name: "連續行動", tip: "連續 3 天完成行動任務", ok: () => streak() >= 3, c: "#FF9F5A" },
  { id: "b3", name: "事實觀點達人", tip: "答對 20 題事實與觀點", ok: () => P.factC >= 20, c: "#7CC4F5" },
  { id: "b4", name: "四則運算達人", tip: "答對 60 題數學", ok: () => P.mC >= 60, c: "#5BB8F0" },
  { id: "b5", name: "閱讀小達人", tip: "答對 30 題閱讀測驗", ok: () => P.readC >= 30, c: "#4CB782" },
  { id: "b6", name: "萊恩徽章", tip: "點亮非洲區全部地點", ok: () => POWER_LOCS.filter(L => L.r === "r2").every(L => P.lit[L.id]), c: "#5FA8D3" },
  { id: "b7", name: "全班的火光", tip: "替全班點滿最低貢獻", ok: () => P.give >= CFG.min, c: "#F2A65A" },
  { id: "b8", name: "點燈人", tip: "點亮世界地圖上全部 19 個地點", ok: () => litCount() >= POWER_LOCS.length, c: "#FFE07A" }
];
function badgeSVG(b, i) {
  const icons = [
    `<path d="M32 14c4 8 12 11 12 21a12 12 0 0 1-24 0c0-6 3-9 6-12 0 4 2 7 5 7-2-6-1-11 1-16z" fill="#FFB21E" stroke="#1E2A33" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="M18 40l8-8 6 6 14-14" fill="none" stroke="#1E2A33" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="46" cy="24" r="4" fill="#fff" stroke="#1E2A33" stroke-width="3"/>`,
    `<rect x="17" y="18" width="30" height="28" rx="4" fill="#fff" stroke="#1E2A33" stroke-width="3"/><path d="M22 27h20M22 34h14" stroke="#1E2A33" stroke-width="3" stroke-linecap="round"/><circle cx="44" cy="42" r="7" fill="#4CB782" stroke="#1E2A33" stroke-width="3"/>`,
    `<text x="32" y="42" text-anchor="middle" font-size="26" font-weight="900" fill="#1E2A33">+×</text>`,
    `<path d="M16 22q8-4 16 0v24q-8-4-16 0z M48 22q-8-4-16 0v24q8-4 16 0z" fill="#fff" stroke="#1E2A33" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="M22 30h20v14a10 10 0 0 1-20 0z" fill="#9BD3F0" stroke="#1E2A33" stroke-width="3"/><path d="M32 14c3 5 6 7 6 11a6 6 0 0 1-12 0c0-4 3-6 6-11z" fill="#5BB8F0" stroke="#1E2A33" stroke-width="3"/>`,
    `<circle cx="24" cy="30" r="6" fill="#FFE07A" stroke="#1E2A33" stroke-width="3"/><circle cx="40" cy="30" r="6" fill="#FFE07A" stroke="#1E2A33" stroke-width="3"/><path d="M14 48q10-12 20 0M30 48q10-12 20 0" fill="none" stroke="#1E2A33" stroke-width="3"/>`,
    `<path d="M26 18h12v6l4 4v18H22V28l4-4z" fill="#FFE07A" stroke="#1E2A33" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="36" r="5" fill="#FFF8E1" stroke="#1E2A33" stroke-width="2"/>`
  ];
  return `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="${b.c}" stroke="#1E2A33" stroke-width="3"/>${icons[i]}</svg>`;
}
function renderBadges() {
  $("badgeGrid").innerHTML = BADGES.map((b, i) => `<div class="pw-badge ${b.ok() ? "is-on" : ""}">${badgeSVG(b, i)}
    <b class="k-display">${b.name}</b><span class="text-xs font-bold text-[#5B6B78]">${b.tip}</span></div>`).join("");
}
function streak() {
  const days = [...new Set(P.days)].sort().reverse();
  let n = 0, d = new Date();
  for (let i = 0; i < 60; i++) {
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (days.includes(k)) n += 1; else if (i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function renderAll() { renderTop(); renderWorld(); renderSchool(); renderCards(); renderBadges(); }
function pwTab(name) {
  ["world", "school", "cards", "badges"].forEach(t => $("pane_" + t).classList.toggle("hidden", t !== name));
  document.querySelectorAll(".k-tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === name));
  if (name === "school") refreshSchool();
}
async function refreshSchool() {
  try { await loadClass(); } catch (e) {}
  renderSchool();
  await claimMilestones();
}

/* ---------------- 彈窗 ---------------- */
function openModal(html) { $("modalPwBody").innerHTML = html; $("modalPw").classList.remove("hidden"); }
function showStory(id, fresh) {
  const L = LOC[id], R = READ_OF[id] || { title: L.title, text: "" };
  openModal(`<div class="pw-thumb ${fresh ? "pw-light-on" : ""}" style="aspect-ratio:4/3"><img src="images/power/${id}.webp" alt=""/></div>
    ${fresh ? `<p class="k-display text-xl text-[#C2410C] mt-3">點亮了！得到故事卡</p>` : ""}
    <p class="k-chip k-chip--yellow mt-3">${L.place}</p>
    <p class="k-display text-2xl mt-2">${R.title}</p>
    <p class="leading-8 font-medium mt-2">${escapeHtml(R.text)}</p>
    <p class="font-bold mt-3">小小的行動：<span class="text-[#C2410C]">${L.act}</span></p>
    <div class="text-right mt-5"><button onclick="closeModal('modalPw')" class="k-btn k-btn--yellow px-6 py-2">收下故事卡</button></div>`);
}

/* ---------------- 金幣 ---------------- */
function coinRoom() {
  if (P.dayKey !== todayKey()) { P.dayKey = todayKey(); P.dayCoins = 0; }
  return Math.max(0, POWER_DAILY_COIN_CAP - P.dayCoins);
}
function takeCoins(n) { const k = Math.min(n, coinRoom()); P.dayCoins += k; return k; }
async function claimMilestones() {
  const st = poolState();
  const got = [];
  for (let i = 0; i < st.lit; i++) if (!P.claimed.includes(i)) { P.claimed.push(i); got.push(i); }
  if (!got.length) return;
  const coins = got.length * POWER_COIN_MILESTONE;
  try { await savePower(coins); } catch (e) { reportError("儲存", e); return; }
  renderTop();
  openModal(`<p class="k-display text-2xl">全班點亮了新的地方！</p>
    <ul class="mt-3 space-y-2 font-bold">${got.map(i => `<li><span class="pw-flame align-middle"></span> 第 ${i + 1} 站「${POWER_SPOTS[i].name}」：${POWER_SPOTS[i].act}</li>`).join("")}</ul>
    <p class="mt-4 font-bold">全班一起的禮物：<span class="k-coin"></span> +${coins} 金幣</p>
    <div class="text-right mt-5"><button onclick="closeModal('modalPw')" class="k-btn k-btn--yellow px-6 py-2">太棒了</button></div>`);
}

/* ---------------- 點亮地點 ---------------- */
async function lightLoc(id) {
  if (BUSY) return;
  const L = LOC[id], cost = costOf(L);
  if (P.lit[id] || !regionOpen(L.r) || P.fire < cost) return;
  BUSY = true;
  const before = JSON.stringify(P);
  P.fire -= cost;
  P.lit[id] = Date.now();
  const coins = takeCoins(POWER_COIN_LIGHT);
  try {
    await savePower(coins);
    try { await writeClass({ e: { loc: id, t: Date.now() } }); } catch (e) { console.warn(e); }
  } catch (e) {
    P = normPower(JSON.parse(before)); STU.power = P;
    reportError("點亮地點", e); BUSY = false; return;
  }
  BUSY = false;
  const next = POWER_LOCS.find(x => !P.lit[x.id] && regionOpen(x.r));
  SEL = next ? next.id : id;
  renderAll();
  showStory(id, true);
  if (coins) $("modalPwBody").insertAdjacentHTML("beforeend", `<p class="text-sm font-bold text-[#5B6B78] mt-2">點亮地點：<span class="k-coin"></span> +${coins} 金幣</p>`);
}

/* ---------------- 行動任務（答題） ---------------- */
function pickQuestions() {
  const seen = new Set(P.seen);
  const pick = sub => {
    const pool = POWER_QUESTIONS.filter(q => q.sub === sub);
    const wrongs = pool.filter(q => (P.wrong[q.id] || 0) > 0);
    if (wrongs.length && Math.random() < .3) return wrongs[Math.floor(Math.random() * wrongs.length)];
    const fresh = pool.filter(q => !seen.has(q.id));
    const from = fresh.length ? fresh : pool;
    return from[Math.floor(Math.random() * from.length)];
  };
  const out = [];
  const subs = Math.random() < .5 ? ["zh", "math", "zh", "math", "zh"] : ["math", "zh", "math", "zh", "math"];
  for (const s of subs.slice(0, POWER_MISSION_LEN)) {
    let q, t = 0;
    do { q = pick(s); t++; } while (out.includes(q) && t < 20);
    out.push(q); seen.add(q.id);
  }
  return out;
}
function startMission() {
  MISSION = { qs: pickQuestions(), i: 0, right: 0, fire0: P.fire };
  $("viewGame").classList.add("hidden");
  $("viewMission").classList.remove("hidden");
  window.scrollTo(0, 0);
  showQuestion();
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function showQuestion() {
  const q = MISSION.qs[MISSION.i];
  MISSION.answered = false;
  $("mNo").textContent = MISSION.i + 1;
  $("mFire").textContent = P.fire;
  $("mSub").textContent = q.sub === "zh" ? "國語" : "數學";
  $("mSub").className = "k-chip " + (q.sub === "zh" ? "k-chip--chi" : "k-chip--math");
  $("mType").textContent = q.t;
  if (q.p) {
    $("mPassage").innerHTML = `<p class="k-display text-lg">閱讀短文：${escapeHtml(q.pt || "")}</p><p class="leading-8 font-medium mt-1">${escapeHtml(q.p)}</p>`;
    $("mPassage").classList.remove("hidden");
  } else $("mPassage").classList.add("hidden");
  $("mQ").textContent = q.q;
  const opts = shuffle([q.a, ...q.w]);
  $("mOpts").innerHTML = opts.map((o, k) => `<button class="k-opt" data-v="${escapeHtml(o)}" onclick="answer(this)"><span class="k-opt-key">${"ABCD"[k]}</span><span class="k-opt-txt">${escapeHtml(o)}</span></button>`).join("");
  $("mFeedback").classList.add("hidden");
  $("mNext").classList.add("hidden");
}
async function answer(btn) {
  if (!MISSION || MISSION.answered || BUSY) return;
  MISSION.answered = true;
  const q = MISSION.qs[MISSION.i];
  const ok = btn.dataset.v === q.a;
  document.querySelectorAll("#mOpts .k-opt").forEach(b => {
    b.disabled = true;
    if (b.dataset.v === q.a) b.classList.add("is-right");
  });
  if (!ok) btn.classList.add("is-wrong");
  // 更新個人紀錄
  P.ans += 1;
  if (q.sub === "zh") P.zhA += 1; else P.mA += 1;
  let df, dg;
  if (ok) {
    P.cor += 1; MISSION.right += 1;
    if (q.sub === "zh") P.zhC += 1; else P.mC += 1;
    if (q.t === "事實與觀點") P.factC += 1;
    if (q.t === "閱讀測驗") P.readC += 1;
    if (P.wrong[q.id]) { P.wrong[q.id] -= 1; if (P.wrong[q.id] <= 0) delete P.wrong[q.id]; }
    df = CFG.gain; dg = P.give < CFG.cap ? 1 : 0;
  } else {
    P.wrong[q.id] = (P.wrong[q.id] || 0) + 1;
    df = -Math.min(CFG.loss, P.fire); dg = P.give > 0 ? -1 : 0;
  }
  P.fire += df; P.give += dg;
  P.seen = P.seen.filter(x => x !== q.id).concat([q.id]).slice(-300);
  const tk = todayKey();
  const d0 = (CLS.d || {})[STU.id];
  const dayN = Math.max(0, (d0 && d0.k === tk ? Number(d0.n) || 0 : 0) + dg);
  $("mFire").textContent = P.fire;
  $("mFeedback").className = "mt-4 p-4 rounded-2xl border-[3px] border-[#1E2A33] pw-rise " + (ok ? "bg-[#DDF5E7]" : "bg-[#FFE3DE]");
  $("mFeedback").innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2">
      <b class="k-display text-xl">${ok ? "答對了！" : "再想想看："}</b>
      <span class="pw-delta ${ok ? "text-[#B45309]" : "text-[#C2410C]"}">${df >= 0 ? "+" : "−"}${Math.abs(df)} 火光${dg ? `・全班 ${dg > 0 ? "+1" : "−1"} 盞燈` : ""}</span></div>
    ${ok ? "" : `<p class="font-bold mt-1">正確答案：${escapeHtml(q.a)}</p>`}
    <p class="mt-1 font-medium">${escapeHtml(q.e || "")}</p>`;
  $("mFeedback").classList.remove("hidden");
  // 存檔（每題都存，答錯也會扣到）
  BUSY = true;
  try {
    STU.power = P;
    await saveGameData(STU, "power", 0);
    await writeClass({ c: P.give, d: { k: tk, n: dayN } });
  } catch (e) { reportError("儲存作答", e); }
  BUSY = false;
  $("mNext").textContent = MISSION.i + 1 >= MISSION.qs.length ? "完成任務" : "下一題";
  $("mNext").classList.remove("hidden");
  renderTop();
}
async function nextQuestion() {
  if (!MISSION || BUSY) return;
  MISSION.i += 1;
  if (MISSION.i < MISSION.qs.length) { showQuestion(); return; }
  // 任務完成
  P.missions += 1;
  const tk = todayKey();
  if (!P.days.includes(tk)) P.days = P.days.concat([tk]).slice(-30);
  const coins = takeCoins(POWER_COIN_MISSION);
  BUSY = true;
  try { await savePower(coins); } catch (e) { reportError("儲存", e); }
  BUSY = false;
  const gained = P.fire - MISSION.fire0, right = MISSION.right, len = MISSION.qs.length;
  MISSION = null;
  $("viewMission").classList.add("hidden");
  $("viewGame").classList.remove("hidden");
  try { await loadClass(); } catch (e) {}
  renderAll();
  const L = LOC[SEL];
  const canLight = L && !P.lit[L.id] && regionOpen(L.r) && P.fire >= costOf(L);
  openModal(`<p class="k-display text-2xl">行動任務完成！</p>
    <p class="font-bold mt-3">答對 ${right} / ${len} 題・火光 ${gained >= 0 ? "+" : "−"}${Math.abs(gained)}（現在 ${P.fire}）</p>
    <p class="font-bold mt-1">${coins ? `完成任務：<span class="k-coin"></span> +${coins} 金幣` : "今天的金幣已經拿滿了，火光還是會繼續累積。"}</p>
    ${canLight ? `<p class="font-bold mt-3 text-[#C2410C]">火光夠了！可以點亮「${L.title}」。</p>` : ""}
    <div class="flex justify-end gap-2 mt-5">
      ${canLight ? `<button onclick="closeModal('modalPw'); lightLoc('${L.id}')" class="k-btn k-btn--yellow px-5 py-2">點亮「${L.title}」</button>` : ""}
      <button onclick="closeModal('modalPw'); startMission()" class="k-btn ${canLight ? "bg-white" : "k-btn--yellow"} px-5 py-2">再一次任務</button>
      <button onclick="closeModal('modalPw')" class="k-btn bg-white px-5 py-2">看地圖</button>
    </div>`);
  await claimMilestones();
}
function quitMission() {
  if (BUSY) return;
  if (MISSION && MISSION.answered === false && MISSION.i > 0) { /* 已經作答的題目都存好了 */ }
  MISSION = null;
  $("viewMission").classList.add("hidden");
  $("viewGame").classList.remove("hidden");
  renderAll();
}

/* ---------------- 開始 ---------------- */
window.onPageReady = async () => {
  STU = await loadSessionStudentOrRedirect();
  if (!STU) return;
  $("viewLoading").classList.add("hidden");
  if (!isPowerOpen(STU)) { $("viewLocked").classList.remove("hidden"); return; }
  TEACHER = teacherOfStudent(STU.id);
  P = normPower(STU.power);
  STU.power = P;
  $("pwStuId").textContent = STU.id;
  $("pwStuName").textContent = STU.name || "";
  try { await loadClass(); } catch (e) { reportError("讀取全班進度", e); }
  await loadPool();
  // 全班資料裡的貢獻以自己的紀錄為準（例如老師重設全班進度後，從 0 開始）
  const rs = Number(((CLS.reset || {})[isTestAccount(STU.id) ? "t" : "s"])) || 0;
  if (rs > (Number(P.resetSeen) || 0)) {
    P.give = 0; P.claimed = []; P.resetSeen = rs;
    try { await savePower(0); } catch (e) {}
  }
  if (((CLS.c || {})[STU.id] || 0) !== P.give) { try { await writeClass({ c: P.give }); } catch (e) {} }
  $("viewGame").classList.remove("hidden");
  renderAll();
  await claimMilestones();
};
