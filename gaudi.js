/* =========================================================
   高第的魔法建築／校園的魔法探險｜共用的遊戲程式
   - gaudi.html：高第的魔法建築（GAME_MODE 沒設定）
   - campus.html：校園的魔法探險（先設定 window.GAME_MODE = "campus"）
   兩個遊戲共用：夥伴（怪獸、守護精靈、紀念夥伴）、捕捉道具、薰香、出戰隊伍 → 存在學生資料的 gaudi 欄位
   各算各的：作答紀錄、每日金幣、Boss、進行中的戰鬥 → 高第存在 gaudi、校園存在 campus
   金幣是所有遊戲共用的
   ========================================================= */
const MODE = window.GAME_MODE === "campus" ? "campus" : "gaudi";
const CAMPUS = MODE === "campus";
const PLACES = CAMPUS ? ROOMS : BUILDINGS;                // 地圖上的地點（建築／教室）
const P_WILD = CAMPUS ? CAMPUS_WILD : WILD;               // 這個遊戲的野生怪獸
const P_GUARD = CAMPUS ? CAMPUS_GUARDIANS : GUARDIANS;    // 這個遊戲的守護精靈
const QUESTIONS = CAMPUS ? CAMPUS_QUESTIONS : GAUDI_QUESTIONS;
const QPASSAGES = CAMPUS ? (typeof CAMPUS_PASSAGES !== "undefined" ? CAMPUS_PASSAGES : {}) : PASSAGES;
const DAILY_CAP = CAMPUS ? CAMPUS_DAILY_COIN_CAP : GAUDI_DAILY_COIN_CAP;
const PLACE_ART = CAMPUS ? ROOM_ART : BUILDING_ART;
const QMAP = {};
QUESTIONS.forEach(q => { QMAP[q.id] = q; });

let stu = null;      // 目前登入的學生
let G = null;        // stu.gaudi：共用的夥伴資料
let S = null;        // 這個遊戲自己的紀錄（高第 = stu.gaudi、校園 = stu.campus）
let curBld = null;   // 目前所在的地點 id
let battle = null;   // 進行中的戰鬥（同時存在 S.active，重新整理也能接著打）
let pendingGuardian = null;
let teamPick = [];
let resultCallback = null;
let helpPage = 0;

const $ = id => document.getElementById(id);
const BLD = id => PLACES.find(b => b.id === id);
const MON = id => anyMon(id) || BOSS_LEVELS.find(m => m.id === id) || (HAS_CAMPUS && id === CAMPUS_BOSS.id ? CAMPUS_BOSS : undefined);
const isGuardian = id => id.startsWith("g");
const isHeroId = id => allHeroes().some(h => h.id === id);
const HOUR = 3600 * 1000;

// 任何一個地點（不分遊戲）：夥伴資料卡要顯示牠來自哪裡
function placeOf(m) {
  if (m.id === HERO.id) return { name: "高第的魔法建築", tier: 0 };
  if (HAS_CAMPUS && m.id === INF_HERO.id) return { name: "校園的魔法探險", tier: 0 };
  return BUILDINGS.find(b => b.id === m.b) || (HAS_CAMPUS && ROOMS.find(r => r.id === m.b)) || { name: "", tier: 0 };
}

/* ================= 進度資料 ================= */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// 作答紀錄（兩個遊戲各一份）
function ensureStats(g) {
  const num = k => { g[k] = Number(g[k]) || 0; };
  ["answered", "correct", "dayCoins", "lockUntil", "lockCount"].forEach(num);
  const obj = k => { if (!g[k] || typeof g[k] !== "object" || Array.isArray(g[k])) g[k] = {}; };
  obj("wrongCounts");
  ["correctIds", "wrongTimes", "logs"].forEach(k => { if (!Array.isArray(g[k])) g[k] = []; });
  g.helpSeen = !!g.helpSeen;
  if (g.active && typeof g.active !== "object") g.active = null;
  if (g.dayKey !== todayKey()) { g.dayKey = todayKey(); g.dayCoins = 0; }
  return g;
}

function ensureGaudi(s) {
  const g = (s.gaudi && typeof s.gaudi === "object") ? s.gaudi : {};
  ensureStats(g);
  const obj = k => { if (!g[k] || typeof g[k] !== "object" || Array.isArray(g[k])) g[k] = {}; };
  ["caught", "beaten", "everCaught", "hurt", "restUntil"].forEach(obj);
  if (!g.balls || typeof g.balls !== "object") g.balls = { n: 0, s: 0 };
  g.balls.n = Number(g.balls.n) || 0;
  g.balls.s = Number(g.balls.s) || 0;
  g.incense = Number(g.incense) || 0;
  if (!Array.isArray(g.team)) g.team = [];
  // 舊進度：收服過的怪獸也記進圖鑑
  Object.keys(g.caught).forEach(id => { if (g.caught[id] > 0) g.everCaught[id] = true; });
  g.starterGiven = !!g.starterGiven;
  g.cleared = !!g.cleared;
  g.heroSkin = [1, 2, 3].includes(Number(g.heroSkin)) ? Number(g.heroSkin) : 1;
  if (!g.boss || typeof g.boss !== "object") g.boss = {};
  if (!g.boss.cleared || typeof g.boss.cleared !== "object") g.boss.cleared = {};
  g.boss.hellWins = Number(g.boss.hellWins) || 0;
  // 補發：已經打贏地獄級高第 5 次以上、還沒拿到紀念夥伴的同學
  if (g.boss.hellWins >= HERO_NEED && !g.beaten[HERO.id]) { g.beaten[HERO.id] = true; g.heroNew = true; }
  s.gaudi = g;
  return g;
}

function ensureCampus(s) {
  const c = (s.campus && typeof s.campus === "object") ? s.campus : {};
  ensureStats(c);
  if (!c.boss || typeof c.boss !== "object") c.boss = {};
  c.boss.wins = Number(c.boss.wins) || 0;
  s.campus = c;
  return c;
}

// PvP 得到的高第服裝（存在 pvp 欄位）
const skinUnlocked = lv => lv === 1 || !!(stu && stu.pvp && Number(stu.pvp["sk" + lv]));

async function save(coinDelta = 0) {
  try {
    if (CAMPUS) await saveGameFields(stu, ["gaudi", "campus"], coinDelta);
    else await saveGameData(stu, "gaudi", coinDelta);
  } catch (e) {
    reportError("存檔", e);
  }
}

