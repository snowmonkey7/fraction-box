/* =========================================================
   高第的魔法建築｜遊戲程式
   學生進度存在學生資料的 gaudi 欄位，金幣和盲盒店共用
   ========================================================= */
let stu = null;      // 目前登入的學生
let G = null;        // stu.gaudi 的捷徑
let curBld = null;   // 目前所在的建築 id
let battle = null;   // 進行中的戰鬥（同時存在 G.active，重新整理也能接著打）
let pendingGuardian = null;
let teamPick = [];
let resultCallback = null;
let helpPage = 0;

const $ = id => document.getElementById(id);
const BLD = id => BUILDINGS.find(b => b.id === id);
const MON = id => WILD.find(m => m.id === id) || GUARDIANS.find(m => m.id === id);
const isGuardian = id => id.startsWith("g");
const HOUR = 3600 * 1000;

/* ================= 進度資料 ================= */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function ensureGaudi(s) {
  const g = (s.gaudi && typeof s.gaudi === "object") ? s.gaudi : {};
  const num = k => { g[k] = Number(g[k]) || 0; };
  ["answered", "correct", "dayCoins", "lockUntil", "lockCount"].forEach(num);
  const obj = k => { if (!g[k] || typeof g[k] !== "object" || Array.isArray(g[k])) g[k] = {}; };
  ["wrongCounts", "caught", "beaten", "everCaught", "hurt", "restUntil"].forEach(obj);
  if (!g.balls || typeof g.balls !== "object") g.balls = { n: 0, s: 0 };
  g.balls.n = Number(g.balls.n) || 0;
  g.balls.s = Number(g.balls.s) || 0;
  ["correctIds", "team", "wrongTimes", "logs"].forEach(k => { if (!Array.isArray(g[k])) g[k] = []; });
  // 舊進度：收服過的怪獸也記進圖鑑
  Object.keys(g.caught).forEach(id => { if (g.caught[id] > 0) g.everCaught[id] = true; });
  g.starterGiven = !!g.starterGiven;
  g.helpSeen = !!g.helpSeen;
  g.cleared = !!g.cleared;
  if (g.active && typeof g.active !== "object") g.active = null;
  if (g.dayKey !== todayKey()) { g.dayKey = todayKey(); g.dayCoins = 0; }
  s.gaudi = g;
  return g;
}

async function save(coinDelta = 0) {
  try {
    await saveGameData(stu, "gaudi", coinDelta);
  } catch (e) {
    reportError("存檔", e);
  }
}

// 依每日上限計算這次真正能拿到幾個金幣
function grantCoins(n) {
  if (G.dayKey !== todayKey()) { G.dayKey = todayKey(); G.dayCoins = 0; }
  const got = Math.min(n, Math.max(0, GAUDI_DAILY_COIN_CAP - G.dayCoins));
  G.dayCoins += got;
  return got;
}

/* ---------- 夥伴狀態 ---------- */
const everOwned = id => isGuardian(id) ? !!G.beaten[id] : !!G.everCaught[id];   // 圖鑑：曾經得到過
const countOf = id => isGuardian(id) ? (G.beaten[id] ? 1 : 0) : (G.caught[id] || 0);
const isResting = id => isGuardian(id) && (G.restUntil[id] || 0) > Date.now();
const heartsLeft = id => Math.max(0, maxHeartsOf(id) - (G.hurt[id] || 0));
const canFight = id => countOf(id) > 0 && !isResting(id);

