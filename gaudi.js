/* =========================================================
   高第的魔法建築｜遊戲程式
   學生進度存在學生資料的 gaudi 欄位，金幣和盲盒店共用
   ========================================================= */
let stu = null;      // 目前登入的學生
let G = null;        // stu.gaudi 的捷徑
let curBld = null;   // 目前所在的建築 id
let battle = null;   // 進行中的戰鬥
let pendingGuardian = null;
let teamPick = [];
let resultCallback = null;

const $ = id => document.getElementById(id);
const BLD = id => BUILDINGS.find(b => b.id === id);
const MON = id => WILD.find(m => m.id === id) || GUARDIANS.find(m => m.id === id);
const isGuardian = id => id.startsWith("g");

/* ---------- 進度資料 ---------- */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function ensureGaudi(s) {
  const g = (s.gaudi && typeof s.gaudi === "object") ? s.gaudi : {};
  const num = k => { g[k] = Number(g[k]) || 0; };
  ["answered", "correct", "dayCoins", "lockUntil", "lockCount"].forEach(num);
  if (!Array.isArray(g.correctIds)) g.correctIds = [];
  if (!g.wrongCounts || typeof g.wrongCounts !== "object") g.wrongCounts = {};
  if (!g.caught || typeof g.caught !== "object") g.caught = {};
  if (!g.beaten || typeof g.beaten !== "object") g.beaten = {};
  if (!g.balls || typeof g.balls !== "object") g.balls = { n: 0, s: 0 };
  g.balls.n = Number(g.balls.n) || 0;
  g.balls.s = Number(g.balls.s) || 0;
  if (!Array.isArray(g.team)) g.team = [];
  if (!Array.isArray(g.wrongTimes)) g.wrongTimes = [];
  if (!Array.isArray(g.logs)) g.logs = [];
  g.starterGiven = !!g.starterGiven;
  g.cleared = !!g.cleared;
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
  const room = Math.max(0, GAUDI_DAILY_COIN_CAP - G.dayCoins);
  const got = Math.min(n, room);
  G.dayCoins += got;
  return got;
}

const owned = id => isGuardian(id) ? !!G.beaten[id] : (G.caught[id] || 0) > 0;
const progressUnlocked = i => i === 0 || !!G.beaten[BUILDINGS[i - 1].guardians[2]];
const teacherOpened = i => i < getGaudiOpen(stu);   // 老師在教師端設定開放到第幾棟
const bldUnlocked = i => teacherOpened(i) && progressUnlocked(i);
const bldIndex = id => BUILDINGS.findIndex(b => b.id === id);

/* ---------- 開始 ---------- */
window.onPageReady = async () => {
  document.querySelectorAll(".jsDailyCap").forEach(e => (e.textContent = GAUDI_DAILY_COIN_CAP));
  document.querySelectorAll(".jsPriceN").forEach(e => (e.textContent = BALL_PRICE.n));
  document.querySelectorAll(".jsPriceS").forEach(e => (e.textContent = BALL_PRICE.s));
  document.querySelectorAll(".jsGuessLimit").forEach(e => (e.textContent = GUESS_WRONG_LIMIT));
  const s = await loadSessionStudentOrRedirect();
  if (!s) return;
  stu = s;
  if (getGaudiOpen(stu) < 1) {
    showResult({ title: "老師還沒開放", text: "這個遊戲還沒開放給你，先去玩分數盲盒店吧！" }, gBackToMenu);
    return;
  }
  G = ensureGaudi(stu);
  $("viewGame").classList.remove("hidden");
  $("gStuId").textContent = stu.id;
  $("gStuName").textContent = stu.name || "";
  renderAll();
  if (!G.starterGiven) {
    G.starterGiven = true;
    G.balls.n += STARTER_BALLS;
    await save();
    renderStatus();
    showResult({
      title: "歡迎來到巴塞隆納！",
      text: `送你 ${STARTER_BALLS} 顆普通球。先到「米拉之家」探索，收服第一隻怪獸當夥伴，再去挑戰守護精靈吧！`
    });
  }
  if (G.lockUntil > Date.now()) showGuessLock();
};

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
  $("gCaughtCount").textContent = WILD.filter(m => owned(m.id)).length;
}