// 依每日上限計算這次真正能拿到幾個金幣
function grantCoins(n) {
  if (S.dayKey !== todayKey()) { S.dayKey = todayKey(); S.dayCoins = 0; }
  const got = Math.min(n, Math.max(0, DAILY_CAP - S.dayCoins));
  S.dayCoins += got;
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
// 高第：照課文順序，打完上一棟的守護精靈才開下一棟；校園：五間教室同時開放
const progressUnlocked = i => CAMPUS || i === 0 || !!G.beaten[PLACES[i - 1].guardians[2]];
const teacherOpened = i => CAMPUS || i < getGaudiOpen(stu);   // 高第：老師在教師端設定開放到第幾棟
const bldUnlocked = i => teacherOpened(i) && progressUnlocked(i);
const bldIndex = id => PLACES.findIndex(b => b.id === id);
const wildOf = bId => P_WILD.filter(m => m.b === bId);
const caughtKinds = bId => wildOf(bId).filter(m => G.everCaught[m.id]).length;

/* ================= 開始 ================= */
window.onPageReady = async () => {
  document.querySelectorAll(".jsDailyCap").forEach(e => (e.textContent = DAILY_CAP));
  document.querySelectorAll(".jsPriceN").forEach(e => (e.textContent = BALL_PRICE.n));
  document.querySelectorAll(".jsPriceS").forEach(e => (e.textContent = BALL_PRICE.s));
  document.querySelectorAll(".jsPriceI").forEach(e => (e.textContent = INCENSE_PRICE));
  document.querySelectorAll(".jsGuessLimit").forEach(e => (e.textContent = GUESS_WRONG_LIMIT));
  document.querySelectorAll(".jsRestHours").forEach(e => (e.textContent = GUARDIAN_REST_HOURS));
  document.querySelectorAll(".jsCap").forEach(e => (e.textContent = DAILY_CAP));
  document.querySelectorAll(".jsBallN").forEach(e => (e.textContent = BALL_NAME.n));
  document.querySelectorAll(".jsBallS").forEach(e => (e.textContent = BALL_NAME.s));
  const s = await loadSessionStudentOrRedirect();
  if (!s) return;
  stu = s;
  if (CAMPUS) {
    if (!(await getCampusOpen(stu.id))) {
      showResult({ title: "老師還沒開放", text: "校園的魔法探險還沒開放，等老師打開就能玩囉！" }, gBackToMenu);
      return;
    }
  } else if (getGaudiOpen(stu) < 1) {
    showResult({ title: "老師還沒開放", text: "這個遊戲還沒開放給你，先去玩分數盲盒店吧！" }, gBackToMenu);
    return;
  }
  G = ensureGaudi(stu);
  S = CAMPUS ? ensureCampus(stu) : G;
  setHeroSkin(skinUnlocked(G.heroSkin) ? G.heroSkin : 1);
  refreshResting();
  $("viewGame").classList.remove("hidden");
  $("gStuId").textContent = stu.id;
  $("gStuName").textContent = stu.name || "";
  renderAll();

  if (S.active) {                 // 上一場戰鬥還沒打完：接著打
    resumeBattle();
  } else if (!S.helpSeen) {       // 第一次來：先看遊戲說明
    openHelp(true);
  }
  if (S.lockUntil > Date.now()) showGuessLock();
  if (G.heroNew) {                // 補發紀念夥伴高第
    delete G.heroNew;
    await save();
    showResult({ img: monsterImg(HERO.id), title: "高第成為你的夥伴了！",
      text: `你已經打敗地獄級高第 ${HERO_NEED} 次以上！\n高第決定跟著你：攻擊 ${HERO.atk}、${HERO.hearts} 顆愛心，招式「${SKILLS.magic.name}」：${SKILLS.magic.desc}。\n快去「我的夥伴」看看牠吧！` });
  }
};

async function giveStarterIfNeeded() {
  if (G.starterGiven) return;
  G.starterGiven = true;
  G.balls.n += STARTER_BALLS;
  await save();
  renderStatus();
  showResult({
    title: `送你${BALL_NAME.n}！`,
    text: `送你 ${STARTER_BALLS} 個${BALL_NAME.n}。` + (CAMPUS ? "選一間教室出發探索，收服第一隻怪獸吧！" : "先到「米拉之家」出發探索，收服第一隻怪獸吧！")
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
  $("gAnswered").textContent = S.answered;
  $("gCorrect").textContent = S.correct;
  $("gAcc").textContent = (S.answered ? Math.round(S.correct / S.answered * 100) : 0) + "%";
  $("gBallN").textContent = G.balls.n;
  $("gBallS").textContent = G.balls.s;
  document.querySelectorAll(".jsIncense").forEach(e => (e.textContent = G.incense));
  if ($("btnIncense")) $("btnIncense").classList.toggle("opacity-60", G.incense < 1);
  $("gDayCoins").textContent = S.dayCoins;
  $("gCaughtCount").textContent = P_WILD.filter(m => G.everCaught[m.id]).length;
  if ($("gCaughtTotal")) $("gCaughtTotal").textContent = P_WILD.length;
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
const pct = x => Math.round(x * 100) + "%";
const catchTable = () => `
      <table class="mx-auto text-sm font-bold border-collapse">
        <tr><th></th><th class="px-2">普通</th><th class="px-2">稀有</th><th class="px-2">傳說</th></tr>
        <tr><td class="pr-2 text-left"><span class="k-ball align-middle"></span> 初級捕捉</td><td>${pct(RARITY[0].catchN)}</td><td>${pct(RARITY[1].catchN)}</td><td class="text-[#C23A26]">抓不到</td></tr>
        <tr><td class="pr-2 text-left"><span class="k-ball is-super align-middle"></span> 高級捕捉</td><td>${pct(RARITY[0].catchS)}</td><td>${pct(RARITY[1].catchS)}</td><td>${pct(RARITY[2].catchS)}</td></tr>
        <tr><td class="pr-2 text-left">擊敗牠</td><td>${RARITY[0].defeatCoins} 金幣</td><td>${RARITY[1].defeatCoins} 金幣</td><td>${RARITY[2].defeatCoins} 金幣</td></tr>
      </table>`;
const GAUDI_HELP = [
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
  { title: "虛弱後，三選一", art: catchTable, text: `傳說怪獸只有「高級捕捉」（${BALL_NAME.s}）抓得到！不想抓的話，可以擊敗牠換金幣。` },
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
    text: `答對 1 題得 1 金幣，第一次打敗守護精靈多 5 金幣，擊敗怪獸也有金幣。每天最多 ${GAUDI_DAILY_COIN_CAP} 金幣，可以到商店買${BALL_NAME.n}和${BALL_NAME.s}。`
  }
];
const CAMPUS_HELP = () => [
  {
    title: "五間教室，想去哪就去哪",
    art: () => `<div class="flex justify-center gap-1">${ROOMS.map(r => `<div class="w-14">${ROOM_ART[r.id]}</div>`).join("")}</div>`,
    text: "五間教室一開始就全部開放，每間教室複習不同的國語課文和數學單元。"
  },
  {
    title: "夥伴和道具是共用的",
    art: () => `<div class="flex justify-center gap-3 text-5xl"><span class="k-ball"></span><span class="k-ball is-super"></span></div>`,
    text: `在高第的魔法建築收服的夥伴、${BALL_NAME.n}、${BALL_NAME.s}和薰香，這裡都能用；這裡收服的夥伴，回高第那邊也能帶出戰。`
  },
  { title: "探索：讓怪獸變虛弱", art: catchTable, text: "答對讓牠變虛弱，答錯 3 次牠就逃走。虛弱後可以捕捉或擊敗牠。" },
  {
    title: "守護精靈更強了！",
    art: () => `<div class="w-28 mx-auto k-mon-img border-[3px] border-[#1E2A33]"><img src="${monsterImg("gc2")}" alt="" /></div>`,
    text: "每間教室有 3 隻守護精靈，先收服 2、3、4 種怪獸才能挑戰。第 2、3 隻還會使出教室的特殊技能，打敗牠們就能得到不同的招式！"
  },
  {
    title: "最終 Boss：怪獸∞號",
    art: () => `<div class="w-28 mx-auto k-mon-img border-[3px] border-[#1E2A33]"><img src="${monsterImg("cboss")}" alt="" /></div>`,
    text: `圖鑑收集到 ${CAMPUS_BOSS_NEED} 個，就能挑戰怪獸∞號。打贏 ${CAMPUS_INF_NEED} 次，牠會成為你的紀念夥伴！`
  },
  {
    title: "金幣和每日上限",
    art: () => `<div class="text-center"><span class="k-coin text-4xl"></span></div>`,
    text: `答對 1 題得 1 金幣。這個遊戲每天最多 ${CAMPUS_DAILY_COIN_CAP} 金幣，和高第那邊分開算。答錯夥伴會受傷，不要亂猜喔！`
  }
];
const HELP_PAGES = CAMPUS ? CAMPUS_HELP() : GAUDI_HELP;

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
    if (!S.helpSeen) { S.helpSeen = true; await save(); }
    await giveStarterIfNeeded();
    return;
  }
  helpPage = Math.max(0, helpPage);
  renderHelp();
}

/* ================= 地圖 ================= */
function renderMap() {
  $("mapGrid").innerHTML = PLACES.map((b, i) => {
    const open = bldUnlocked(i);
    const beatenN = b.guardians.filter(g => G.beaten[g]).length;
    const done = beatenN === 3;
    const cls = !open ? "is-locked" : (done ? "is-done" : "");
    const status = !open
      ? `<span class="k-chip mt-2">${teacherOpened(i) ? "還沒開放" : "老師還沒開放"}</span>`
      : `<span class="k-chip ${done ? "k-chip--yellow" : "k-chip--chi"} mt-2">${done ? "完成！" : `精靈 ${beatenN}/3・怪獸 ${caughtKinds(b.id)}/${wildOf(b.id).length}`}</span>`;
    return `
      <button class="k-bld ${cls}" onclick="enterBuilding('${b.id}')" aria-label="${b.name}${open ? "" : "（還沒開放）"}">
        ${CAMPUS ? "" : `<span class="k-bld-step">${i + 1}</span><span class="k-bld-tier">${"★".repeat(b.tier)}</span>`}
        ${PLACE_ART[b.id]}
        <span class="k-display text-xl mt-1">${b.name}</span>
        ${CAMPUS ? `<span class="text-[11px] font-bold text-[#5B6B78] leading-tight mt-0.5">${b.sub}</span>` : ""}
        ${status}
      </button>`;
  }).join("") + bossMapCard();
}

/* ================= 最終 Boss ================= */
const dexTotal = () => P_WILD.length + P_GUARD.length;
const dexDone = () => P_WILD.filter(m => G.everCaught[m.id]).length + P_GUARD.filter(x => G.beaten[x.id]).length;
const bossNeed = () => CAMPUS ? CAMPUS_BOSS_NEED : dexTotal();
const bossOpen = () => dexDone() >= bossNeed();
const bossUnlocked = lv => lv === 1 || lv === "inf" || !!G.boss.cleared[lv - 1];
const bossDone = lv => lv !== "inf" && !BOSS_LEVELS[lv - 1].repeat && !!G.boss.cleared[lv];
const isGaudiBoss = f => !!f && typeof f.lv === "number";
const isCampusBoss = f => !!f && f.lv === "inf";

function bossMapCard() {
  const open = bossOpen();
  if (CAMPUS) {
    return `
    <button class="k-bld k-bld--boss ${open ? "" : "is-locked"} col-span-2 md:col-span-5" onclick="openBossPanel()" aria-label="挑戰怪獸∞號">
      <span class="k-bld-tier">👑</span>
      <div class="flex items-center gap-4 w-full">
        <img src="${monsterImg(CAMPUS_BOSS.id)}" alt="" class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-[3px] border-[#1E2A33] bg-white ${open ? "" : "grayscale opacity-50"}"/>
        <div class="text-left flex-1">
          <span class="k-display text-2xl">挑戰怪獸∞號</span> <span class="k-chip k-chip--yellow">終極</span>
          <div class="text-sm font-bold text-[#5B6B78] mt-1">${open
            ? `已經贏了 ${S.boss.wins} 次・贏 ${CAMPUS_INF_NEED} 次得到紀念夥伴`
            : `圖鑑收集 ${CAMPUS_BOSS_NEED} 個才會出現（現在 ${dexDone()} / ${dexTotal()}）`}</div>
        </div>
      </div>
    </button>`;
  }
  const next = BOSS_LEVELS.find(x => bossUnlocked(x.lv) && !bossDone(x.lv));
  return `
    <button class="k-bld k-bld--boss ${open ? "" : "is-locked"} col-span-2 md:col-span-4" onclick="openBossPanel()" aria-label="挑戰最終守護精靈">
      <span class="k-bld-tier">👑</span>
      <div class="flex items-center gap-4 w-full">
        <img src="${monsterImg(next ? next.id : "boss4")}" alt="" class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-[3px] border-[#1E2A33] ${open ? "" : "grayscale opacity-50"}"/>
        <div class="text-left flex-1">
          <span class="k-display text-2xl">挑戰最終守護精靈</span>
          <div class="text-sm font-bold text-[#5B6B78] mt-1">${open
            ? `下一關：${next ? next.name : "高第‧地獄"}・地獄級贏了 ${G.boss.hellWins} 次`
            : `收集全部圖鑑才會出現（現在 ${dexDone()} / ${dexTotal()}）`}</div>
        </div>
      </div>
    </button>`;
}
function bossRow(x, btn, unlocked) {
  return `
      <div class="flex gap-3 items-center border-[3px] border-[#1E2A33] rounded-2xl p-3 ${unlocked ? "bg-white" : "bg-[#EEF2F6] opacity-60"}">
        <img src="${monsterImg(x.id)}" alt="" class="w-20 h-20 rounded-xl border-2 border-[#1E2A33] shrink-0 bg-white"/>
        <div class="flex-1 min-w-0 text-left">
          <div class="k-display text-lg">${x.name}${isCampusBoss(x) ? ' <span class="k-chip k-chip--yellow">終極</span>' : ""}</div>
          <div class="text-xs font-bold text-[#5B6B78]">血量 ${x.hp}・打贏得 ${x.reward} 金幣${x.repeat ? "（可以一直挑戰）" : "（只能通關一次）"}</div>
          <div class="text-sm font-bold mt-1"><span class="k-chip k-chip--math">技能</span> ${x.skillName}：${x.skillDesc}</div>
        </div>
        <div class="shrink-0">${btn}</div>
      </div>`;
}
function openBossPanel() {
  if (!bossOpen()) {
    showResult({ title: CAMPUS ? "怪獸∞號還沒出現" : "最終守護精靈還沒出現", text: CAMPUS
      ? `「我的夥伴」的圖鑑收集到 ${CAMPUS_BOSS_NEED} 個（一共 ${dexTotal()} 個：${P_WILD.length} 種怪獸、${P_GUARD.length} 隻守護精靈），怪獸∞號就會出現！現在 ${dexDone()} 個。`
      : `把「我的夥伴」裡的 ${dexTotal()} 個圖鑑全部收集完（20 種怪獸、12 隻守護精靈），高第就會出現！現在 ${dexDone()} / ${dexTotal()}。` });
    return;
  }
  if (CAMPUS) {
    const x = CAMPUS_BOSS;
    $("bossList").innerHTML = bossRow(x, `<button onclick="closeModal('modalBoss');startBoss('${x.id}')" class="k-btn k-btn--tomato px-5 py-2">挑戰</button>`, true) +
      `<p class="text-sm font-bold text-center mt-2">已經打贏 <b>${S.boss.wins}</b> 次・${G.beaten[INF_HERO.id] ? "怪獸∞號已經是你的夥伴了！" : `再贏 ${Math.max(0, CAMPUS_INF_NEED - S.boss.wins)} 次，牠就會成為你的紀念夥伴`}</p>`;
  } else {
    $("bossList").innerHTML = BOSS_LEVELS.map(x => {
      const unlocked = bossUnlocked(x.lv), done = bossDone(x.lv);
      let btn;
      if (!unlocked) btn = `<span class="k-chip">先打贏 ${BOSS_LEVELS[x.lv - 2].name}</span>`;
      else if (done) btn = `<span class="k-chip k-chip--yellow">已通關</span>`;
      else btn = `<button onclick="closeModal('modalBoss');startBoss('${x.id}')" class="k-btn k-btn--tomato px-5 py-2">挑戰</button>`;
      return bossRow(x, btn, unlocked);
    }).join("");
  }
  $("modalBoss").classList.remove("hidden");
}
function startBoss(id) {
  if (S.lockUntil > Date.now()) { showGuessLock(); return; }
  const x = MON(id);
  if (!bossOpen() || !bossUnlocked(x.lv) || bossDone(x.lv)) return;
  openTeamPicker(id);
}
function bossDamage(d) {   // 高第 Boss：依難度調整玩家造成的傷害
  const lv = battle.foe.lv;
  if (lv === 1) return { d: Math.floor(d * 0.85), note: "（魔法護罩：85%）" };
  if (lv === 2) {
    const r = BOSS_RANDOM_RATES[Math.floor(Math.random() * BOSS_RANDOM_RATES.length)];
    return { d: Math.max(1, Math.round(d * r)), note: `（扭曲空間：${Math.round(r * 100)}%）` };
  }
  return { d, note: "" };
}
function endBattleView() {
  battle = null;
  S.active = null;
  $("battle").classList.add("hidden");
  document.body.style.overflow = "";
}
async function winBoss() {
  const x = battle.foe;
  if (isCampusBoss(x)) return winCampusBoss();
  const first = !G.boss.cleared[x.lv];
  G.boss.cleared[x.lv] = true;
  if (x.repeat) G.boss.hellWins = (G.boss.hellWins || 0) + 1;
  const gotHero = x.repeat && G.boss.hellWins >= HERO_NEED && !G.beaten[HERO.id];
  if (gotHero) G.beaten[HERO.id] = true;
  endBattleView();
  await save(x.reward);   // 不算在每日上限
  renderAll();
  const next = BOSS_LEVELS[x.lv];
  let text = `得到 ${x.reward} 金幣！（不算在每天的上限裡）`;
  if (next && first) text += `\n下一關「${next.name}」開放了！`;
  if (x.repeat) text += `\n地獄級一共贏了 ${G.boss.hellWins} 次，可以再挑戰！`;
  showResult({ img: monsterImg(x.id), title: `打敗了${x.name}！`, text });
  if (gotHero) chainResult({ img: monsterImg(HERO.id), title: "高第成為你的夥伴了！",
    text: `你已經打敗地獄級高第 ${HERO_NEED} 次！\n高第決定跟著你：攻擊 ${HERO.atk}、${HERO.hearts} 顆愛心，招式「${SKILLS.magic.name}」：${SKILLS.magic.desc}。\n這是高第的魔法世界的紀念夥伴，之後的新遊戲也會帶著牠喔！` });
}
async function winCampusBoss() {
  const x = battle.foe;
  S.boss.wins = (S.boss.wins || 0) + 1;
  const gotInf = S.boss.wins >= CAMPUS_INF_NEED && !G.beaten[INF_HERO.id];
  if (gotInf) G.beaten[INF_HERO.id] = true;
  endBattleView();
  await save(x.reward);   // 不算在每日上限
  renderAll();
  let text = `得到 ${x.reward} 金幣！（不算在每天的上限裡）\n一共打贏 ${S.boss.wins} 次。`;
  if (!G.beaten[INF_HERO.id]) text += `再贏 ${CAMPUS_INF_NEED - S.boss.wins} 次，怪獸∞號就會成為你的夥伴！`;
  showResult({ img: monsterImg(x.id), title: "打敗了怪獸∞號！", text });
  if (gotInf) chainResult({ img: monsterImg(INF_HERO.id), title: "怪獸∞號成為你的夥伴了！",
    text: `你已經打敗怪獸∞號 ${CAMPUS_INF_NEED} 次！\n牠決定跟著你：攻擊 ${INF_HERO.atk}、${INF_HERO.hearts} 顆愛心，招式「${SKILLS.inf.name}」：${SKILLS.inf.desc}。` });
}
// 關掉目前的結果視窗後，接著顯示下一個
function chainResult(next) {
  const done = window.closeResult;
  window.closeResult = function () {
    window.closeResult = done; done();
    showResult(next);
  };
}

function enterBuilding(id) {
  const i = bldIndex(id);
  if (!teacherOpened(i)) {
    showResult({ title: "老師還沒開放這裡", text: "等老師上完這段課文，就會開放囉！" });
    return;
  }
  if (!progressUnlocked(i)) {
    showResult({ title: "這裡還沒開放", text: `先打敗「${PLACES[i - 1].name}」的 3 隻守護精靈，才能來這裡喔！` });
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
        ${!seen && isHeroId(id)
          ? `<div class="w-full flex items-center justify-center bg-[#EEF1F4] text-4xl font-black text-[#B5C0C9]" style="aspect-ratio:1/1">？</div>`
          : `<img src="${seen ? monsterImg(id) : silhouetteImg(id)}" alt="${seen ? m.name : "還沒收服"}" loading="lazy" />`}${cnt}
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
  const b = placeOf(m);
  const kind = m.hero ? "紀念夥伴" : guard ? "守護精靈" : `${RARITY[m.rarity].name}怪獸`;
  const kindColor = m.hero ? "#E8513F" : guard ? "#E0A21B" : ["#8FA3B3", "#4A90E2", "#B455D6"][m.rarity];
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
      <span class="k-chip">${b.name}${b.tier ? " " + "★".repeat(b.tier) : ""}</span></div>
    <div class="text-left mt-4">
      ${row("血量", n ? `${heartsHtml(id)} <span class="ml-1">${heartsLeft(id)} / ${maxHeartsOf(id)} 顆愛心</span>` : `<span class="text-[#8C9AA6]">滿血時有 ${maxHeartsOf(id)} 顆愛心</span>`)}
      ${row("攻擊", `每答對一題攻擊 <b>${attackOf(id)}</b> 點`)}
      ${row("招式", skill)}
      ${!guard ? row("數量", `${n} 隻`) : ""}
      ${row("狀態", status)}
      ${id === HERO.id ? row("服裝", skinPicker()) : ""}
    </div>`;
  $("modalMonInfo").classList.remove("hidden");
}

/* ---------- 高第的服裝（PvP 獎勵，只換樣子） ---------- */
function skinPicker() {
  return `<div class="grid grid-cols-3 gap-2">${HERO_SKINS.map(x => {
    const ok = skinUnlocked(x.lv), on = HERO_SKIN === x.lv;
    return `<button ${ok ? `onclick="wearSkin(${x.lv})"` : "disabled"} class="rounded-xl border-[3px] p-1 ${on ? "border-[#1E2A33] bg-[#FFC83D]" : "border-[#DCE7F2] bg-white"} ${ok ? "" : "opacity-50"}">
      <div class="k-mon-img"><img src="${heroSkinImg(x.lv)}" alt="" class="${ok ? "" : "grayscale"}"/></div>
      <div class="text-[11px] font-black mt-0.5">${x.name}${on ? "・穿著" : ok ? "" : "・🔒"}</div></button>`;
  }).join("")}</div>
  <div class="text-[11px] font-bold text-[#5B6B78] mt-1">服裝只會改變樣子，攻擊和招式都一樣。中級：PvP 公平競技累積贏 5 場；高級：公平競技連贏 5 場。</div>`;
}
async function wearSkin(lv) {
  if (!skinUnlocked(lv) || !G.beaten[HERO.id]) return;
  G.heroSkin = lv;
  setHeroSkin(lv);
  await save();
  openMonInfo(HERO.id);
  renderAll();
  if (!$("gPaneTeam").classList.contains("hidden")) renderDex();
}

function renderBuilding() {
  const b = BLD(curBld);
  $("bvArt").innerHTML = PLACE_ART[b.id];
  $("bvName").textContent = b.name;
  $("bvSub").textContent = CAMPUS ? b.sub : b.sub + "　" + "★".repeat(b.tier);
  const beatenN = b.guardians.filter(g => G.beaten[g]).length;
  $("bvProgress").textContent = `守護精靈 ${beatenN} / 3`;
  $("bvWild").innerHTML = wildOf(b.id).map(m => monCard(m.id)).join("");
  $("bvCaughtKinds").textContent = caughtKinds(b.id);
  if ($("bvWildTotal")) $("bvWildTotal").textContent = wildOf(b.id).length;
  const kinds = caughtKinds(b.id);
  $("bvGuards").innerHTML = b.guardians.map((gid, j) => {
    const g = MON(gid);
    const beaten = !!G.beaten[gid];
    const prevOk = j === 0 || G.beaten[b.guardians[j - 1]];
    const enough = kinds >= CAUGHT_NEEDED[j];
    const fs = foeSkillOf(g);
    const fsNote = fs ? `・技能「${FOE_SKILLS[fs].name}」` : "";
    let btn, note;
    if (!prevOk) { btn = `<span class="k-chip">先打敗前一隻</span>`; note = `需要收服 ${CAUGHT_NEEDED[j]} 種怪獸`; }
    else if (!enough) { btn = `<span class="k-chip">還不能挑戰</span>`; note = `先收服這裡 ${CAUGHT_NEEDED[j]} 種怪獸（現在 ${kinds} 種）`; }
    else if (beaten) { btn = `<button onclick="startGuardian('${gid}')" class="k-btn k-btn--sm">再打一次</button>`; note = `已打敗・招式：${SKILLS[g.skill].name}`; }
    else { btn = `<button onclick="startGuardian('${gid}')" class="k-btn k-btn--tomato px-4 py-2">挑戰</button>`; note = `血量 ${g.hp}${fsNote}`; }
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
function memorialHtml() {
  const pv = stu.pvp || {};
  const skins = [2, 3].filter(lv => skinUnlocked(lv)).map(lv => HERO_SKINS[lv - 1].name);
  const heroNote = G.beaten[HERO.id]
    ? `打敗地獄級高第 ${HERO_NEED} 次得到。${skins.length ? `點牠可以換服裝（已經有：${skins.join("、")}）。` : "PvP 公平競技累積贏 5 場、連贏 5 場，可以得到新服裝！"}`
    : `打敗「高第‧地獄」${HERO_NEED} 次就能得到（現在 ${Math.min(G.boss.hellWins, HERO_NEED)} / ${HERO_NEED} 次）。${skins.length ? `你已經在 PvP 得到高第的${skins.join("、")}服裝，得到高第後就能換上！` : ""}`;
  const rows = [`
      <div class="flex items-center gap-4">
        <div class="w-24 shrink-0">${monCard(HERO.id)}</div>
        <p class="text-sm font-bold text-[#5B6B78]"><b class="text-[#1E2A33]">高第</b>：${heroNote}</p>
      </div>`];
  if (HAS_CAMPUS) {
    const wins = stu.campus ? Number(stu.campus.boss && stu.campus.boss.wins) || 0 : 0;
    rows.push(`
      <div class="flex items-center gap-4">
        <div class="w-24 shrink-0">${monCard(INF_HERO.id)}</div>
        <p class="text-sm font-bold text-[#5B6B78]"><b class="text-[#1E2A33]">怪獸∞號</b>：${G.beaten[INF_HERO.id]
          ? `在校園的魔法探險打贏怪獸∞號 ${CAMPUS_INF_NEED} 次得到。`
          : `在〈校園的魔法探險〉打贏怪獸∞號 ${CAMPUS_INF_NEED} 次就能得到（現在 ${Math.min(wins, CAMPUS_INF_NEED)} / ${CAMPUS_INF_NEED} 次）。`}</p>
      </div>`);
  }
  return `<div><h4 class="k-display text-lg mb-2">👑 紀念夥伴</h4><div class="space-y-3">${rows.join("")}</div></div>`;
}
function renderDex() {
  renderTeamNow();
  $("dexList").innerHTML = PLACES.map((b, i) => `
    <div>
      <h4 class="k-display text-lg mb-2">${CAMPUS ? "" : i + 1 + ". "}${b.name} <span class="text-sm text-[#5B6B78]">${CAMPUS ? b.sub : "★".repeat(b.tier)}</span></h4>
      <div class="grid grid-cols-4 sm:grid-cols-${CAMPUS ? 10 : 8} gap-2">
        ${wildOf(b.id).map(m => monCard(m.id)).join("")}
        ${b.guardians.map(g => monCard(g)).join("")}
      </div>
    </div>`).join("") + (CAMPUS
      ? `<p class="text-sm font-bold text-[#5B6B78]">圖鑑：${dexDone()} / ${dexTotal()}（收集 ${CAMPUS_BOSS_NEED} 個就能挑戰怪獸∞號）。在高第的魔法建築收服的夥伴，也可以帶來這裡出戰。</p>`
      : (HAS_CAMPUS ? `<p class="text-sm font-bold text-[#5B6B78]">在〈校園的魔法探險〉收服的夥伴，也可以在「換隊伍」選來出戰。</p>` : "")) + memorialHtml();
}

function renderTeamNow() {
  const team = G.team.filter(id => MON(id) && canFight(id));
  $("teamNow").innerHTML = team.length
    ? team.map(id => `<span class="k-chip k-chip--yellow">${MON(id).name}</span>`).join("")
    : `<span class="k-chip">還沒選</span>`;
}

function memberLabel(id) {
  const r = isHeroId(id) ? "紀念夥伴" : isGuardian(id) ? "守護精靈" : RARITY[MON(id).rarity].name;
  return `${r}・攻擊 ${attackOf(id)}`;
}

// 可以選來出戰的夥伴：兩個遊戲的都算（這個遊戲的排前面）
function ownedAll() {
  const other = CAMPUS ? [...GUARDIANS, ...WILD] : (HAS_CAMPUS ? [...CAMPUS_GUARDIANS, ...CAMPUS_WILD] : []);
  return [...allHeroes(), ...P_GUARD, ...P_WILD, ...other].map(m => m.id).filter(id => countOf(id) > 0);
}

function openTeamPicker(guardianId) {
  refreshResting();
  pendingGuardian = guardianId;
  const all = ownedAll();
  const ready = all.filter(canFight);
  if (ready.length === 0) {
    showResult({ title: "沒有可以出戰的夥伴", text: all.length ? "你的守護精靈都在休息，先去探索收服怪獸吧。" : `先到${CAMPUS ? "教室" : "建築"}裡「出發探索」，收服怪獸當夥伴。` });
    return;
  }
  teamPick = G.team.filter(id => MON(id) && canFight(id)).slice(0, 2);
  if (teamPick.length === 0) teamPick = ready.slice(0, 2);
  $("btnTeamGo").textContent = guardianId ? "出戰" : "決定";
  let hint = "先選的夥伴站前面，答錯時前面的先受傷。";
  if (guardianId) {
    const f = MON(guardianId), fs = foeSkillOf(f);
    hint = `對手：${f.name}（血量 ${f.hp}）。` + (f.lv ? `技能：${f.skillDesc} ` : fs ? `技能「${FOE_SKILLS[fs].name}」：${FOE_SKILLS[fs].desc} ` : "") + hint;
  }
  $("teamHint").textContent = hint;
  renderTeamPick();
  $("modalTeam").classList.remove("hidden");
}

function renderTeamPick() {
  $("teamPickGrid").innerHTML = ownedAll().map(id => {
    const idx = teamPick.indexOf(id);
    const ok = canFight(id);
    return `
      <button ${ok ? `onclick="toggleTeam('${id}')"` : "disabled"} class="relative text-center rounded-2xl p-1.5 border-[3px] ${idx >= 0 ? "border-[#1E2A33] bg-[#FFC83D]" : "border-transparent"} ${ok ? "" : "opacity-40"}">
        ${idx >= 0 ? `<span class="absolute -top-1 -left-1 z-10 k-chip k-chip--yellow">${idx === 0 ? "前" : "後"}</span>` : ""}
        <div class="k-mon-img border-[2.5px] border-[#1E2A33]"><img src="${monsterImg(id)}" alt="" /></div>
        <div class="text-sm font-bold mt-1 leading-tight">${MON(id).name}${!isGuardian(id) && countOf(id) > 1 ? " ×" + countOf(id) : ""}</div>
        <div class="leading-none">${ok ? heartsHtml(id, true) : ""}</div>
        <div class="text-[11px] font-bold text-[#5B6B78] leading-tight">${ok ? memberLabel(id) : restText(id)}</div>
        ${ok && isGuardian(id) ? `<div class="text-[10px] font-bold text-[#8A63D2] leading-tight">${SKILLS[MON(id).skill].name}</div>` : ""}
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
// inBattle：在捕捉畫面直接買，買完不跳視窗，直接更新按鈕
async function buyBall(kind, qty = 1, inBattle = false) {
  if (shopBusy) return;
  const price = BALL_PRICE[kind] * qty;
  const unit = kind === "n" ? "個" : "個";
  if ((stu.coins || 0) < price) {
    showResult({ title: "金幣不夠", text: `${qty} ${unit}${BALL_NAME[kind]}要 ${price} 金幣，你現在有 ${stu.coins || 0} 金幣。多答對幾題就能賺到！` });
    return;
  }
  shopBusy = true;
  G.balls[kind] += qty;
  if (inBattle) syncActive();
  await save(-price);
  shopBusy = false;
  renderStatus();
  if (inBattle) { showWeakened(); $("weakHint").textContent = `買好了！${BALL_NAME[kind]} +${qty}（剩 ${stu.coins} 金幣）`; return; }
  showResult({ title: "買好了！", text: `${BALL_NAME[kind]} +${qty}（剩 ${stu.coins} 金幣）` });
}
async function buyIncense(qty = 1) {
  if (shopBusy) return;
  const price = INCENSE_PRICE * qty;
  if ((stu.coins || 0) < price) {
    showResult({ title: "金幣不夠", text: `${qty} 個傳說薰香要 ${price} 金幣，你現在有 ${stu.coins || 0} 金幣。` });
    return;
  }
  shopBusy = true;
  G.incense += qty;
  await save(-price);
  shopBusy = false;
  renderStatus();
  showResult({ title: "買好了！", text: `傳說薰香 +${qty}（你現在有 ${G.incense} 個，剩 ${stu.coins} 金幣）\n到${CAMPUS ? "教室" : "建築"}裡按「使用薰香探索」，一定會遇到傳說怪獸！` });
}
let shopBusy = false;

/* ================= 排行榜 ================= */
async function renderRank() {
  $("rankCount").innerHTML = $("rankAcc").innerHTML = `<li class="text-sm font-bold text-[#5B6B78]">讀取中…</li>`;
  let list;
  try {
    list = await fetchAllStudents();
  } catch (e) { reportError("讀取排行榜", e); return; }
  const rows = list.filter(s => !isTestAccount(s.id) && sameClass(s.id, stu.id)).map(s => {   // 只排同班同學
    const g = s[MODE] || {};
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
  let pool;
  if (CAMPUS) {
    // 校園：先平均抽一個單元（國語課文或數學單元），再從那個單元抽題
    const units = bId === "all" ? [...new Set(QUESTIONS.map(q => q.u))] : BLD(bId).u;
    const u = units[Math.floor(Math.random() * units.length)];
    pool = QUESTIONS.filter(q => q.u === u);
  } else {
    pool = bId === "all" ? QUESTIONS : QUESTIONS.filter(q => q.b === bId);
  }
  const fresh = pool.filter(q => !battle.asked.includes(q.id));
  if (fresh.length) pool = fresh;
  // 優先出還沒答對過的題目
  const notYet = pool.filter(q => !S.correctIds.includes(q.id));
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
  list.forEach(q => { const f = Q_FAMILY[q.t] || q.t || "other"; (groups[f] = groups[f] || []).push(q); });
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
// 題目文字：換行、直式分數 [[分子/分母]]、帶分數 [[整數 分子/分母]]
function fmtQ(t) {
  return escapeHtml(t).replace(/\n/g, "<br/>").replace(/\[\[(?:(\d+) )?(\d+)\/(\d+)\]\]/g, (m, w, n, d) =>
    `${w ? `<span class="fr-w">${w}</span>` : ""}<span class="fr"><span>${n}</span><span>${d}</span></span>`);
}

// keepCurrent：接著打的時候，出同一題（不能靠重新整理換題目）
function showQuestion(keepCurrent) {
  let q = keepCurrent && battle.qid ? QMAP[battle.qid] : null;
  if (!q) {
    q = pickQuestion(battle.pool);
    battle.qid = q.id;
    battle.asked.push(q.id);
    battle.asked = battle.asked.slice(-60);
  }
  battle.q = q;
  battle.answered = false;
  if (q.p && QPASSAGES[q.p]) {
    $("qPassage").classList.remove("hidden");
    $("qPassageTitle").textContent = "〈" + QPASSAGES[q.p].title + "〉";
    $("qPassageText").textContent = QPASSAGES[q.p].text;
  } else {
    $("qPassage").classList.add("hidden");
  }
  $("gqType").textContent = q.t;
  $("gqText").innerHTML = fmtQ(q.q);
  if ($("gqFig")) {
    $("gqFig").innerHTML = q.fig || "";
    $("gqFig").classList.toggle("hidden", !q.fig);
  }
  const opts = shuffle([q.a, ...q.w]);
  $("gqOpts").innerHTML = opts.map((o, i) => `
    <button class="k-opt gq-opt" data-ok="${o === q.a ? 1 : 0}" onclick="answer(this)">
      <span class="k-opt-key">${"ABCD"[i]}</span><span class="k-opt-txt">${fmtQ(o)}</span>
    </button>`).join("");
  $("gqFeedback").classList.add("hidden");
  $("qArea").classList.remove("hidden");
  $("weakArea").classList.add("hidden");
  renderBattleSide();
  if (!keepCurrent) { syncActive(); save(); }   // 記住這一題：重新整理也不能換題
}

/* ================= 戰鬥 ================= */
// 招式和技能的效果都放在 battle.fx
const newFx = () => ({ gear: 0, rhythm: 0, silence: false, backup: false, armor: 0, inf: 0, fallen: [], last: null, hits: 0, patched: false });
// 存一份戰鬥狀態，重新整理或關掉網頁後可以接著打
function syncActive() {
  const b = battle;
  S.active = b ? {
    kind: b.kind, foe: b.foe.id, hp: b.hp, maxHp: b.maxHp, wrong: b.wrong || 0, canThrow: !!b.canThrow,
    team: b.team || [], used: b.used || {}, shield: Number(b.shield) || 0, power: !!b.power, fx: b.fx || newFx(),
    pool: b.pool, asked: b.asked, qid: b.answered ? null : b.qid, bld: curBld
  } : null;
}

function openBattle() {
  $("battle").classList.remove("hidden");
  $("battle").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
async function closeBattle() {
  endBattleView();
  await save();
  renderAll();
}

// 校園的守護精靈（每間教室第 2、3 隻）的技能；鯨之歌可以讓它失效
function foeSkillOf(f) {
  if (!HAS_CAMPUS || !f || !CAMPUS_GUARDIANS.includes(f) || f.n < 2) return null;
  return (ROOMS.find(r => r.id === f.b) || {}).foeSkill || null;
}
function activeFoeSkill() {
  if (!battle || battle.kind !== "guard" || battle.fx.silence) return null;
  return foeSkillOf(battle.foe);
}

function setFoeHeader() {
  const f = battle.foe;
  $("foeImg").src = monsterImg(f.id);
  $("foeName").textContent = f.name;
  if (battle.kind === "wild") {
    $("foeTag").textContent = RARITY[f.rarity].name + "・" + "★".repeat(tierOf(f.b)) + (G.everCaught[f.id] ? "" : "・新怪獸");
    $("foeTag").className = "k-chip " + (f.rarity === 2 ? "k-chip--yellow" : f.rarity === 1 ? "k-chip--math" : "");
  } else {
    $("foeTag").textContent = isCampusBoss(f) ? "終極 Boss" : f.lv ? "最終守護精靈" : (f.final ? "最終魔王" : (f.n ? `守護精靈・第 ${f.n} 隻` : "守護精靈・" + "★".repeat(tierOf(f.b))));
    $("foeTag").className = "k-chip k-chip--yellow";
  }
  const fs = foeSkillOf(f);
  $("foeSkill").classList.toggle("hidden", !f.lv && !fs);
  if (f.lv) $("foeSkill").innerHTML = `<span class="k-chip k-chip--math">技能</span> <b>${f.skillName}</b>：${f.skillDesc}`;
  else if (fs) $("foeSkill").innerHTML = (battle.fx && battle.fx.silence)
    ? `<span class="k-chip">技能失效</span> <s>${FOE_SKILLS[fs].name}</s>：鯨之歌讓牠的技能沒有作用了！`
    : `<span class="k-chip k-chip--math">技能</span> <b>${FOE_SKILLS[fs].name}</b>：${FOE_SKILLS[fs].desc}`;
}

async function startWild(useIncense = false) {
  if (S.lockUntil > Date.now()) { showGuessLock(); return; }
  const pool = wildOf(curBld);
  let r = Math.random(), mon = pool[0];
  for (const m of pool) { r -= RARITY[m.rarity].chance; if (r < 0) { mon = m; break; } }
  if (useIncense) {
    if (G.incense < 1) {
      showResult({ title: "你沒有傳說薰香", text: `到「商店」用 ${INCENSE_PRICE} 金幣就能買一個。` });
      return;
    }
    const legend = pool.filter(m => m.rarity === 2);
    mon = legend[Math.floor(Math.random() * legend.length)];
    G.incense -= 1;
    renderStatus();
  }
  const hp = WEAKEN_HITS[tierOf(mon.b)][mon.rarity];
  battle = { kind: "wild", foe: mon, hp, maxHp: hp, wrong: 0, pool: curBld, asked: [], canThrow: false, fx: newFx(), shield: 0, used: {} };
  setFoeHeader();
  openBattle();
  showQuestion();
  if (useIncense) { syncActive(); await save(); }
}

function startGuardian(gid) {
  if (S.lockUntil > Date.now()) { showGuessLock(); return; }
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
  const team = G.team.filter(id => MON(id) && canFight(id)).slice(0, 2);
  battle = {
    kind: "guard", foe: g, hp: g.hp, maxHp: g.hp, team,
    used: {}, shield: 0, power: false, fx: newFx(), pool: (g.final || g.lv) ? "all" : g.b, asked: []
  };
  setFoeHeader();
  openBattle();
  showQuestion();
}

function resumeBattle() {
  const a = S.active;
  const foe = MON(a.foe);
  if (!foe) { S.active = null; return; }
  curBld = a.bld || foe.b;
  battle = {
    kind: a.kind, foe, hp: a.hp, maxHp: a.maxHp, wrong: a.wrong || 0, canThrow: !!a.canThrow,
    team: (a.team || []).filter(id => MON(id) && countOf(id) > 0 && !isResting(id)),
    used: a.used || {}, shield: Number(a.shield) || 0, power: !!a.power, fx: Object.assign(newFx(), a.fx || {}),
    pool: a.pool || foe.b, asked: Array.isArray(a.asked) ? a.asked : [], qid: a.qid
  };
  if (!Array.isArray(battle.fx.fallen)) battle.fx.fallen = [];
  if (battle.kind === "guard" && battle.team.length === 0) {   // 夥伴已經都倒下
    S.active = null; battle = null; save(); return;
  }
  setFoeHeader();
  openBattle();
  if (battle.kind === "wild" && battle.canThrow) showWeakened();
  else showQuestion(true);
  showResult({ title: "接著打！", text: "上一場戰鬥還沒結束，從剛剛的地方繼續。" });
}

const aliveTeam = () => battle.team.filter(id => countOf(id) > 0 && !isResting(id) && heartsLeft(id) > 0);

// 答對一題的傷害：基本傷害＋出戰夥伴的攻擊力＋招式加成
function damagePerHit() {
  const fx = battle.fx;
  let d = BASE_DAMAGE + aliveTeam().reduce((sum, id) => sum + attackOf(id), 0);
  if (fx.gear > 0) d += GEAR_BONUS;
  if (fx.rhythm > 0) d += RHYTHM_BONUS[fx.rhythm - 1];
  let mult = 1;
  if (battle.power) mult *= 2;
  if (fx.inf > 0) mult *= 1.5;
  return Math.round(d * mult);
}
// 守護精靈的防禦技能：能量護盾、防火牆
function foeDefense(d) {
  const fx = battle.fx, fs = activeFoeSkill();
  fx.hits += 1;
  if (fs === "eshield" && fx.hits <= 2) return { d: Math.ceil(d / 2), note: "（能量護盾：只有一半）" };
  if (fs === "firewall" && fx.hits % 3 === 0) return { d: 0, note: "（被防火牆擋下了！）" };
  return { d, note: "" };
}
// 血量第一次掉到一半以下：臨時加固（教室守護精靈）、∞再生（怪獸∞號）
function foeRecover() {
  const b = battle, fx = b.fx;
  if (fx.patched || b.hp <= 0 || b.hp > b.maxHp / 2) return "";
  if (isCampusBoss(b.foe)) {
    fx.patched = true;
    b.hp = Math.min(b.maxHp, b.hp + CAMPUS_BOSS_REGEN);
    return `怪獸∞號使出「∞再生」，回復 ${CAMPUS_BOSS_REGEN} 點血量！`;
  }
  if (activeFoeSkill() === "patch") {
    fx.patched = true;
    const add = Math.round(b.maxHp * FOE_PATCH_RATE);
    b.hp = Math.min(b.maxHp, b.hp + add);
    return `${b.foe.name} 使出「臨時加固」，回復 ${add} 點血量！`;
  }
  return "";
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
    const fx = b.fx;
    $("foeHpText").textContent = `血量 ${Math.max(0, b.hp)} / ${b.maxHp}`;
    const chip = (t, c) => `<span class="k-chip ${c || "k-chip--math"}">${t}</span>`;
    $("myHearts").innerHTML =
      (b.shield ? chip(b.shield > 1 ? `護盾 ×${b.shield}` : "護盾中") : "") +
      (b.power ? chip("下一擊×2", "k-chip--yellow") : "") +
      (fx.inf > 0 ? chip(`傷害×1.5 還有 ${fx.inf} 次`, "k-chip--yellow") : "") +
      (fx.gear > 0 ? chip(`齒輪 +${GEAR_BONUS} 還有 ${fx.gear} 次`, "k-chip--yellow") : "") +
      (fx.rhythm > 0 ? chip(`節奏：下一擊 +${RHYTHM_BONUS[fx.rhythm - 1]}`, "k-chip--yellow") : "") +
      (fx.armor > 0 ? chip(`暫時愛心 ×${fx.armor}`) : "") +
      (fx.backup ? chip("雲端備份中") : "") +
      (fx.silence ? chip("鯨之歌：技能失效") : "");
    const alive = aliveTeam();
    $("myTeam").innerHTML = b.team.map(id => {
      const m = MON(id);
      const up = alive.includes(id);
      const skill = isGuardian(id) ? m.skill : null;
      const front = up && alive[0] === id;
      const label = skill === "copy" && fx.last ? `${SKILLS.copy.name}（${SKILLS[fx.last].name}）` : skill ? SKILLS[skill].name : "";
      return `
        <div class="flex items-center gap-2 border-2 border-[#1E2A33] rounded-xl p-1.5 pr-2 ${up ? "bg-white" : "bg-[#EEF2F6] opacity-50"}">
          <div class="w-11 k-mon-img"><img src="${monsterImg(id)}" alt="" /></div>
          <div class="leading-tight">
            <div class="text-sm font-bold">${m.name}${front ? ' <span class="text-[10px] k-chip k-chip--yellow">前</span>' : ""}</div>
            <div class="leading-none">${up ? heartsHtml(id, true) : '<span class="text-[11px] font-bold">倒下了</span>'}</div>
            ${skill && up ? `<button onclick="useSkill('${id}')" class="k-skill k-btn k-btn--sm mt-1 ${b.used[id] ? "is-used" : ""}" title="${SKILLS[skill].desc}">${label}</button>` : ""}
          </div>
        </div>`;
    }).join("");
    const lv = b.foe.lv, fs = activeFoeSkill();
    let atk = lv === 1 ? `${Math.floor(damagePerHit() * 0.85)} 點（被削弱成 85%）` : lv === 2 ? `${damagePerHit()} 點的 50%～120%` : `${damagePerHit()} 點`;
    if (fs === "eshield" && fx.hits < 2) atk = `${Math.ceil(damagePerHit() / 2)} 點（能量護盾：一半）`;
    if (fs === "firewall" && (fx.hits + 1) % 3 === 0) atk = `0 點（這一擊會被防火牆擋下）`;
    const hurt = lv === 3 ? "站在前面的夥伴少 2 顆愛心" : (lv === 4 || isCampusBoss(b.foe)) ? "出戰的夥伴全部倒下" : fs === "quake" ? "站在前面的夥伴少 2 顆愛心" : "站在前面的夥伴少 1 顆愛心";
    $("battleHint").textContent = `每答對一題攻擊 ${atk}；答錯時，${hurt}${fs === "regen" ? "，而且牠會回復 " + FOE_REGEN_HP + " 點血量" : ""}。`;
  }
  if ($("skillMsg")) $("skillMsg").classList.toggle("hidden", !b.skillMsg || b.kind === "wild");
  if ($("skillMsg") && b.skillMsg) $("skillMsg").textContent = b.skillMsg;
}

/* ---------- 夥伴的招式 ---------- */
// 回傳 { ok, msg }；ok 為 false 時不會用掉招式
function applySkill(key) {
  const b = battle, fx = b.fx;
  const needQ = () => b.answered ? { ok: false, msg: "等下一題出來再用吧！" } : null;
  const hurtAlive = () => aliveTeam().filter(x => (G.hurt[x] || 0) > 0);
  switch (key) {
    case "cut": case "patrol": {
      const no = needQ(); if (no) return no;
      const n = key === "patrol" ? 2 : 1;
      const wrongs = shuffle([...document.querySelectorAll(".gq-opt[data-ok='0']:not(.is-cut)")]);
      if (!wrongs.length) return { ok: false, msg: "已經沒有錯的選項可以拿掉了。" };
      wrongs.slice(0, n).forEach(w => w.classList.add("is-cut"));
      return { ok: true, msg: `拿掉了 ${Math.min(n, wrongs.length)} 個錯的選項！` };
    }
    case "shield": case "balloon": b.shield += 1; return { ok: true, msg: "下一次答錯不會受傷！" };
    case "tentacle": b.shield += 2; return { ok: true, msg: "接下來 2 次答錯都不會受傷！" };
    case "power": case "angel": b.power = true; return { ok: true, msg: "下一次答對，傷害變兩倍！" };
    case "magic": b.shield += 1; b.power = true; return { ok: true, msg: "下一次答錯不會受傷，下一次答對傷害變兩倍！" };
    case "inf": fx.inf = 3; return { ok: true, msg: "接下來 3 次答對，傷害都變 1.5 倍！" };
    case "gear": fx.gear = 3; return { ok: true, msg: `接下來 3 次答對，每次多 ${GEAR_BONUS} 點傷害！` };
    case "rhythm": fx.rhythm = 1; return { ok: true, msg: "節奏開始！連續答對，傷害越來越高！" };
    case "heal": case "photo": {
      const h = hurtAlive().sort((x, y) => heartsLeft(x) - heartsLeft(y));
      if (!h.length) return { ok: false, msg: "大家的愛心都是滿的，等有夥伴受傷再用吧！" };
      G.hurt[h[0]] -= 1;
      if (G.hurt[h[0]] <= 0) delete G.hurt[h[0]];
      return { ok: true, msg: `${MON(h[0]).name} 補了 1 顆愛心！` };
    }
    case "forest": {
      const h = hurtAlive();
      if (!h.length) return { ok: false, msg: "大家的愛心都是滿的，等有夥伴受傷再用吧！" };
      h.forEach(x => { G.hurt[x] -= 1; if (G.hurt[x] <= 0) delete G.hurt[x]; });
      return { ok: true, msg: `${h.map(x => MON(x).name).join("、")} 各補了 1 顆愛心！` };
    }
    case "rocket": {
      b.hp -= ROCKET_DAMAGE;
      hitFoe();
      const rec = foeRecover();
      return { ok: true, msg: `火箭發射！直接造成 ${ROCKET_DAMAGE} 點傷害！` + (rec ? " " + rec : "") };
    }
    case "swap": {
      const no = needQ(); if (no) return no;
      return { ok: true, msg: "換了一題新的！", swap: true };
    }
    case "backup": fx.backup = true; return { ok: true, msg: "雲端備份好了！下一隻倒下的夥伴會自動復活。" };
    case "whale":
      if (b.foe.lv) return { ok: false, msg: "鯨之歌對 Boss 沒有用，留到打守護精靈的時候再用吧！" };
      if (!foeSkillOf(b.foe)) return { ok: false, msg: "這隻守護精靈沒有技能，留到下次再用吧！" };
      fx.silence = true; return { ok: true, msg: `${b.foe.name} 的技能失效了！` };
    case "repair": {
      const alive = aliveTeam();
      const down = fx.fallen.filter(x => !alive.includes(x) && b.team.includes(x));
      if (!down.length) return { ok: false, msg: "現在沒有倒下的夥伴，等需要的時候再用吧！" };
      const id = down[0];
      if (isGuardian(id)) delete G.restUntil[id];
      else { G.caught[id] = (G.caught[id] || 0) + 1; G.everCaught[id] = true; if (!G.team.includes(id)) G.team.push(id); }
      G.hurt[id] = maxHeartsOf(id) - 1;
      if (!G.hurt[id]) delete G.hurt[id];
      fx.fallen = fx.fallen.filter(x => x !== id);
      return { ok: true, msg: `${MON(id).name} 修好了，以 1 顆愛心回到戰場！` };
    }
    case "armor": fx.armor += 1; return { ok: true, msg: "站在前面的夥伴多了 1 顆暫時的愛心！" };
    default: return { ok: false, msg: "這個招式現在不能用。" };
  }
}
async function useSkill(id) {
  const b = battle;
  if (!b || b.kind === "wild" || b.used[id] || heartsLeft(id) <= 0) return;
  const own = MON(id).skill;
  let key = own;
  if (own === "copy") {
    key = b.fx.last;
    if (!key) { showResult({ title: "還沒有招式可以複製", text: "先讓其他夥伴用一次招式，再來列印複製！" }); return; }
  }
  const r = applySkill(key);
  if (!r.ok) { showResult({ title: "現在不能用", text: r.msg }); return; }
  b.used[id] = true;
  if (own !== "copy") b.fx.last = key;
  b.skillMsg = `${MON(id).name}：${own === "copy" ? `複製「${SKILLS[key].name}」！` : ""}${r.msg}`;
  setFoeHeader();
  renderBattleSide();
  if (r.swap) { showQuestion(); return; }
  syncActive();
  await save();
  if (b.hp <= 0) {     // 火箭發射打倒了對手
    $("gqFeedback").classList.add("hidden");
    if (b.foe.lv) await winBoss(); else await winGuardian();
  }
}

// 夥伴倒下：怪獸消失一隻，守護精靈去休息（雲端備份會讓牠以 1 顆愛心復活）
function knockOut(id) {
  if (battle && battle.fx && battle.fx.backup) {
    battle.fx.backup = false;
    G.hurt[id] = maxHeartsOf(id) - 1;
    if (!G.hurt[id]) delete G.hurt[id];
    return `雲端備份啟動！${MON(id).name} 以 1 顆愛心復活了！`;
  }
  delete G.hurt[id];
  const name = MON(id).name;
  if (battle && battle.fx && !battle.fx.fallen.includes(id)) battle.fx.fallen.push(id);
  if (isGuardian(id)) {
    G.restUntil[id] = Date.now() + GUARDIAN_REST_HOURS * HOUR;
    return `${name} 倒下了，要休息 ${GUARDIAN_REST_HOURS} 小時才能再出戰。`;
  }
  G.caught[id] = Math.max(0, (G.caught[id] || 0) - 1);
  if (!G.caught[id]) G.team = G.team.filter(x => x !== id);
  return `${name} 倒下了，永遠離開了你…`;
}
// 前面的夥伴受傷 n 顆愛心（最多扣到這隻倒下，不會打到第二隻）；紙箱盾牌的暫時愛心先擋
function hurtFront(n = 1) {
  const front = aliveTeam()[0];
  if (!front) return "";
  const fx = battle.fx;
  let note = "";
  if (fx.armor > 0) {
    const absorb = Math.min(fx.armor, n);
    fx.armor -= absorb;
    n -= absorb;
    note = `紙箱盾牌擋下了 ${absorb} 顆愛心的傷害。`;
    if (n <= 0) return note;
  }
  const hit = Math.min(n, heartsLeft(front));
  G.hurt[front] = (G.hurt[front] || 0) + hit;
  if (heartsLeft(front) > 0) return note + `${MON(front).name} 少了 ${hit} 顆愛心。`;
  return note + knockOut(front);
}
// 地獄級高第、怪獸∞號：出戰的夥伴全部倒下
function hurtAll() {
  return aliveTeam().map(id => { G.hurt[id] = maxHeartsOf(id); return knockOut(id); }).join(" ");
}

/* ================= 作答 ================= */
async function answer(btn) {
  const b = battle;
  if (!b || b.answered) return;
  if (S.lockUntil > Date.now()) { showGuessLock(); return; }
  b.answered = true;
  b.skillMsg = "";
  const ok = btn.dataset.ok === "1";
  const q = b.q;
  document.querySelectorAll(".gq-opt").forEach(x => (x.disabled = true));
  btn.classList.add(ok ? "is-right" : "is-wrong");
  if (!ok) document.querySelector(".gq-opt[data-ok='1']").classList.add("is-right");

  // 記錄
  S.answered += 1;
  let coinGain = 0;
  let lockNow = false;
  if (ok) {
    S.correct += 1;
    if (!S.correctIds.includes(q.id)) S.correctIds.push(q.id);
    S.wrongTimes = [];
    coinGain = grantCoins(1);
  } else {
    S.wrongCounts[q.id] = (S.wrongCounts[q.id] || 0) + 1;
    const now = Date.now();
    S.wrongTimes = S.wrongTimes.filter(t => now - t < GUESS_WINDOW_SEC * 1000);
    S.wrongTimes.push(now);
    if (S.wrongTimes.length >= GUESS_WRONG_LIMIT) {
      S.lockUntil = now + GUESS_LOCK_SEC * 1000;
      S.lockCount += 1;
      S.wrongTimes = [];
      lockNow = true;
    }
  }
  S.logs.unshift({ id: q.id, ok, at: Date.now() });
  S.logs = S.logs.slice(0, 30);

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
    const fx = b.fx;
    if (ok) {
      let d = damagePerHit(), note = "";
      if (isGaudiBoss(b.foe)) ({ d, note } = bossDamage(d));
      else ({ d, note } = foeDefense(d));
      b.power = false;
      if (fx.gear > 0) fx.gear -= 1;
      if (fx.inf > 0) fx.inf -= 1;
      if (fx.rhythm > 0) fx.rhythm = fx.rhythm >= 3 ? 0 : fx.rhythm + 1;
      b.hp -= d;
      if (d > 0) hitFoe();
      title = `答對了！攻擊 ${d} 點${note}`;
      extra = foeRecover();
    } else {
      fx.rhythm = 0;
      const fs = activeFoeSkill();
      if (b.shield > 0) {
        b.shield -= 1;
        title = "答錯了，但是護盾擋住了！";
      } else if (b.foe.lv === 4) {
        title = "答錯了！高第使出「建築雨」！";
        extra = hurtAll();
      } else if (isCampusBoss(b.foe)) {
        title = "答錯了！怪獸∞號使出「無限黑洞」！";
        extra = hurtAll();
      } else if (b.foe.lv === 3) {
        title = "答錯了！高第使出「重擊」！";
        extra = hurtFront(2);
      } else if (fs === "quake") {
        title = `答錯了！${b.foe.name} 使出「震耳欲聾」！`;
        extra = hurtFront(2);
      } else {
        title = "答錯了！";
        extra = hurtFront();
      }
      if (fs === "regen" && b.hp > 0 && b.hp < b.maxHp) {
        const add = Math.min(FOE_REGEN_HP, b.maxHp - b.hp);
        b.hp += add;
        extra += `${extra ? " " : ""}${b.foe.name} 使出「自我修復」，回復 ${add} 點血量。`;
      }
    }
  }
  $("gqFbTitle").textContent = title + (coinGain ? `（+${coinGain} 金幣）` : "");
  $("gqFbTitle").className = "k-display text-xl " + (ok ? "text-[#1F7A4D]" : "text-[#C23A26]");
  $("gqFbText").innerHTML = (extra ? `<b class="text-[#C23A26]">${escapeHtml(extra)}</b><br/>` : "") +
    (ok ? "" : `<b>正確答案：</b>${fmtQ(q.a)}<br/>`) + `<b>解析：</b>${fmtQ(q.e)}`;
  const fb = $("gqFeedback");
  fb.classList.remove("hidden", "is-right", "is-wrong");
  fb.classList.add(ok ? "is-right" : "is-wrong");
  const ending = b.kind === "wild" ? (b.wrong >= 3 || b.canThrow) : (b.hp <= 0 || aliveTeam().length === 0);
  $("btnNext").textContent = b.kind === "wild" && b.canThrow ? "要怎麼做？" : (ending ? "看結果" : "下一題");
  setFoeHeader();
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
  if (S.lockUntil > Date.now()) { showGuessLock(); return; }
  if (b.kind === "wild") {
    if (b.wrong >= 3) {
      const name = b.foe.name;
      await closeBattle();
      showResult({ title: `${name} 逃走了`, text: "沒關係，再出發探索一次吧！" });
      return;
    }
    if (b.canThrow) { showWeakened(); return; }
  } else {
    if (b.hp <= 0) { if (b.foe.lv) await winBoss(); else await winGuardian(); return; }
    if (aliveTeam().length === 0) {
      const name = b.foe.name;
      await closeBattle();
      showResult({ title: "這次輸了", text: b.foe.lv
        ? `出戰的夥伴都倒下了。${name} 好強！把解析再讀一讀，夥伴休息好或再收服新的夥伴，就可以再挑戰。`
        : `出戰的夥伴都倒下了。${name} 好強！把解析再讀一讀，收服更強的夥伴再來挑戰。` });
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
    ? `成功率 ${pct(r.catchN)}・你有 ${G.balls.n} 個`
    : `${r.name}怪獸抓不到`;
  $("actS").innerHTML = `成功率 ${pct(r.catchS)}・你有 ${G.balls.s} 個`;
  $("actD").innerHTML = `得到 ${r.defeatCoins} 金幣`;
  $("btnCatchN").disabled = r.catchN <= 0 || G.balls.n < 1;
  $("btnCatchS").disabled = G.balls.s < 1;
  ["btnCatchN", "btnCatchS"].forEach(id => ($(id).style.opacity = $(id).disabled ? ".45" : ""));
  $("weakHint").textContent = (G.balls.n + G.balls.s === 0) ? `你沒有${BALL_NAME.n}和${BALL_NAME.s}了，可以在下面直接用金幣買。` : "";
  $("weakBuyN").classList.toggle("hidden", r.catchN <= 0);
  $("weakBuyCoins").textContent = stu.coins || 0;
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
  endBattleView();
  await save(got);
  renderAll();
  showResult({
    title: `擊敗了 ${name}！`,
    text: got ? `得到 ${got} 金幣。` : `今天的金幣已經拿滿 ${DAILY_CAP} 個了，明天再來賺吧！`
  });
}

async function winGuardian() {
  const g = battle.foe;
  const first = !G.beaten[g.id];
  G.beaten[g.id] = true;
  const bonus = first ? grantCoins(5) : 0;
  if (g.final && first) G.cleared = true;
  endBattleView();
  await save(bonus);
  renderAll();
  const b = BLD(g.b);
  const bIdx = bldIndex(g.b);
  let text;
  if (g.final) text = "你打敗了聖家堂守護神，完成了高第的魔法建築之旅！你是真正的高第小專家！";
  else if (!first) text = "又贏了一次，越來越厲害了！";
  else {
    text = `${g.name} 成為你的夥伴！愛心 ${g.hearts} 顆，攻擊 ${attackOf(g.id)}，招式：${SKILLS[g.skill].name}（${SKILLS[g.skill].desc}）。`;
    if (!CAMPUS && b.guardians[2] === g.id && PLACES[bIdx + 1]) {
      text += teacherOpened(bIdx + 1)
        ? `\n「${PLACES[bIdx + 1].name}」開放了！`
        : `\n下一站「${PLACES[bIdx + 1].name}」要等老師開放喔！`;
    }
    if (CAMPUS && b.guardians.every(x => G.beaten[x])) text += `\n${b.name}的 3 隻守護精靈都打敗了，太厲害了！`;
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
    const left = Math.ceil((S.lockUntil - Date.now()) / 1000);
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