function restText(id) {
  const mins = Math.max(1, Math.ceil(((G.restUntil[id] || 0) - Date.now()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `休息中，還要 ${h} 小時 ${m} 分` : `休息中，還要 ${m} 分`;
}

// 休息時間到了的守護精靈，愛心補滿
function refreshResting() {
  Object.keys(G.restUntil).forEach(id => {
    if (G.restUntil[id] && G.restUntil[id] <= Date.now()) { delete G.restUntil[id]; delete G.hurt[id]; }
  });
}

function heartsHtml(id, small) {
  const max = maxHeartsOf(id), left = heartsLeft(id);
  return `<span class="${small ? "text-sm" : ""} whitespace-nowrap">` + Array.from({ length: max }, (_, i) =>
    `<span class="k-heart ${small ? "k-heart--sm" : ""} ${i < left ? "" : "is-empty"}">♥</span>`).join("") + "</span>";
}

/* ---------- 開放條件 ---------- */
const progressUnlocked = i => i === 0 || !!G.beaten[BUILDINGS[i - 1].guardians[2]];
const teacherOpened = i => i < getGaudiOpen(stu);   // 老師在教師端設定開放到第幾棟
const bldUnlocked = i => teacherOpened(i) && progressUnlocked(i);
const bldIndex = id => BUILDINGS.findIndex(b => b.id === id);
const caughtKinds = bId => WILD.filter(m => m.b === bId && G.everCaught[m.id]).length;

/* ================= 開始 ================= */
window.onPageReady = async () => {
  document.querySelectorAll(".jsDailyCap").forEach(e => (e.textContent = GAUDI_DAILY_COIN_CAP));
  document.querySelectorAll(".jsPriceN").forEach(e => (e.textContent = BALL_PRICE.n));
  document.querySelectorAll(".jsPriceS").forEach(e => (e.textContent = BALL_PRICE.s));
  document.querySelectorAll(".jsGuessLimit").forEach(e => (e.textContent = GUESS_WRONG_LIMIT));
  document.querySelectorAll(".jsRestHours").forEach(e => (e.textContent = GUARDIAN_REST_HOURS));
  document.querySelectorAll(".jsCap").forEach(e => (e.textContent = GAUDI_DAILY_COIN_CAP));
  const s = await loadSessionStudentOrRedirect();
  if (!s) return;
  stu = s;
  if (getGaudiOpen(stu) < 1) {
    showResult({ title: "老師還沒開放", text: "這個遊戲還沒開放給你，先去玩分數盲盒店吧！" }, gBackToMenu);
    return;
  }
  G = ensureGaudi(stu);
  refreshResting();
  $("viewGame").classList.remove("hidden");
  $("gStuId").textContent = stu.id;
  $("gStuName").textContent = stu.name || "";
  renderAll();

  if (G.active) {                 // 上一場戰鬥還沒打完：接著打
    resumeBattle();
  } else if (!G.helpSeen) {       // 第一次來：先看遊戲說明
    openHelp(true);
  }
  if (G.lockUntil > Date.now()) showGuessLock();
};

async function giveStarterIfNeeded() {
  if (G.starterGiven) return;
  G.starterGiven = true;
  G.balls.n += STARTER_BALLS;
  await save();
  renderStatus();
  showResult({
    title: "送你寶貝球！",
    text: `送你 ${STARTER_BALLS} 顆普通球。先到「米拉之家」出發探索，收服第一隻怪獸吧！`
  });
}

function renderAll() {
  renderStatus();
  renderMap();
  if (curBld) renderBuilding();
}

function renderStatus() {
  $("gCoins").textContent = stu.coins || 0;
  $("shopCoins").textContent = stu.coins || 0;
  $("gAnswered").textContent = G.answered;
  $("gCorrect").textContent = G.correct;
  $("gAcc").textContent = (G.answered ? Math.round(G.correct / G.answered * 100) : 0) + "%";
  $("gBallN").textContent = G.balls.n;
  $("gBallS").textContent = G.balls.s;
  $("gDayCoins").textContent = G.dayCoins;
  $("gCaughtCount").textContent = WILD.filter(m => G.everCaught[m.id]).length;
}

function gTab(name) {
  ["map", "team", "shop", "rank"].forEach(t => {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    $("gPane" + cap).classList.toggle("hidden", t !== name);
    $("gTab" + cap).classList.toggle("is-active", t === name);
  });
  if (name === "team") { refreshResting(); renderDex(); }
  if (name === "rank") renderRank();
  if (name === "shop") renderStatus();
}

/* ================= 遊戲說明 ================= */
const HELP_PAGES = [
  {
    title: "照課文的順序走",
    art: () => `<div class="flex justify-center gap-1">${["mila", "batllo", "guell", "sagrada"].map(b => `<div class="w-16">${BUILDING_ART[b]}</div>`).join("")}</div>`,
    text: "四棟建築照課文順序開放。打敗一棟的 3 隻守護精靈，下一棟才會打開。"
  },
  {
    title: "探索：讓怪獸變虛弱",
    art: () => `<div class="w-28 mx-auto k-mon-img border-[3px] border-[#1E2A33]"><img src="${monsterImg("w13")}" alt="" /></div>`,
    text: "在建築裡按「出發探索」會遇到野生怪獸。答對題目讓牠變虛弱；答錯 3 次牠就逃走了。"
  },
  {
    title: "虛弱後，三選一",
    art: () => `
      <table class="mx-auto text-sm font-bold border-collapse">
        <tr><th></th><th class="px-2">普通</th><th class="px-2">稀有</th><th class="px-2">傳說</th></tr>
        <tr><td class="pr-2 text-left"><span class="k-ball align-middle"></span> 初級捕捉</td><td>${pct(RARITY[0].catchN)}</td><td>${pct(RARITY[1].catchN)}</td><td class="text-[#C23A26]">抓不到</td></tr>
        <tr><td class="pr-2 text-left"><span class="k-ball is-super align-middle"></span> 高級捕捉</td><td>${pct(RARITY[0].catchS)}</td><td>${pct(RARITY[1].catchS)}</td><td>${pct(RARITY[2].catchS)}</td></tr>
        <tr><td class="pr-2 text-left">擊敗牠</td><td>${RARITY[0].defeatCoins} 金幣</td><td>${RARITY[1].defeatCoins} 金幣</td><td>${RARITY[2].defeatCoins} 金幣</td></tr>
      </table>`,
    text: "傳說怪獸只有「高級捕捉」抓得到！不想抓的話，可以擊敗牠換金幣。"
  },
  {
    title: "挑戰守護精靈",
    art: () => `<div class="w-28 mx-auto k-mon-img border-[3px] border-[#1E2A33]"><img src="${monsterImg("g12")}" alt="" /></div>`,
    text: "先收服這棟的 2、3、4 種怪獸，才能挑戰第 1、2、3 隻守護精靈。帶 2 隻夥伴出戰，答對就攻擊。越後面的建築越強！"
  },
  {
    title: "小心！答錯夥伴會受傷",
    art: () => `<div class="text-center"><span class="k-heart">♥</span><span class="k-heart">♥</span><span class="k-heart is-empty">♥</span></div>`,
    text: `答錯時，站在前面的夥伴少 1 顆愛心，戰鬥結束也不會回來。怪獸的愛心沒了會永遠消失；守護精靈要休息 ${GUARDIAN_REST_HOURS} 小時。不要亂猜！`
  },
  {
    title: "金幣和商店",
    art: () => `<div class="text-center"><span class="k-coin text-4xl"></span></div>`,
    text: `答對 1 題得 1 金幣，第一次打敗守護精靈多 5 金幣，擊敗怪獸也有金幣。每天最多 ${GAUDI_DAILY_COIN_CAP} 金幣，可以到商店買寶貝球。`
  }
];
const pct = x => Math.round(x * 100) + "%";

function openHelp(first) {
  helpPage = 0;
  $("modalHelp").dataset.first = first ? "1" : "";
  renderHelp();
  $("modalHelp").classList.remove("hidden");
}
function renderHelp() {
  const p = HELP_PAGES[helpPage];
  $("helpArt").innerHTML = p.art();
  $("helpTitle").textContent = p.title;
  $("helpText").textContent = p.text;
  $("helpDots").innerHTML = HELP_PAGES.map((_, i) =>
    `<span class="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#1E2A33] ${i === helpPage ? "bg-[#FFC83D]" : "bg-white"}"></span>`).join("");
  $("helpPrev").style.visibility = helpPage === 0 ? "hidden" : "";
  $("helpNext").textContent = helpPage === HELP_PAGES.length - 1 ? "開始玩！" : "下一頁";
}
async function helpStep(d) {
  helpPage += d;
  if (helpPage >= HELP_PAGES.length) {
    closeModal("modalHelp");
    if (!G.helpSeen) { G.helpSeen = true; await save(); }
    await giveStarterIfNeeded();
    return;
  }
  helpPage = Math.max(0, helpPage);
  renderHelp();
}

/* ================= 地圖 ================= */
function renderMap() {
  $("mapGrid").innerHTML = BUILDINGS.map((b, i) => {
    const open = bldUnlocked(i);
    const beatenN = b.guardians.filter(g => G.beaten[g]).length;
    const done = beatenN === 3;
    const cls = !open ? "is-locked" : (done ? "is-done" : "");
    const status = !open
      ? `<span class="k-chip mt-2">${teacherOpened(i) ? "還沒開放" : "老師還沒開放"}</span>`
      : `<span class="k-chip ${done ? "k-chip--yellow" : "k-chip--chi"} mt-2">${done ? "完成！" : `精靈 ${beatenN}/3・怪獸 ${caughtKinds(b.id)}/5`}</span>`;
    return `
      <button class="k-bld ${cls}" onclick="enterBuilding('${b.id}')" aria-label="${b.name}${open ? "" : "（還沒開放）"}">
        <span class="k-bld-step">${i + 1}</span>
        <span class="k-bld-tier">${"★".repeat(b.tier)}</span>
        ${BUILDING_ART[b.id]}
        <span class="k-display text-xl mt-1">${b.name}</span>
        ${status}
      </button>`;
  }).join("");
}

function enterBuilding(id) {
  const i = bldIndex(id);
  if (!teacherOpened(i)) {
    showResult({ title: "老師還沒開放這裡", text: "等老師上完這段課文，就會開放囉！" });
    return;
  }
  if (!progressUnlocked(i)) {
    showResult({ title: "這裡還沒開放", text: `先打敗「${BUILDINGS[i - 1].name}」的 3 隻守護精靈，才能來這裡喔！` });
    return;
  }
  curBld = id;
  $("mapView").classList.add("hidden");
  $("buildingView").classList.remove("hidden");
  renderBuilding();
  window.scrollTo({ top: 0 });
}

function gShowMap() {
  curBld = null;
  $("buildingView").classList.add("hidden");
  $("mapView").classList.remove("hidden");
  renderMap();
}

// 圖鑑小卡：沒得到過→剪影；得到過但都消失了→淡淡的
function monCard(id) {
  const m = MON(id);
  const seen = everOwned(id);
  const n = countOf(id);
  const gone = seen && n === 0;
  let sub = "";
  if (seen && !isGuardian(id)) sub = n > 0 ? heartsHtml(id, true) : `<span class="text-[11px] font-bold text-[#8C9AA6]">都消失了</span>`;
  if (seen && isGuardian(id)) sub = isResting(id) ? `<span class="text-[11px] font-bold text-[#C23A26]">休息中</span>` : heartsHtml(id, true);
  const cnt = !isGuardian(id) && n > 1 ? `<span class="k-toy-count">×${n}</span>` : "";
  const tag = seen ? "button" : "div";
  return `
    <${tag} class="text-center block w-full ${seen ? "k-mon-card" : ""}" ${seen ? `onclick="openMonInfo('${id}')" aria-label="看${m.name}的資料"` : ""}>
      <div class="k-mon-img border-[2.5px] border-[#1E2A33] relative ${gone || isResting(id) ? "opacity-40" : ""}">
        <img src="${seen ? monsterImg(id) : silhouetteImg(id)}" alt="${seen ? m.name : "還沒收服"}" loading="lazy" />${cnt}
      </div>
      <div class="text-xs font-bold mt-1 leading-tight ${seen ? "" : "text-[#8C9AA6]"}">${seen ? m.name : "？？？"}</div>
      <div class="leading-none mt-0.5">${sub}</div>
    </${tag}>`;
}

/* ---------- 點夥伴：放大看資料 ---------- */
function openMonInfo(id) {
  if (!everOwned(id)) return;
  refreshResting();
  const m = MON(id), guard = isGuardian(id), n = countOf(id);
  const b = BLD(m.b);
  const kind = guard ? "守護精靈" : `${RARITY[m.rarity].name}怪獸`;
  const kindColor = guard ? "#E0A21B" : ["#8FA3B3", "#4A90E2", "#B455D6"][m.rarity];
  let status;
  if (n === 0) status = `<span class="text-[#8C9AA6]">都消失了，再去${b.name}探索就有機會遇到</span>`;
  else if (isResting(id)) status = `<span class="text-[#C23A26]">${restText(id)}</span>`;
  else status = `<span class="text-[#2E9E6A]">可以出戰</span>`;
  const skill = guard
    ? `<b>${SKILLS[m.skill].name}</b><div class="text-sm text-[#5B6B78] mt-0.5">${SKILLS[m.skill].desc}（每場戰鬥可以用一次）</div>`
    : `<span class="text-[#5B6B78]">沒有招式</span><div class="text-xs text-[#8C9AA6] mt-0.5">只有打敗守護精靈得到的夥伴才有招式。</div>`;
  const row = (k, v) => `<div class="flex gap-3 py-2 border-t-2 border-dashed border-[#E3E8ED]"><div class="w-16 shrink-0 font-black text-[#5B6B78]">${k}</div><div class="flex-1 font-bold">${v}</div></div>`;
  $("monInfoBody").innerHTML = `
    <div class="k-mon-img mon-zoom border-[3px] border-[#1E2A33] mx-auto" style="width:min(260px,70vw)"><img src="${monsterImg(id)}" alt="${m.name}"/></div>
    <h3 class="k-display text-3xl mt-3">${m.name}</h3>
    <div class="mt-1"><span class="k-chip" style="background:${kindColor};color:#fff">${kind}</span>
      <span class="k-chip">${b.name} ${"★".repeat(b.tier)}</span></div>
    <div class="text-left mt-4">
      ${row("血量", n ? `${heartsHtml(id)} <span class="ml-1">${heartsLeft(id)} / ${maxHeartsOf(id)} 顆愛心</span>` : `<span class="text-[#8C9AA6]">滿血時有 ${maxHeartsOf(id)} 顆愛心</span>`)}
      ${row("攻擊", `每答對一題攻擊 <b>${attackOf(id)}</b> 點`)}
      ${row("招式", skill)}
      ${!guard ? row("數量", `${n} 隻`) : ""}
      ${row("狀態", status)}
    </div>`;
  $("modalMonInfo").classList.remove("hidden");
}

function renderBuilding() {
  const b = BLD(curBld);
  $("bvArt").innerHTML = BUILDING_ART[b.id];
  $("bvName").textContent = b.name;
  $("bvSub").textContent = b.sub + "　" + "★".repeat(b.tier);
  const beatenN = b.guardians.filter(g => G.beaten[g]).length;
  $("bvProgress").textContent = `守護精靈 ${beatenN} / 3`;
  $("bvWild").innerHTML = WILD.filter(m => m.b === b.id).map(m => monCard(m.id)).join("");
  $("bvCaughtKinds").textContent = caughtKinds(b.id);
  const kinds = caughtKinds(b.id);
  $("bvGuards").innerHTML = b.guardians.map((gid, j) => {
    const g = MON(gid);
    const beaten = !!G.beaten[gid];
    const prevOk = j === 0 || G.beaten[b.guardians[j - 1]];
    const enough = kinds >= CAUGHT_NEEDED[j];
    let btn, note;
    if (!prevOk) { btn = `<span class="k-chip">先打敗前一隻</span>`; note = `需要收服 ${CAUGHT_NEEDED[j]} 種怪獸`; }
    else if (!enough) { btn = `<span class="k-chip">還不能挑戰</span>`; note = `先收服這棟 ${CAUGHT_NEEDED[j]} 種怪獸（現在 ${kinds} 種）`; }
    else if (beaten) { btn = `<button onclick="startGuardian('${gid}')" class="k-btn k-btn--sm">再打一次</button>`; note = `已打敗・招式：${SKILLS[g.skill].name}`; }
    else { btn = `<button onclick="startGuardian('${gid}')" class="k-btn k-btn--tomato px-4 py-2">挑戰</button>`; note = `血量 ${g.hp}`; }
    const showReal = beaten || prevOk;
    return `
      <div class="flex flex-wrap items-center gap-3 p-2 rounded-2xl border-2 ${beaten ? "border-[#1E2A33] bg-[#FFF4CC]" : "border-dashed border-[#9AA8B4] bg-white"}">
        <div class="w-16 shrink-0 k-mon-img border-[2.5px] border-[#1E2A33]"><img src="${showReal ? monsterImg(gid) : silhouetteImg(gid)}" alt="" loading="lazy" /></div>
        <div class="flex-1 min-w-0">
          <div class="k-display text-lg leading-tight">${showReal ? g.name : "？？？"}${g.final ? ' <span class="k-chip k-chip--yellow">最終魔王</span>' : ""}</div>
          <div class="text-xs font-bold text-[#5B6B78] mt-0.5">${note}</div>
        </div>
        ${btn}
      </div>`;
  }).join("");
}

/* ================= 我的夥伴 ================= */
function renderDex() {
  renderTeamNow();
  $("dexList").innerHTML = BUILDINGS.map((b, i) => `
    <div>
      <h4 class="k-display text-lg mb-2">${i + 1}. ${b.name} <span class="text-sm text-[#5B6B78]">${"★".repeat(b.tier)}</span></h4>
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
        ${WILD.filter(m => m.b === b.id).map(m => monCard(m.id)).join("")}
        ${b.guardians.map(g => monCard(g)).join("")}
      </div>
    </div>`).join("");
}

function renderTeamNow() {
  const team = G.team.filter(canFight);
  $("teamNow").innerHTML = team.length
    ? team.map(id => `<span class="k-chip k-chip--yellow">${MON(id).name}</span>`).join("")
    : `<span class="k-chip">還沒選</span>`;
}

function memberLabel(id) {
  const r = isGuardian(id) ? "守護精靈" : RARITY[MON(id).rarity].name;
  return `${r}・攻擊 ${attackOf(id)}`;
}

function openTeamPicker(guardianId) {
  refreshResting();
  pendingGuardian = guardianId;
  const all = [...WILD, ...GUARDIANS].map(m => m.id).filter(id => countOf(id) > 0);
  const ready = all.filter(canFight);
  if (ready.length === 0) {
    showResult({ title: "沒有可以出戰的夥伴", text: all.length ? "你的守護精靈都在休息，先去探索收服怪獸吧。" : "先到建築裡「出發探索」，收服怪獸當夥伴。" });
    return;
  }
  teamPick = G.team.filter(canFight).slice(0, 2);
  if (teamPick.length === 0) teamPick = ready.slice(0, 2);
  $("btnTeamGo").textContent = guardianId ? "出戰" : "決定";
  $("teamHint").textContent = guardianId
    ? `對手：${MON(guardianId).name}（血量 ${MON(guardianId).hp}）。先選的夥伴站前面，答錯時前面的先受傷。`
    : "先選的夥伴站前面，答錯時前面的先受傷。";
  renderTeamPick();
  $("modalTeam").classList.remove("hidden");
}

function renderTeamPick() {
  const all = [...WILD, ...GUARDIANS].map(m => m.id).filter(id => countOf(id) > 0);
  $("teamPickGrid").innerHTML = all.map(id => {
    const idx = teamPick.indexOf(id);
    const ok = canFight(id);
    return `
      <button ${ok ? `onclick="toggleTeam('${id}')"` : "disabled"} class="relative text-center rounded-2xl p-1.5 border-[3px] ${idx >= 0 ? "border-[#1E2A33] bg-[#FFC83D]" : "border-transparent"} ${ok ? "" : "opacity-40"}">
        ${idx >= 0 ? `<span class="absolute -top-1 -left-1 z-10 k-chip k-chip--yellow">${idx === 0 ? "前" : "後"}</span>` : ""}
        <div class="k-mon-img border-[2.5px] border-[#1E2A33]"><img src="${monsterImg(id)}" alt="" /></div>
        <div class="text-sm font-bold mt-1 leading-tight">${MON(id).name}${!isGuardian(id) && countOf(id) > 1 ? " ×" + countOf(id) : ""}</div>
        <div class="leading-none">${ok ? heartsHtml(id, true) : ""}</div>
        <div class="text-[11px] font-bold text-[#5B6B78] leading-tight">${ok ? memberLabel(id) : restText(id)}</div>
      </button>`;
  }).join("");
}

function toggleTeam(id) {
  if (teamPick.includes(id)) teamPick = teamPick.filter(x => x !== id);
  else {
    if (teamPick.length >= 2) teamPick.shift();
    teamPick.push(id);
  }
  renderTeamPick();
}

async function confirmTeam() {
  if (teamPick.length === 0) { showResult({ title: "至少選 1 隻", text: "點一下夥伴的圖片就能選。" }); return; }
  G.team = teamPick.slice(0, 2);
  closeModal("modalTeam");
  renderTeamNow();
  if (pendingGuardian) beginGuardianBattle(pendingGuardian);
  else await save();
}

/* ================= 商店 ================= */
async function buyBall(kind) {
  const price = BALL_PRICE[kind];
  if ((stu.coins || 0) < price) {
    showResult({ title: "金幣不夠", text: `需要 ${price} 金幣，你現在有 ${stu.coins || 0} 金幣。多答對幾題就能賺到！` });
    return;
  }
  G.balls[kind] += 1;
  await save(-price);
  renderStatus();
  showResult({ title: "買好了！", text: `${kind === "n" ? "普通球" : "超級球"} +1（剩 ${stu.coins} 金幣）` });
}

/* ================= 排行榜 ================= */
async function renderRank() {
  $("rankCount").innerHTML = $("rankAcc").innerHTML = `<li class="text-sm font-bold text-[#5B6B78]">讀取中…</li>`;
  let list;
  try {
    list = await fetchAllStudents();
  } catch (e) { reportError("讀取排行榜", e); return; }
  const rows = list.filter(s => !isTestAccount(s.id) && sameClass(s.id, stu.id)).map(s => {   // 只排同班同學
    const g = s.gaudi || {};
    const a = Number(g.answered) || 0, c = Number(g.correct) || 0;
    return { id: s.id, name: s.name, a, c, acc: a ? c / a : 0 };
  });
  const li = (r, i, val) => `
    <li class="flex items-center gap-3 px-3 py-2 rounded-xl border-2 ${r.id === stu.id ? "border-[#1E2A33] bg-[#FFF4CC]" : "border-[#DCE7F2] bg-white"}">
      <span class="k-display w-7 text-center text-lg">${i + 1}</span>
      <span class="flex-1 font-bold">${escapeHtml(r.name)}</span>
      <span class="k-display">${val}</span>
    </li>`;
  const byCount = rows.filter(r => r.c > 0).sort((x, y) => y.c - x.c || y.acc - x.acc).slice(0, 10);
  const byAcc = rows.filter(r => r.a >= 20).sort((x, y) => y.acc - x.acc || y.a - x.a).slice(0, 10);
  $("rankCount").innerHTML = byCount.length ? byCount.map((r, i) => li(r, i, r.c + " 題")).join("") : `<li class="text-sm font-bold text-[#5B6B78]">還沒有人答對。</li>`;
  $("rankAcc").innerHTML = byAcc.length ? byAcc.map((r, i) => li(r, i, Math.round(r.acc * 100) + "%")).join("") : `<li class="text-sm font-bold text-[#5B6B78]">還沒有人答滿 20 題。</li>`;
}

/* ================= 出題 ================= */
function pickQuestion(bId) {
  let pool = bId === "all" ? GAUDI_QUESTIONS : GAUDI_QUESTIONS.filter(q => q.b === bId);
  const fresh = pool.filter(q => !battle.asked.includes(q.id));
  if (fresh.length) pool = fresh;
  // 優先出還沒答對過的題目
  const notYet = pool.filter(q => !G.correctIds.includes(q.id));
  const src = notYet.length ? notYet : pool;
  return pickByFamily(src);
}
// 先依「題型大類」抽，再從那一類裡抽一題，避免字音字形題出現太多次
const Q_FAMILY = { "生字注音": "zi", "生字": "zi", "形近字": "zi", "用字": "zi", "多音字": "zi", "字義": "zi", "部首": "zi",
  "語詞": "ci", "選詞填空": "ci", "成語": "cheng", "課文內容": "ke", "修辭": "xiu", "句型": "xiu",
  "閱讀測驗": "yue", "素養題": "su", "國學常識": "guo" };
const FAMILY_W = { zi: 3, ci: 2, cheng: 1, ke: 2, xiu: 1.2, yue: 1, su: 0.8, guo: 0.5 };
function pickByFamily(list) {
  const groups = {};
  list.forEach(q => { const f = Q_FAMILY[q.t] || "other"; (groups[f] = groups[f] || []).push(q); });
  const fams = Object.keys(groups);
  let x = Math.random() * fams.reduce((s, f) => s + (FAMILY_W[f] || 1), 0);
  for (const f of fams) { x -= FAMILY_W[f] || 1; if (x <= 0) return groups[f][Math.floor(Math.random() * groups[f].length)]; }
  const last = groups[fams[fams.length - 1]];
  return last[Math.floor(Math.random() * last.length)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// keepCurrent：接著打的時候，出同一題（不能靠重新整理換題目）
function showQuestion(keepCurrent) {
  let q = keepCurrent && battle.qid ? GAUDI_QUESTIONS.find(x => x.id === battle.qid) : null;
  if (!q) {
    q = pickQuestion(battle.pool);
    battle.qid = q.id;
    battle.asked.push(q.id);
    battle.asked = battle.asked.slice(-60);
  }
  battle.q = q;
  battle.answered = false;
  if (q.p && PASSAGES[q.p]) {
    $("qPassage").classList.remove("hidden");
    $("qPassageTitle").textContent = "〈" + PASSAGES[q.p].title + "〉";
    $("qPassageText").textContent = PASSAGES[q.p].text;
  } else {
    $("qPassage").classList.add("hidden");
  }
  $("gqType").textContent = q.t;
  $("gqText").textContent = q.q;
  const opts = shuffle([q.a, ...q.w]);
  $("gqOpts").innerHTML = opts.map((o, i) => `
    <button class="k-opt gq-opt" data-ok="${o === q.a ? 1 : 0}" onclick="answer(this)">
      <span class="k-opt-key">${"ABCD"[i]}</span><span class="k-opt-txt">${escapeHtml(o)}</span>
    </button>`).join("");
  $("gqFeedback").classList.add("hidden");
  $("qArea").classList.remove("hidden");
  $("weakArea").classList.add("hidden");
  renderBattleSide();
  if (!keepCurrent) { syncActive(); save(); }   // 記住這一題：重新整理也不能換題
}

/* ================= 戰鬥 ================= */
// 存一份戰鬥狀態，重新整理或關掉網頁後可以接著打
function syncActive() {
  const b = battle;
  G.active = b ? {
    kind: b.kind, foe: b.foe.id, hp: b.hp, maxHp: b.maxHp, wrong: b.wrong || 0, canThrow: !!b.canThrow,
    team: b.team || [], used: b.used || {}, shield: !!b.shield, power: !!b.power,
    pool: b.pool, asked: b.asked, qid: b.answered ? null : b.qid, bld: curBld
  } : null;
}

function openBattle() {
  $("battle").classList.remove("hidden");
  $("battle").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
async function closeBattle() {
  battle = null;
  G.active = null;
  $("battle").classList.add("hidden");
  document.body.style.overflow = "";
  await save();
  renderAll();
}

function setFoeHeader() {
  const f = battle.foe;
  $("foeImg").src = monsterImg(f.id);
  $("foeName").textContent = f.name;
  if (battle.kind === "wild") {
    $("foeTag").textContent = RARITY[f.rarity].name + "・" + "★".repeat(tierOf(f.b)) + (G.everCaught[f.id] ? "" : "・新怪獸");
    $("foeTag").className = "k-chip " + (f.rarity === 2 ? "k-chip--yellow" : f.rarity === 1 ? "k-chip--math" : "");
  } else {
    $("foeTag").textContent = f.final ? "最終魔王" : "守護精靈・" + "★".repeat(tierOf(f.b));
    $("foeTag").className = "k-chip k-chip--yellow";
  }
}

async function startWild() {
  if (G.lockUntil > Date.now()) { showGuessLock(); return; }
  const pool = WILD.filter(m => m.b === curBld);
  let r = Math.random(), mon = pool[0];
  for (const m of pool) { r -= RARITY[m.rarity].chance; if (r < 0) { mon = m; break; } }
  const hp = WEAKEN_HITS[tierOf(mon.b)][mon.rarity];
  battle = { kind: "wild", foe: mon, hp, maxHp: hp, wrong: 0, pool: curBld, asked: [], canThrow: false };
  setFoeHeader();
  openBattle();
  showQuestion();
}

function startGuardian(gid) {
  if (G.lockUntil > Date.now()) { showGuessLock(); return; }
  const g = MON(gid), b = BLD(g.b), j = b.guardians.indexOf(gid);
  if (!bldUnlocked(bldIndex(b.id))) return;
  if (j > 0 && !G.beaten[b.guardians[j - 1]]) { showResult({ title: "還不能挑戰", text: "先打敗前一隻守護精靈。" }); return; }
  if (caughtKinds(b.id) < CAUGHT_NEEDED[j]) {
    showResult({ title: "還不能挑戰", text: `先收服「${b.name}」的 ${CAUGHT_NEEDED[j]} 種怪獸（現在 ${caughtKinds(b.id)} 種）。` });
    return;
  }
  openTeamPicker(gid);
}

async function beginGuardianBattle(gid) {
  const g = MON(gid);
  const team = G.team.filter(canFight).slice(0, 2);
  battle = {
    kind: "guard", foe: g, hp: g.hp, maxHp: g.hp, team,
    used: {}, shield: false, power: false, pool: g.final ? "all" : g.b, asked: []
  };
  setFoeHeader();
  openBattle();
  showQuestion();
}

function resumeBattle() {
  const a = G.active;
  const foe = MON(a.foe);
  if (!foe) { G.active = null; return; }
  curBld = a.bld || foe.b;
  battle = {
    kind: a.kind, foe, hp: a.hp, maxHp: a.maxHp, wrong: a.wrong || 0, canThrow: !!a.canThrow,
    team: (a.team || []).filter(id => countOf(id) > 0 && !isResting(id)),
    used: a.used || {}, shield: !!a.shield, power: !!a.power,
    pool: a.pool || foe.b, asked: Array.isArray(a.asked) ? a.asked : [], qid: a.qid
  };
  if (battle.kind === "guard" && battle.team.length === 0) {   // 夥伴已經都倒下
    G.active = null; battle = null; save(); return;
  }
  setFoeHeader();
  openBattle();
  if (battle.kind === "wild" && battle.canThrow) showWeakened();
  else showQuestion(true);
  showResult({ title: "接著打！", text: "上一場戰鬥還沒結束，從剛剛的地方繼續。" });
}

const aliveTeam = () => battle.team.filter(id => countOf(id) > 0 && !isResting(id) && heartsLeft(id) > 0);

function damagePerHit() {
  let d = BASE_DAMAGE + aliveTeam().reduce((sum, id) => sum + attackOf(id), 0);
  if (battle.power) d *= 2;
  return d;
}

function renderBattleSide() {
  const b = battle;
  const pct2 = Math.max(0, b.hp / b.maxHp * 100);
  $("foeHp").style.width = pct2 + "%";
  $("foeHp").classList.toggle("is-low", pct2 <= 34);

  if (b.kind === "wild") {
    $("foeHpText").textContent = b.hp > 0 ? `再答對 ${b.hp} 題，牠就會變虛弱` : "牠變虛弱了！";
    $("myHearts").innerHTML = `<span class="text-sm font-bold">牠想逃跑：</span>` +
      [0, 1, 2].map(i => `<span class="k-heart ${i < b.wrong ? "" : "is-empty"}" style="color:${i < b.wrong ? "#8A63D2" : ""}">●</span>`).join("");
    $("myTeam").innerHTML = "";
    $("battleHint").textContent = b.canThrow ? "選一個做法：" : "答錯 3 次牠就會逃走。";
  } else {
    $("foeHpText").textContent = `血量 ${Math.max(0, b.hp)} / ${b.maxHp}`;
    $("myHearts").innerHTML =
      (b.shield ? `<span class="k-chip k-chip--math">護盾中</span>` : "") +
      (b.power ? `<span class="k-chip k-chip--yellow">下一擊×2</span>` : "");
    const alive = aliveTeam();
    $("myTeam").innerHTML = b.team.map((id, i) => {
      const m = MON(id);
      const up = alive.includes(id);
      const skill = isGuardian(id) ? m.skill : null;
      const front = up && alive[0] === id;
      return `
        <div class="flex items-center gap-2 border-2 border-[#1E2A33] rounded-xl p-1.5 pr-2 ${up ? "bg-white" : "bg-[#EEF2F6] opacity-50"}">
          <div class="w-11 k-mon-img"><img src="${monsterImg(id)}" alt="" /></div>
          <div class="leading-tight">
            <div class="text-sm font-bold">${m.name}${front ? ' <span class="text-[10px] k-chip k-chip--yellow">前</span>' : ""}</div>
            <div class="leading-none">${up ? heartsHtml(id, true) : '<span class="text-[11px] font-bold">倒下了</span>'}</div>
            ${skill && up ? `<button onclick="useSkill('${id}')" class="k-skill k-btn k-btn--sm mt-1 ${b.used[id] ? "is-used" : ""}" title="${SKILLS[skill].desc}">${SKILLS[skill].name}</button>` : ""}
          </div>
        </div>`;
    }).join("");
    $("battleHint").textContent = `每答對一題攻擊 ${damagePerHit()} 點；答錯時，站在前面的夥伴少 1 顆愛心。`;
  }
}

async function useSkill(id) {
  const b = battle;
  if (!b || b.used[id] || heartsLeft(id) <= 0) return;
  const skill = MON(id).skill;
  if (skill === "cut") {
    if (b.answered) { showResult({ title: "現在不能用", text: "等下一題出來再用吧！" }); return; }
    const wrongs = [...document.querySelectorAll(".gq-opt[data-ok='0']:not(.is-cut)")];
    if (!wrongs.length) return;
    wrongs[Math.floor(Math.random() * wrongs.length)].classList.add("is-cut");
  } else if (skill === "shield") {
    b.shield = true;
  } else if (skill === "power") {
    b.power = true;
  } else if (skill === "heal") {
    const hurtOnes = aliveTeam().filter(x => (G.hurt[x] || 0) > 0).sort((x, y) => heartsLeft(x) - heartsLeft(y));
    if (!hurtOnes.length) { showResult({ title: "大家的愛心都是滿的", text: "等有夥伴受傷再用吧！" }); return; }
    G.hurt[hurtOnes[0]] -= 1;
    if (G.hurt[hurtOnes[0]] <= 0) delete G.hurt[hurtOnes[0]];
  }
  b.used[id] = true;
  renderBattleSide();
  syncActive();
  await save();
}

// 前面的夥伴受傷；愛心扣完：怪獸消失一隻，守護精靈去休息
function hurtFront() {
  const front = aliveTeam()[0];
  if (!front) return "";
  G.hurt[front] = (G.hurt[front] || 0) + 1;
  const name = MON(front).name;
  if (heartsLeft(front) > 0) return `${name} 少了 1 顆愛心。`;
  delete G.hurt[front];
  if (isGuardian(front)) {
    G.restUntil[front] = Date.now() + GUARDIAN_REST_HOURS * HOUR;
    return `${name} 倒下了，要休息 ${GUARDIAN_REST_HOURS} 小時才能再出戰。`;
  }
  G.caught[front] = Math.max(0, (G.caught[front] || 0) - 1);
  if (!G.caught[front]) G.team = G.team.filter(x => x !== front);
  return `${name} 倒下了，永遠離開了你…`;
}

/* ================= 作答 ================= */
async function answer(btn) {
  const b = battle;
  if (!b || b.answered) return;
  if (G.lockUntil > Date.now()) { showGuessLock(); return; }
  b.answered = true;
  const ok = btn.dataset.ok === "1";
  const q = b.q;
  document.querySelectorAll(".gq-opt").forEach(x => (x.disabled = true));
  btn.classList.add(ok ? "is-right" : "is-wrong");
  if (!ok) document.querySelector(".gq-opt[data-ok='1']").classList.add("is-right");

  // 記錄
  G.answered += 1;
  let coinGain = 0;
  let lockNow = false;
  if (ok) {
    G.correct += 1;
    if (!G.correctIds.includes(q.id)) G.correctIds.push(q.id);
    G.wrongTimes = [];
    coinGain = grantCoins(1);
  } else {
    G.wrongCounts[q.id] = (G.wrongCounts[q.id] || 0) + 1;
    const now = Date.now();
    G.wrongTimes = G.wrongTimes.filter(t => now - t < GUESS_WINDOW_SEC * 1000);
    G.wrongTimes.push(now);
    if (G.wrongTimes.length >= GUESS_WRONG_LIMIT) {
      G.lockUntil = now + GUESS_LOCK_SEC * 1000;
      G.lockCount += 1;
      G.wrongTimes = [];
      lockNow = true;
    }
  }
  G.logs.unshift({ id: q.id, ok, at: Date.now() });
  G.logs = G.logs.slice(0, 30);

  // 戰鬥效果
  let title, extra = "";
  if (b.kind === "wild") {
    if (ok) {
      b.hp = Math.max(0, b.hp - 1);
      if (b.hp === 0) b.canThrow = true;
      hitFoe();
      title = b.canThrow ? "答對了！牠變虛弱了！" : "答對了！";
    } else {
      b.wrong += 1;
      title = b.wrong >= 3 ? "答錯了…牠要逃走了！" : "答錯了，牠想逃跑！";
    }
  } else {
    if (ok) {
      const d = damagePerHit();
      b.power = false;
      b.hp -= d;
      hitFoe();
      title = `答對了！攻擊 ${d} 點`;
    } else if (b.shield) {
      b.shield = false;
      title = "答錯了，但是護盾擋住了！";
    } else {
      title = "答錯了！";
      extra = hurtFront();
    }
  }
  $("gqFbTitle").textContent = title + (coinGain ? `（+${coinGain} 金幣）` : "");
  $("gqFbTitle").className = "k-display text-xl " + (ok ? "text-[#1F7A4D]" : "text-[#C23A26]");
  $("gqFbText").innerHTML = (extra ? `<b class="text-[#C23A26]">${escapeHtml(extra)}</b><br/>` : "") +
    (ok ? "" : `<b>正確答案：</b>${escapeHtml(q.a)}<br/>`) + `<b>解析：</b>${escapeHtml(q.e)}`;
  const fb = $("gqFeedback");
  fb.classList.remove("hidden", "is-right", "is-wrong");
  fb.classList.add(ok ? "is-right" : "is-wrong");
  const ending = b.kind === "wild" ? (b.wrong >= 3 || b.canThrow) : (b.hp <= 0 || aliveTeam().length === 0);
  $("btnNext").textContent = b.kind === "wild" && b.canThrow ? "要怎麼做？" : (ending ? "看結果" : "下一題");
  renderBattleSide();
  renderStatus();
  fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
  syncActive();
  await save(coinGain);
  renderStatus();
  if (lockNow) showGuessLock();
}

function hitFoe() {
  const w = $("foeImgWrap");
  w.classList.remove("k-hit");
  void w.offsetWidth;
  w.classList.add("k-hit");
}

async function afterAnswer() {
  const b = battle;
  if (!b) return;
  if (G.lockUntil > Date.now()) { showGuessLock(); return; }
  if (b.kind === "wild") {
    if (b.wrong >= 3) {
      const name = b.foe.name;
      await closeBattle();
      showResult({ title: `${name} 逃走了`, text: "沒關係，再出發探索一次吧！" });
      return;
    }
    if (b.canThrow) { showWeakened(); return; }
  } else {
    if (b.hp <= 0) { await winGuardian(); return; }
    if (aliveTeam().length === 0) {
      const name = b.foe.name;
      await closeBattle();
      showResult({ title: "這次輸了", text: `出戰的夥伴都倒下了。${name} 好強！把解析再讀一讀，收服更強的夥伴再來挑戰。` });
      return;
    }
  }
  showQuestion();
}

/* ---------- 野生怪獸：虛弱後三選一 ---------- */
function showWeakened() {
  const b = battle;
  const r = RARITY[b.foe.rarity];
  $("qArea").classList.add("hidden");
  $("gqFeedback").classList.add("hidden");
  $("weakTitle").textContent = `${b.foe.name} 變虛弱了！要怎麼做？`;
  $("actN").innerHTML = r.catchN > 0
    ? `成功率 ${pct(r.catchN)}・你有 ${G.balls.n} 顆`
    : `${r.name}怪獸抓不到`;
  $("actS").innerHTML = `成功率 ${pct(r.catchS)}・你有 ${G.balls.s} 顆`;
  $("actD").innerHTML = `得到 ${r.defeatCoins} 金幣`;
  $("btnCatchN").disabled = r.catchN <= 0 || G.balls.n < 1;
  $("btnCatchS").disabled = G.balls.s < 1;
  ["btnCatchN", "btnCatchS"].forEach(id => ($(id).style.opacity = $(id).disabled ? ".45" : ""));
  $("weakHint").textContent = (G.balls.n + G.balls.s === 0) ? "你沒有寶貝球了，可以到商店用金幣買。" : "";
  $("weakArea").classList.remove("hidden");
  renderBattleSide();
}

async function catchWith(kind) {
  const b = battle;
  if (!b || b.kind !== "wild" || !b.canThrow || G.balls[kind] < 1) return;
  const r = RARITY[b.foe.rarity];
  const chance = kind === "s" ? r.catchS : r.catchN;
  if (chance <= 0) return;
  G.balls[kind] -= 1;
  const mon = b.foe;
  $("weakArea").classList.add("hidden");
  if (Math.random() < chance) {
    const isNew = !G.everCaught[mon.id];
    G.caught[mon.id] = (G.caught[mon.id] || 0) + 1;
    G.everCaught[mon.id] = true;
    if (G.team.filter(canFight).length < 2 && !G.team.includes(mon.id)) G.team = G.team.filter(canFight).concat(mon.id);
    await closeBattle();
    showResult({
      img: monsterImg(mon.id),
      title: `收服了 ${mon.name}！`,
      text: isNew ? `新夥伴（${r.name}）加入了！到「我的夥伴」可以看到牠。` : `你現在有 ${G.caught[mon.id]} 隻 ${mon.name}。`
    });
  } else {
    b.canThrow = false;
    b.hp = 1;
    syncActive();
    await save();
    showResult({ title: "牠掙脫了！", text: "再答對 1 題，牠又會變虛弱，到時候再試一次。" }, () => { if (battle) showQuestion(); });
  }
}

async function defeatWild() {
  const b = battle;
  if (!b || b.kind !== "wild" || !b.canThrow) return;
  const r = RARITY[b.foe.rarity];
  const got = grantCoins(r.defeatCoins);
  const name = b.foe.name;
  battle = null;
  G.active = null;
  $("battle").classList.add("hidden");
  document.body.style.overflow = "";
  await save(got);
  renderAll();
  showResult({
    title: `擊敗了 ${name}！`,
    text: got ? `得到 ${got} 金幣。` : `今天的金幣已經拿滿 ${GAUDI_DAILY_COIN_CAP} 個了，明天再來賺吧！`
  });
}

async function winGuardian() {
  const g = battle.foe;
  const first = !G.beaten[g.id];
  G.beaten[g.id] = true;
  const bonus = first ? grantCoins(5) : 0;
  if (g.final && first) G.cleared = true;
  battle = null;
  G.active = null;
  $("battle").classList.add("hidden");
  document.body.style.overflow = "";
  await save(bonus);
  renderAll();
  const b = BLD(g.b);
  const bIdx = bldIndex(g.b);
  let text;
  if (g.final) text = "你打敗了聖家堂守護神，完成了高第的魔法建築之旅！你是真正的高第小專家！";
  else if (!first) text = "又贏了一次，越來越厲害了！";
  else {
    text = `${g.name} 成為你的夥伴！愛心 ${g.hearts} 顆，招式：${SKILLS[g.skill].name}（${SKILLS[g.skill].desc}）。`;
    if (b.guardians[2] === g.id && BUILDINGS[bIdx + 1]) {
      text += teacherOpened(bIdx + 1)
        ? `\n「${BUILDINGS[bIdx + 1].name}」開放了！`
        : `\n下一站「${BUILDINGS[bIdx + 1].name}」要等老師開放喔！`;
    }
  }
  if (bonus) text += `\n得到 ${bonus} 金幣。`;
  showResult({ img: monsterImg(g.id), title: g.final ? "全部通關！" : `打敗了 ${g.name}！`, text });
}

/* ================= 彈窗 ================= */
function showResult({ img, title, text }, cb) {
  $("resImgWrap").classList.toggle("hidden", !img);
  if (img) $("resImg").src = img;
  $("resTitle").textContent = title;
  $("resText").innerHTML = escapeHtml(text || "").replace(/\n/g, "<br/>");
  resultCallback = cb || null;
  $("modalResult").classList.remove("hidden");
}
function closeResult() {
  closeModal("modalResult");
  const cb = resultCallback;
  resultCallback = null;
  if (cb) cb();
}

let lockTimer = null;
function showGuessLock() {
  clearInterval(lockTimer);
  const tick = () => {
    const left = Math.ceil((G.lockUntil - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(lockTimer);
      $("modalGuessLock").classList.add("hidden");
      return;
    }
    $("guessLockCountdown").textContent = Math.min(left, GUESS_LOCK_SEC);
  };
  $("modalGuessLock").classList.remove("hidden");
  tick();
  lockTimer = setInterval(tick, 250);
}

/* ================= 導覽 ================= */
function gBackToMenu() { location.href = "index.html"; }
function gLogout() { clearSessionStudent(); location.href = "index.html"; }