function gTab(name) {
  ["map", "team", "shop", "rank"].forEach(t => {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    $("gPane" + cap).classList.toggle("hidden", t !== name);
    $("gTab" + cap).classList.toggle("is-active", t === name);
  });
  if (name === "team") renderDex();
  if (name === "rank") renderRank();
  if (name === "shop") renderStatus();
}

/* ---------- 地圖 ---------- */
function renderMap() {
  $("mapGrid").innerHTML = BUILDINGS.map((b, i) => {
    const open = bldUnlocked(i);
    const beatenN = b.guardians.filter(g => G.beaten[g]).length;
    const caughtN = WILD.filter(m => m.b === b.id && owned(m.id)).length;
    const done = beatenN === 3;
    const cls = !open ? "is-locked" : (done ? "is-done" : "");
    const status = !open
      ? `<span class="k-chip mt-2">${teacherOpened(i) ? "還沒開放" : "老師還沒開放"}</span>`
      : `<span class="k-chip ${done ? "k-chip--yellow" : "k-chip--chi"} mt-2">${done ? "完成！" : `精靈 ${beatenN}/3・怪獸 ${caughtN}/5`}</span>`;
    return `
      <button class="k-bld ${cls}" onclick="enterBuilding('${b.id}')" aria-label="${b.name}${open ? "" : "（還沒開放）"}">
        <span class="k-bld-step">${i + 1}</span>
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

function monCard(id, size = "") {
  const m = MON(id);
  const have = owned(id);
  const cnt = !isGuardian(id) && G.caught[id] > 1 ? `<span class="k-toy-count">×${G.caught[id]}</span>` : "";
  return `
    <div class="text-center ${size}">
      <div class="k-mon-img border-[2.5px] border-[#1E2A33] relative">
        <img src="${have ? monsterImg(id) : silhouetteImg(id)}" alt="${have ? m.name : "還沒收服"}" loading="lazy" />${cnt}
      </div>
      <div class="text-xs font-bold mt-1 leading-tight ${have ? "" : "text-[#8C9AA6]"}">${have ? m.name : "？？？"}</div>
    </div>`;
}

function renderBuilding() {
  const b = BLD(curBld);
  $("bvArt").innerHTML = BUILDING_ART[b.id];
  $("bvName").textContent = b.name;
  $("bvSub").textContent = b.sub;
  const beatenN = b.guardians.filter(g => G.beaten[g]).length;
  $("bvProgress").textContent = `守護精靈 ${beatenN} / 3`;
  $("bvWild").innerHTML = WILD.filter(m => m.b === b.id).map(m => monCard(m.id)).join("");
  $("bvGuards").innerHTML = b.guardians.map((gid, j) => {
    const g = MON(gid);
    const beaten = !!G.beaten[gid];
    const open = j === 0 || G.beaten[b.guardians[j - 1]];
    let btn;
    if (beaten) btn = `<button onclick="startGuardian('${gid}')" class="k-btn k-btn--sm">再打一次</button>`;
    else if (open) btn = `<button onclick="startGuardian('${gid}')" class="k-btn k-btn--tomato px-4 py-2">挑戰</button>`;
    else btn = `<span class="k-chip">先打敗前一隻</span>`;
    return `
      <div class="flex flex-wrap items-center gap-3 p-2 rounded-2xl border-2 ${beaten ? "border-[#1E2A33] bg-[#FFF4CC]" : "border-dashed border-[#9AA8B4] bg-white"}">
        <div class="w-16 shrink-0 k-mon-img border-[2.5px] border-[#1E2A33]"><img src="${beaten || open ? monsterImg(gid) : silhouetteImg(gid)}" alt="" loading="lazy" /></div>
        <div class="flex-1 min-w-0">
          <div class="k-display text-lg leading-tight">${beaten || open ? g.name : "？？？"}${g.final ? ' <span class="k-chip k-chip--yellow">最終魔王</span>' : ""}</div>
          <div class="text-xs font-bold text-[#5B6B78] mt-0.5">${beaten ? "已打敗・招式：" + SKILLS[g.skill].name : "血量 " + g.hp}</div>
        </div>
        ${btn}
      </div>`;
  }).join("");
}

/* ---------- 我的夥伴 ---------- */
function renderDex() {
  renderTeamNow();
  $("dexList").innerHTML = BUILDINGS.map((b, i) => `
    <div>
      <h4 class="k-display text-lg mb-2">${i + 1}. ${b.name}</h4>
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
        ${WILD.filter(m => m.b === b.id).map(m => monCard(m.id)).join("")}
        ${b.guardians.map(g => monCard(g)).join("")}
      </div>
    </div>`).join("");
}

function renderTeamNow() {
  const team = G.team.filter(owned);
  $("teamNow").innerHTML = team.length
    ? team.map(id => `<span class="k-chip k-chip--yellow">${MON(id).name}</span>`).join("")
    : `<span class="k-chip">還沒選</span>`;
}

function teamBonus(id) {
  return isGuardian(id) ? GUARDIAN_BONUS : RARITY[MON(id).rarity].bonus;
}
function memberLabel(id) {
  if (isGuardian(id)) return "守護精靈・" + SKILLS[MON(id).skill].name;
  return RARITY[MON(id).rarity].name + (RARITY[MON(id).rarity].bonus ? `・攻擊+${RARITY[MON(id).rarity].bonus}` : "");
}

function openTeamPicker(guardianId) {
  pendingGuardian = guardianId;
  const all = [...WILD, ...GUARDIANS].map(m => m.id).filter(owned);
  if (all.length === 0) {
    showResult({ title: "你還沒有夥伴", text: "先到建築裡「出發探索」，收服一隻怪獸當夥伴，才能挑戰守護精靈。" });
    return;
  }
  teamPick = G.team.filter(owned).slice(0, 2);
  if (teamPick.length === 0) teamPick = all.slice(0, 2);
  $("btnTeamGo").textContent = guardianId ? "出戰" : "決定";
  $("teamHint").textContent = guardianId
    ? `對手：${MON(guardianId).name}（血量 ${MON(guardianId).hp}）。點一下選擇，再點一下取消。`
    : "點一下選擇，再點一下取消。";
  renderTeamPick(all);
  $("modalTeam").classList.remove("hidden");
}

function renderTeamPick(all) {
  all = all || [...WILD, ...GUARDIANS].map(m => m.id).filter(owned);
  $("teamPickGrid").innerHTML = all.map(id => {
    const on = teamPick.includes(id);
    return `
      <button onclick="toggleTeam('${id}')" class="text-center rounded-2xl p-1.5 border-[3px] ${on ? "border-[#1E2A33] bg-[#FFC83D]" : "border-transparent"}">
        <div class="k-mon-img border-[2.5px] border-[#1E2A33]"><img src="${monsterImg(id)}" alt="" /></div>
        <div class="text-sm font-bold mt-1 leading-tight">${MON(id).name}</div>
        <div class="text-[11px] font-bold text-[#5B6B78] leading-tight">${memberLabel(id)}</div>
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
  await save();
  if (pendingGuardian) beginGuardianBattle(pendingGuardian);
}

/* ---------- 商店 ---------- */
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

/* ---------- 排行榜 ---------- */
async function renderRank() {
  $("rankCount").innerHTML = $("rankAcc").innerHTML = `<li class="text-sm font-bold text-[#5B6B78]">讀取中…</li>`;
  let list;
  try {
    list = await fetchAllStudents();
  } catch (e) { reportError("讀取排行榜", e); return; }
  const rows = list.filter(s => !isTestAccount(s.id)).map(s => {
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

/* ---------- 出題 ---------- */
function pickQuestion(bId) {
  let pool = bId === "all" ? GAUDI_QUESTIONS : GAUDI_QUESTIONS.filter(q => q.b === bId);
  const fresh = pool.filter(q => !battle.asked.includes(q.id));
  if (fresh.length) pool = fresh;
  // 優先出還沒答對過的題目
  const notYet = pool.filter(q => !G.correctIds.includes(q.id));
  const src = notYet.length ? notYet : pool;
  return src[Math.floor(Math.random() * src.length)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function showQuestion() {
  const q = pickQuestion(battle.pool);
  battle.q = q;
  battle.answered = false;
  battle.asked.push(q.id);
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
  renderBattleSide();
}

/* ---------- 戰鬥 ---------- */
function openBattle() {
  $("battle").classList.remove("hidden");
  $("battle").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function closeBattle() {
  battle = null;
  $("battle").classList.add("hidden");
  document.body.style.overflow = "";
  renderAll();
}

function startWild() {
  if (G.lockUntil > Date.now()) { showGuessLock(); return; }
  const pool = WILD.filter(m => m.b === curBld);
  let r = Math.random(), mon = pool[0];
  for (const m of pool) { r -= RARITY[m.rarity].chance; if (r < 0) { mon = m; break; } }
  const hp = RARITY[mon.rarity].hp;
  battle = { kind: "wild", foe: mon, hp, maxHp: hp, wrong: 0, pool: curBld, asked: [], canThrow: false };
  $("foeImg").src = monsterImg(mon.id);
  $("foeName").textContent = mon.name;
  $("foeTag").textContent = RARITY[mon.rarity].name + (owned(mon.id) ? "・已收服過" : "・新怪獸");
  $("foeTag").className = "k-chip " + (mon.rarity === 2 ? "k-chip--yellow" : mon.rarity === 1 ? "k-chip--math" : "");
  $("btnLeave").textContent = "逃跑";
  openBattle();
  showQuestion();
}

function startGuardian(gid) {
  if (G.lockUntil > Date.now()) { showGuessLock(); return; }
  openTeamPicker(gid);
}

function beginGuardianBattle(gid) {
  const g = MON(gid);
  const team = G.team.filter(owned).slice(0, 2);
  battle = {
    kind: "guard", foe: g, hp: g.hp, maxHp: g.hp, hearts: PLAYER_HEARTS, team,
    used: {}, shield: false, power: false, pool: g.final ? "all" : g.b, asked: []
  };
  $("foeImg").src = monsterImg(g.id);
  $("foeName").textContent = g.name;
  $("foeTag").textContent = g.final ? "最終魔王" : "守護精靈";
  $("foeTag").className = "k-chip k-chip--yellow";
  $("btnLeave").textContent = "離開";
  openBattle();
  showQuestion();
}

function damagePerHit() {
  let d = BASE_DAMAGE + battle.team.reduce((sum, id) => sum + teamBonus(id), 0);
  if (battle.power) d *= 2;
  return d;
}

function renderBattleSide() {
  const b = battle;
  const pct = Math.max(0, b.hp / b.maxHp * 100);
  $("foeHp").style.width = pct + "%";
  $("foeHp").classList.toggle("is-low", pct <= 34);
  $("foeHpText").textContent = b.kind === "wild"
    ? (b.hp > 0 ? `再答對 ${b.hp} 題，牠就會變虛弱` : "牠變虛弱了！快丟球！")
    : `血量 ${Math.max(0, b.hp)} / ${b.maxHp}`;

  if (b.kind === "wild") {
    $("myHearts").innerHTML = `<span class="text-sm font-bold">牠想逃跑：</span>` +
      [0, 1, 2].map(i => `<span class="k-heart ${i < b.wrong ? "" : "is-empty"}" style="color:${i < b.wrong ? "#8A63D2" : ""}">●</span>`).join("");
    $("myTeam").innerHTML = "";
    $("ballBar").classList.remove("hidden");
    $("bbN").textContent = G.balls.n;
    $("bbS").textContent = G.balls.s;
    $("btnThrowN").disabled = !b.canThrow || G.balls.n < 1;
    $("btnThrowS").disabled = !b.canThrow || G.balls.s < 1;
    $("btnThrowN").style.opacity = $("btnThrowN").disabled ? ".45" : "";
    $("btnThrowS").style.opacity = $("btnThrowS").disabled ? ".45" : "";
    $("btnThrowN").classList.toggle("k-ready", b.canThrow && G.balls.n > 0);
    $("btnThrowS").classList.toggle("k-ready", b.canThrow && G.balls.s > 0);
    $("battleHint").textContent = b.canThrow
      ? (G.balls.n + G.balls.s > 0 ? "選一種球丟出去！" : "你沒有寶貝球了，到商店用金幣買吧。")
      : "答錯 3 次牠就會逃走。";
  } else {
    $("ballBar").classList.add("hidden");
    $("myHearts").innerHTML = Array.from({ length: PLAYER_HEARTS }, (_, i) =>
      `<span class="k-heart ${i < b.hearts ? "" : "is-empty"}">♥</span>`).join("") +
      (b.shield ? `<span class="k-chip k-chip--math ml-2">護盾中</span>` : "") +
      (b.power ? `<span class="k-chip k-chip--yellow ml-2">下一擊×2</span>` : "");
    $("myTeam").innerHTML = b.team.map(id => {
      const m = MON(id);
      const skill = isGuardian(id) ? m.skill : null;
      return `
        <div class="flex items-center gap-2 border-2 border-[#1E2A33] rounded-xl p-1.5 pr-2 bg-white">
          <div class="w-11 k-mon-img"><img src="${monsterImg(id)}" alt="" /></div>
          <div class="leading-tight">
            <div class="text-sm font-bold">${m.name}</div>
            ${skill
              ? `<button onclick="useSkill('${id}')" class="k-skill k-btn k-btn--sm mt-1 ${b.used[id] ? "is-used" : ""}" title="${SKILLS[skill].desc}">${SKILLS[skill].name}</button>`
              : `<div class="text-[11px] font-bold text-[#5B6B78]">${memberLabel(id)}</div>`}
          </div>
        </div>`;
    }).join("");
    $("battleHint").textContent = `每答對一題攻擊 ${damagePerHit()} 點；答錯少 1 顆愛心。`;
  }
}

function useSkill(id) {
  const b = battle;
  if (!b || b.used[id]) return;
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
    if (b.hearts >= PLAYER_HEARTS) { showResult({ title: "愛心是滿的", text: "等少了愛心再用吧！" }); return; }
    b.hearts += 1;
  }
  b.used[id] = true;
  renderBattleSide();
}

/* ---------- 作答 ---------- */
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
  let title, cls;
  if (b.kind === "wild") {
    if (ok) {
      b.hp -= 1;
      if (b.hp <= 0) { b.hp = 0; b.canThrow = true; }
      hitFoe();
      title = b.canThrow ? "答對了！牠變虛弱了，快丟球！" : "答對了！";
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
      b.hearts -= 1;
      title = "答錯了，少了 1 顆愛心";
    }
  }
  $("gqFbTitle").textContent = title + (coinGain ? `（+${coinGain} 金幣）` : "");
  $("gqFbTitle").className = "k-display text-xl " + (ok ? "text-[#1F7A4D]" : "text-[#C23A26]");
  $("gqFbText").innerHTML = (ok ? "" : `<b>正確答案：</b>${escapeHtml(q.a)}<br/>`) + `<b>解析：</b>${escapeHtml(q.e)}`;
  const fb = $("gqFeedback");
  fb.classList.remove("hidden", "is-right", "is-wrong");
  fb.classList.add(ok ? "is-right" : "is-wrong");
  // 野生怪獸變虛弱時，下一步是丟球，不用按繼續
  $("btnNext").classList.toggle("hidden", b.kind === "wild" && b.canThrow);
  const ending = b.kind === "wild" ? b.wrong >= 3 : (b.hp <= 0 || b.hearts <= 0);
  $("btnNext").textContent = ending ? "看結果" : "下一題";
  renderBattleSide();
  renderStatus();
  fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      closeBattle();
      showResult({ title: `${name} 逃走了`, text: "沒關係，再出發探索一次吧！" });
      return;
    }
  } else {
    if (b.hp <= 0) { await winGuardian(); return; }
    if (b.hearts <= 0) {
      const name = b.foe.name;
      closeBattle();
      showResult({ title: "這次輸了", text: `${name} 好強！把解析再讀一讀，換個隊伍再來挑戰。` });
      return;
    }
  }
  showQuestion();
}

async function throwBall(kind) {
  const b = battle;
  if (!b || b.kind !== "wild" || !b.canThrow || G.balls[kind] < 1) return;
  G.balls[kind] -= 1;
  const r = RARITY[b.foe.rarity];
  const chance = kind === "s" ? r.catchS : r.catchN;
  const caught = Math.random() < chance;
  const mon = b.foe;
  if (caught) {
    const isNew = !owned(mon.id);
    G.caught[mon.id] = (G.caught[mon.id] || 0) + 1;
    if (G.team.length < 2 && !G.team.includes(mon.id)) G.team.push(mon.id);
    await save();
    closeBattle();
    showResult({
      img: monsterImg(mon.id),
      title: `收服了 ${mon.name}！`,
      text: isNew ? `新夥伴（${r.name}）加入了！到「我的夥伴」可以看到牠。` : `你已經有 ${G.caught[mon.id]} 隻 ${mon.name} 了。`
    });
  } else {
    b.canThrow = false;
    b.hp = 1;
    await save();
    $("gqFeedback").classList.add("hidden");
    showResult({ title: "牠掙脫了！", text: "再答對 1 題，牠又會變虛弱，到時候再丟一次。" }, () => { if (battle) showQuestion(); });
  }
}

async function winGuardian() {
  const g = battle.foe;
  const first = !G.beaten[g.id];
  G.beaten[g.id] = true;
  const bonus = first ? grantCoins(5) : 0;
  if (g.final && first) G.cleared = true;
  await save(bonus);
  closeBattle();
  const b = BLD(g.b);
  const bIdx = bldIndex(g.b);
  let text;
  if (g.final) text = "你打敗了聖家堂守護神，完成了高第的魔法建築之旅！你是真正的高第小專家！";
  else if (!first) text = "又贏了一次，越來越厲害了！";
  else {
    text = `${g.name} 成為你的夥伴！招式：${SKILLS[g.skill].name}（${SKILLS[g.skill].desc}）。`;
    if (b.guardians[2] === g.id && BUILDINGS[bIdx + 1]) {
      text += teacherOpened(bIdx + 1)
        ? `\n「${BUILDINGS[bIdx + 1].name}」開放了！`
        : `\n下一站「${BUILDINGS[bIdx + 1].name}」要等老師開放喔！`;
    }
  }
  if (bonus) text += `\n得到 ${bonus} 金幣。`;
  showResult({ img: monsterImg(g.id), title: g.final ? "全部通關！" : `打敗了 ${g.name}！`, text });
}

function leaveBattle() {
  if (!battle) return;
  const msg = battle.kind === "wild" ? "確定要逃跑嗎？" : "確定要離開這場戰鬥嗎？（不會扣任何東西）";
  if (confirm(msg)) closeBattle();
}

/* ---------- 彈窗 ---------- */
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

/* ---------- 導覽 ---------- */
function gBackToMenu() { location.href = "index.html"; }
function gLogout() { clearSessionStudent(); location.href = "index.html"; }
