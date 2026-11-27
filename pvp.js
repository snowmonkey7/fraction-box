/* =========================================================
   PvP 競技場：用〈高第的魔法建築〉收服的怪獸和守護精靈線上對戰
   - 公平競技：隨機配對，贏 7 金幣、輸 3 金幣（平手各 5）
   - 自訂對戰：用 4 位數房號找同學對戰，不給金幣
   - 選角順序 A B B A B A A B，各選 4 隻（對方選過的不能選）→ 各禁對手 1 隻 → 3 打 3
   - 兩邊同一題，先答對的攻擊；答錯這題就鎖住
   - 每隻角色有一個技能（pvp-skills.js），每題出現前的 5 秒可以使用
   - 一場最多 5 分鐘，時間到比剩下的夥伴數、再比剩下的血量
   資料都存在同一個集合裡，文件名稱用 _ 開頭（不會被當成學生）：
     （老師在教師端一位一位設定開放：學生資料的 pvpOpen）
     _pvpq_<老師>   ：公平競技的配對區
     _pvp_<房間>    ：一場對戰
   ========================================================= */

/* ---------------- 可以調整的數值 ---------------- */
const PVP_COINS = { win: 7, lose: 3, draw: 5 };   // 公平競技的金幣
const PVP_PICK_ORDER = ["A", "B", "B", "A", "B", "A", "A", "B"];
const PVP_TEAM = 4;               // 每人選幾隻
const PVP_MATCH_SEC = 300;        // 一場最多幾秒（5 分鐘）
const PVP_PICK_SEC = 25;          // 每次選角時間
const PVP_BAN_SEC = 20;           // 禁角時間
const PVP_GONE_SEC = 45;          // 對手多久沒有回應就算斷線
const PVP_NEED = ["g9", "g8", "g7"];   // 要先打完巴特羅之家的守護精靈（解鎖奎爾公園）
// 對戰數值：血量看愛心數、傷害看高第遊戲裡的攻擊力
const pvpHp = id => 70 + 15 * maxHeartsOf(id);
const pvpDmg = id => 20 + attackOf(id);

/* ---------------- 狀態 ---------------- */
let STU = null, G = null, CLS = null, OPEN = false;
let unsubOpen = null, unsubQ = null, unsubRoom = null;
let RID = null, R = null, ME = null, OP = null;   // ME / OP 是 "A" 或 "B"
let L = {};            // 這台平板自己的計時與畫面狀態
let ticker = null, hbTimer = null, qHbTimer = null;

const $ = id => document.getElementById(id);
const MON = id => anyMon(id) || null;
const monName = id => (MON(id) || { name: "?" }).name;
const now = () => Date.now();
const colRef = () => db.collection(COLLECTION_NAME);
const roomRef = rid => colRef().doc(rid);
const qRef = () => colRef().doc("_pvpq_" + CLS);
const openRef = () => colRef().doc(STU.id);   // 自己的學生資料：pvpOpen 由老師設定
const rid8 = () => Math.random().toString(36).slice(2, 10);

// 高第服裝獎勵（從這次更新開始算，只算公平競技）：
//   sw = 累積勝場（滿 5 → 高第‧中級 sk2）、st = 目前連勝（滿 5 → 高第‧高級 sk3；輸了歸零、平手不影響）
const SKIN_NEED = { total: 5, streak: 5 };
function ensurePvp(s) {
  const p = Object.assign({ fw: 0, fl: 0, fd: 0, cw: 0, cl: 0, cd: 0, coins: 0, ans: 0, cor: 0, last: 0, sw: 0, st: 0, sk2: 0, sk3: 0 }, s.pvp || {});
  Object.keys(p).forEach(k => { p[k] = Number(p[k]) || 0; });
  s.pvp = p;
  return p;
}
// 可以上場的角色：收服中的怪獸＋打敗過的守護精靈（含紀念夥伴，兩個遊戲的都算）
function myPool() {
  const g = G || {}, caught = g.caught || {}, beaten = g.beaten || {};
  const out = [];
  allHeroes().forEach(x => { if (beaten[x.id]) out.push(x.id); });
  allGuardians().forEach(x => { if (beaten[x.id]) out.push(x.id); });
  allWild().forEach(x => { if ((Number(caught[x.id]) || 0) > 0) out.push(x.id); });
  return out;
}
// 我的高第穿哪一套服裝（要有服裝也要有高第）
function mySkin() {
  const lv = Number(G && G.heroSkin) || 1;
  return (lv === 2 && STU.pvp.sk2) || (lv === 3 && STU.pvp.sk3) ? lv : 1;
}
const skinOf = side => (R && R[side] && R[side].skin) || 1;
const eligible = () => PVP_NEED.every(id => G && G.beaten && G.beaten[id]);

/* ---------------- 交易小幫手：讀一份文件、改好、整份寫回 ---------------- */
async function txDoc(ref, fn) {
  return db.runTransaction(async t => {
    const snap = await t.get(ref);
    const d = snap.exists ? snap.data() : null;
    const res = fn(d, t);
    if (res && res.write) t.set(ref, res.write);
    return res ? res.ret : undefined;
  });
}
const clone = o => JSON.parse(JSON.stringify(o));

/* =========================================================
   進入頁面
   ========================================================= */
window.onPageReady = async () => {
  STU = await loadSessionStudentOrRedirect();
  if (!STU) return;
  $("pStuId").textContent = STU.id;
  $("pStuName").textContent = STU.name || "";
  renderCoins();
  G = STU.gaudi || {};
  ensurePvp(STU);
  setHeroSkin(mySkin());
  const t = teacherOfStudent(STU.id);
  $("viewLoading").classList.add("hidden");
  if (!isCloudMode || cloudError) { showBlock("連不上雲端", "PvP 要連上網路才能和同學對戰。請確認網路後重新整理。"); return; }
  if (!t) { showBlock("找不到你的班級", "請找老師確認你的座號。"); return; }
  CLS = t.id;
  $("viewLobby").classList.remove("hidden");
  unsubOpen = openRef().onSnapshot(s => {
    OPEN = !!(s.exists && isPvpOpen(s.data()));
    renderLobby();
  }, e => { console.warn(e); });
  renderLobby();
  // 上次對戰還沒打完（重新整理）：接回去
  const back = sessionStorage.getItem("pvp_room");
  if (back) {
    try {
      const s = await roomRef(back).get();
      const d = s.exists ? s.data() : null;
      if (d && d.phase !== "end" && (d.A && d.A.id === STU.id || d.B && d.B.id === STU.id)) enterRoom(back);
      else sessionStorage.removeItem("pvp_room");
    } catch (e) { sessionStorage.removeItem("pvp_room"); }
  }
};
function showBlock(title, text) {
  $("viewBlock").classList.remove("hidden");
  $("blockTitle").textContent = title;
  $("blockText").textContent = text;
}
function renderCoins() { $("pCoins").textContent = STU.coins || 0; }

function renderLobby() {
  const p = STU.pvp;
  $("recFair").textContent = `${p.fw} 勝 ${p.fl} 敗${p.fd ? ` ${p.fd} 平` : ""}`;
  $("recCustom").textContent = `${p.cw} 勝 ${p.cl} 敗${p.cd ? ` ${p.cd} 平` : ""}`;
  $("recCoins").textContent = p.coins;
  if ($("recSkin")) $("recSkin").innerHTML = skinProgressHtml();
  const ok = eligible();
  let msg = "";
  if (!OPEN) msg = "🔒 老師還沒開放競技場給你，等老師開放後就能對戰。";
  else if (!ok) msg = "要先在〈高第的魔法建築〉打敗巴特羅之家的 3 隻守護精靈（解鎖奎爾公園），才能參加對戰。";
  else if (myPool().length < 2) msg = "你的夥伴太少了，先去高第的魔法建築多收服一些吧！";
  $("lobbyMsg").innerHTML = msg ? `<div class="k-note">${msg}</div>` : `<div class="k-note k-note--ok">✅ 競技場開放中！選一種對戰開始吧。</div>`;
  const can = OPEN && ok && myPool().length >= 2;
  ["btnFair", "btnCreate", "btnJoin"].forEach(id => { $(id).disabled = !can; $(id).style.opacity = can ? "" : ".5"; });
  $("myPoolList").innerHTML = myPool().map(id => monChip(id)).join("") || `<p class="text-sm font-bold text-[#8C9AA6]">還沒有夥伴</p>`;
}
function skinProgressHtml() {
  const p = STU.pvp;
  const row = (lv, txt, done) => `<div class="flex items-center gap-2"><img src="${heroSkinImg(lv)}" class="w-9 h-9 rounded-lg border-2 border-[#1E2A33] ${done ? "" : "grayscale opacity-60"}" alt=""/>
    <span class="text-xs font-bold">${HERO_SKINS[lv - 1].name}服裝：${done ? "<b class='text-[#2E9E6A]'>已得到！</b>" : txt}</span></div>`;
  return row(2, `公平競技累積贏 ${Math.min(p.sw, SKIN_NEED.total)} / ${SKIN_NEED.total} 場`, !!p.sk2) +
    row(3, `公平競技連贏 ${Math.min(p.st, SKIN_NEED.streak)} / ${SKIN_NEED.streak} 場（輸了重算，平手不影響）`, !!p.sk3);
}
function monChip(id, extra = "", skin) {
  return `<div class="pv-chip ${extra}"><div class="k-mon-img"><img src="${monsterImg(id, skin)}" alt=""/></div>
    <div class="text-[11px] font-black leading-tight mt-0.5">${escapeHtml(monName(id))}</div>
    <div class="text-[10px] font-bold text-[#5B6B78]">攻 ${pvpDmg(id)}・血 ${pvpHp(id)}</div>
    <div class="pv-skill" title="${escapeHtml(pvpSkillOf(id).desc)}">${pvpSkillOf(id).icon} ${pvpSkillOf(id).name}</div></div>`;
}

/* =========================================================
   公平競技：配對
   ========================================================= */
async function startFair() {
  if (!(await stillOpen())) return;
  showView("viewWait");
  $("waitTitle").textContent = "配對中…";
  $("waitText").textContent = "正在找同樣在等待的同學，找到就會開始。";
  $("waitCode").classList.add("hidden");
  L.waiting = "fair";
  const me = { id: STU.id, name: STU.name || STU.id, t: now(), pool: myPool(), skin: mySkin() };
  let got = null;
  try {
    got = await db.runTransaction(async t => {
      const s = await t.get(qRef());
      const q = s.exists ? s.data() : { w: null, m: {} };
      q.m = q.m || {};
      const w = q.w;
      if (w && w.id !== STU.id && now() - w.t < 20000) {
        const rid = "_pvp_f" + rid8();
        t.set(roomRef(rid), newRoom("fair", { id: w.id, name: w.name, skin: w.skin || 1 }, w.pool, me));
        q.w = null; q.m[w.id] = rid;
        t.set(qRef(), q);
        return rid;
      }
      q.w = me;
      t.set(qRef(), q);
      return null;
    });
  } catch (e) { reportError("配對", e); backLobby(); return; }
  if (got) { enterRoom(got); return; }
  // 等別人來配對：每 5 秒報到一次，並看看有沒有被配到
  qHbTimer = setInterval(() => {
    txDoc(qRef(), q => {
      if (!q || !q.w || q.w.id !== STU.id) return null;
      q.w.t = now();
      return { write: q };
    }).catch(() => {});
  }, 5000);
  unsubQ = qRef().onSnapshot(s => {
    const q = s.exists ? s.data() : null;
    const rid = q && q.m && q.m[STU.id];
    if (rid && L.waiting === "fair") {
      stopQueue();
      txDoc(qRef(), d => { if (!d || !d.m) return null; delete d.m[STU.id]; return { write: d }; }).catch(() => {});
      enterRoom(rid);
    }
  });
}
function stopQueue() {
  L.waiting = null;
  if (unsubQ) { unsubQ(); unsubQ = null; }
  if (qHbTimer) { clearInterval(qHbTimer); qHbTimer = null; }
}
async function cancelWait() {
  const mode = L.waiting;
  stopQueue();
  if (mode === "fair") {
    await txDoc(qRef(), q => { if (!q || !q.w || q.w.id !== STU.id) return null; q.w = null; return { write: q }; }).catch(() => {});
  } else if (mode === "custom" && RID) {
    const rid = RID;
    leaveRoomListen();
    await txDoc(roomRef(rid), d => { if (!d || d.phase !== "wait") return null; d.phase = "end"; d.win = null; d.why = "cancel"; return { write: d }; }).catch(() => {});
  }
  backLobby();
}
async function stillOpen() {
  try {
    const s = await openRef().get();
    OPEN = !!(s.exists && isPvpOpen(s.data()));
  } catch (e) { /* 讀不到就照舊 */ }
  if (!OPEN) { renderLobby(); alert("老師還沒開放競技場喔！"); }
  return OPEN;
}

/* =========================================================
   自訂對戰：建房間、用房號加入
   ========================================================= */
async function createCustom() {
  if (!(await stillOpen())) return;
  let rid = null;
  for (let i = 0; i < 8 && !rid; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const id = "_pvp_c" + code;
    try {
      const ok = await txDoc(roomRef(id), d => {
        if (d && d.phase !== "end" && now() - (d.created || 0) < 3600000) return { ret: false };
        const r = newRoom("custom", { id: STU.id, name: STU.name || STU.id, skin: mySkin() }, myPool(), null);
        r.code = code;
        return { write: r, ret: true };
      });
      if (ok) rid = id;
    } catch (e) { reportError("建立房間", e); return; }
  }
  if (!rid) { alert("房號用完了，請再按一次。"); return; }
  showView("viewWait");
  L.waiting = "custom";
  $("waitTitle").textContent = "房間建好了！";
  $("waitText").textContent = "請想對戰的同學按「輸入房號」，輸入下面的號碼。";
  $("waitCode").textContent = rid.slice(6);
  $("waitCode").classList.remove("hidden");
  enterRoom(rid, true);
}
async function joinCustom() {
  if (!(await stillOpen())) return;
  const code = (prompt("請輸入同學給你的 4 位數房號") || "").trim();
  if (!code) return;
  if (!/^\d{4}$/.test(code)) { alert("房號是 4 個數字喔！"); return; }
  const rid = "_pvp_c" + code;
  let err = null;
  try {
    err = await txDoc(roomRef(rid), d => {
      if (!d || d.phase !== "wait") return { ret: "找不到這個房間，或是已經開始對戰了。" };
      if (d.A.id === STU.id) return { ret: "這是你自己建的房間喔！" };
      if (d.cls !== CLS) return { ret: "只能和同班同學對戰喔！" };
      d.B = { id: STU.id, name: STU.name || STU.id, skin: mySkin() };
      d.pool.B = myPool();
      d.phase = "pick";
      d.hb = { A: now(), B: now() };
      return { write: d, ret: null };
    });
  } catch (e) { reportError("加入房間", e); return; }
  if (err) { alert(err); return; }
  enterRoom(rid);
}

function newRoom(mode, a, poolA, b) {
  return {
    mode, cls: CLS, created: now(),
    A: a, B: b ? { id: b.id, name: b.name, skin: b.skin || 1 } : null,
    pool: { A: poolA || [], B: b ? b.pool : [] },
    phase: b ? "pick" : "wait",
    pi: 0, picks: { A: [], B: [] }, ban: { A: "", B: "" },
    team: { A: [], B: [] }, hp: { A: [], B: [] },
    seed: Math.floor(Math.random() * 1e9), k: 0, lock: { A: false, B: false }, last: null,
    score: { A: 0, B: 0 }, win: null, why: "",
    hb: { A: now(), B: now() }, done: { A: false, B: false },
    fx: { A: {}, B: {} }, used: { A: [], B: [] }, usedK: { A: -1, B: -1 }, slog: []
  };
}

/* =========================================================
   房間：監聽、心跳、畫面
   ========================================================= */
function enterRoom(rid, waitingCustom) {
  RID = rid;
  L = { waiting: waitingCustom ? "custom" : null, phase: null, pi: -1, k: -1, opHb: 0, opHbAt: now(), answered: null };
  sessionStorage.setItem("pvp_room", rid);
  if (!waitingCustom) showView("viewRoom");
  unsubRoom = roomRef(rid).onSnapshot(s => {
    if (!s.exists) return;
    onRoom(s.data());
  }, e => console.warn(e));
  hbTimer = setInterval(() => {
    if (!R || !ME || R.phase === "end" || R.phase === "wait") return;
    roomRef(RID).update({ ["hb." + ME]: now() }).catch(() => {});
  }, 5000);
  if (!ticker) ticker = setInterval(tick, 250);
}
function leaveRoomListen() {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
  RID = null; R = null; ME = null; OP = null;
  sessionStorage.removeItem("pvp_room");
}

function onRoom(d) {
  R = d;
  ME = d.A && d.A.id === STU.id ? "A" : (d.B && d.B.id === STU.id ? "B" : null);
  OP = ME === "A" ? "B" : "A";
  if (!ME) return;
  if (d.phase === "wait") return;           // 還在等同學加入
  if (L.waiting === "custom") { L.waiting = null; showView("viewRoom"); }
  // 對手的心跳：用「我這台收到變化的時間」來算，不怕兩台平板時間不一樣
  const ohb = d.hb ? d.hb[OP] : 0;
  if (ohb !== L.opHb) { L.opHb = ohb; L.opHbAt = now(); }
  if (d.phase !== L.phase) { L.phase = d.phase; L.phaseAt = now(); }
  if (d.phase === "pick" && d.pi !== L.pi) { L.pi = d.pi; L.piAt = now(); }
  if (d.phase === "fight") {
    if (!L.fightAt) L.fightAt = now();
    if (d.k !== L.k) {                       // 新的一題
      L.k = d.k; L.kAt = now(); L.answered = null; L.picked = null; L.qst = null; L.wrongPicks = []; L.retried = false;
      L.showLast = d.last && d.last.k === d.k - 1 ? d.last : null;
    }
  }
  render();
  if (d.phase === "end") finishMatch();
}

/* ---------------- 每 0.25 秒：倒數、逾時 ---------------- */
function tick() {
  if (!R || !ME) return;
  const t = now();
  if (R.phase === "pick" || R.phase === "ban" || R.phase === "fight") {
    // 對手斷線太久：判我贏
    if (t - L.opHbAt > PVP_GONE_SEC * 1000) { L.opHbAt = t; endBy(ME, "gone"); return; }
  }
  if (R.phase === "pick") {
    const left = PVP_PICK_SEC - (t - L.piAt) / 1000;
    setTimer("pickTimer", left);
    const mine = PVP_PICK_ORDER[R.pi] === ME;
    if (left <= (mine ? 0 : -3)) { L.piAt = t + 999999; autoPick(R.pi); }
  } else if (R.phase === "ban") {
    const left = PVP_BAN_SEC - (t - L.phaseAt) / 1000;
    setTimer("banTimer", left);
    if (left <= -1 && !L.banAuto) { L.banAuto = true; autoBan(); }
  } else if (R.phase === "fight") {
    const mLeft = PVP_MATCH_SEC - (t - L.fightAt) / 1000;
    $("matchClock").textContent = fmtClock(Math.max(0, mLeft));
    $("matchClock").classList.toggle("text-[#E8513F]", mLeft < 30);
    if (mLeft <= 0 && !L.timeUp) { L.timeUp = true; endByTime(); return; }
    renderQuestionClock(t);
  }
}
function fmtClock(s) { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function setTimer(id, left) { const el = $(id); if (el) el.textContent = Math.max(0, Math.ceil(left)) + " 秒"; }

/* =========================================================
   選角
   ========================================================= */
const takenAll = () => [...R.picks.A, ...R.picks.B];
function availFor(side) { const tk = takenAll(); return (R.pool[side] || []).filter(id => !tk.includes(id)); }
async function doPick(id) {
  const pi = R.pi;
  if (R.phase !== "pick" || PVP_PICK_ORDER[pi] !== ME) return;
  await txDoc(roomRef(RID), d => {
    if (!d || d.phase !== "pick" || d.pi !== pi) return null;
    const tk = [...d.picks.A, ...d.picks.B];
    if (tk.includes(id) || !(d.pool[ME] || []).includes(id)) return null;
    d.picks[ME].push(id);
    advancePick(d);
    return { write: d };
  }).catch(e => reportError("選角", e));
}
function autoPick(pi) {
  txDoc(roomRef(RID), d => {
    if (!d || d.phase !== "pick" || d.pi !== pi) return null;
    const side = PVP_PICK_ORDER[pi];
    const tk = [...d.picks.A, ...d.picks.B];
    const av = (d.pool[side] || []).filter(id => !tk.includes(id));
    if (av.length) d.picks[side].push(av[Math.floor(Math.random() * av.length)]);
    advancePick(d);
    return { write: d };
  }).catch(() => {});
}
// 下一位選；沒有可以選的就跳過
function advancePick(d) {
  d.pi += 1;
  while (d.pi < PVP_PICK_ORDER.length) {
    const side = PVP_PICK_ORDER[d.pi];
    const tk = [...d.picks.A, ...d.picks.B];
    if ((d.pool[side] || []).some(id => !tk.includes(id))) break;
    d.pi += 1;
  }
  if (d.pi >= PVP_PICK_ORDER.length) {
    d.phase = "ban";
    // 對手只有 1 隻（或沒有）就不用禁
    ["A", "B"].forEach(s => { const o = s === "A" ? "B" : "A"; if (d.picks[o].length <= 1) d.ban[s] = "-"; });
    if (d.ban.A && d.ban.B) startFight(d);
  }
}

/* =========================================================
   禁角
   ========================================================= */
async function doBan(id) {
  if (R.phase !== "ban" || R.ban[ME]) return;
  await txDoc(roomRef(RID), d => {
    if (!d || d.phase !== "ban" || d.ban[ME] || !d.picks[OP].includes(id)) return null;
    d.ban[ME] = id;
    if (d.ban.A && d.ban.B) startFight(d);
    return { write: d };
  }).catch(e => reportError("禁角", e));
}
function autoBan() {
  txDoc(roomRef(RID), d => {
    if (!d || d.phase !== "ban") return null;
    ["A", "B"].forEach(s => {
      const o = s === "A" ? "B" : "A";
      if (!d.ban[s]) d.ban[s] = d.picks[o][Math.floor(Math.random() * d.picks[o].length)] || "-";
    });
    startFight(d);
    return { write: d };
  }).catch(() => {});
}
function startFight(d) {
  ["A", "B"].forEach(s => {
    const o = s === "A" ? "B" : "A";
    d.team[s] = d.picks[s].filter(id => id !== d.ban[o]);
    d.hp[s] = d.team[s].map(pvpHp);
  });
  d.phase = "fight"; d.k = 0; d.lock = { A: false, B: false }; d.last = null;
}

/* =========================================================
   對戰：題目（兩台用同一個種子，算出來的題目一樣）
   ========================================================= */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seededShuffle(arr, seed) { const a = arr.slice(), r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
let ORDER = null, ORDER_SEED = null, QCACHE = {};
// 線對稱（數學第七單元）用圖形出題，只用 4 個選項的題型
const SYM_MAKERS = [qFindSym, qCountAxes, qPairs, qGridChoose, qGridChoose, qGridPoint, qGridPoint, qPolyAxes];
function symQuestion(seed) {
  const real = Math.random;
  Math.random = rng(seed);                 // 兩台平板用同一個種子，畫出來的題目一樣
  try {
    for (let i = 0; i < 20; i++) {
      const x = SYM_MAKERS[Math.floor(Math.random() * SYM_MAKERS.length)]();
      if (x.type === "choice" && x.options.length === 4) return x;
    }
    return qCountAxes();
  } finally { Math.random = real; }
}
// 每一題整理成：題目 HTML、圖、4 個選項 HTML、正確答案是第幾個
function questionAt(k) {
  if (ORDER_SEED !== R.seed) { ORDER = seededShuffle([...PVP_QUESTIONS.keys()], R.seed); ORDER_SEED = R.seed; QCACHE = {}; }
  if (QCACHE[k]) return QCACHE[k];
  const q = PVP_QUESTIONS[ORDER[k % ORDER.length]];
  let out;
  if (q.gen) {
    const x = symQuestion(R.seed + k * 7919);
    out = { q: x.prompt, fig: x.figure || "", opts: x.options.map(o => o.html || escapeHtml(o.text)), ans: x.answer, figOpts: !!x.options[0].html };
  } else {
    const opts = seededShuffle([q.a, ...q.w], R.seed + k * 7919);
    out = { q: fmtQ(q.q), fig: "", opts: opts.map(fmtQ), ans: opts.indexOf(q.a), figOpts: false };
  }
  return (QCACHE[k] = out);
}
// 題目文字：換行、直式分數 [[分子/分母]]、帶分數 [[整數 分子/分母]]
function fmtQ(t) {
  return escapeHtml(t).replace(/\n/g, "<br/>").replace(/\[\[(?:(\d+) )?(\d+)\/(\d+)\]\]/g, (m, w, n, d) =>
    `${w ? `<span class="fr-w">${w}</span>` : ""}<span class="fr"><span>${n}</span><span>${d}</span></span>`);
}
const front = side => R.hp[side].findIndex(h => h > 0);

// 題目的時間軸：每一題出現前有 5 秒（顯示上一題的結果，第一題則是準備時間），這段時間可以用技能；
// 題目出現後沒有作答時間限制。被「干擾」的人要再多等 2 秒才能作答。
function qPhase(t) {
  const s = (t - L.kAt) / 1000;
  if (s < PVP_SKILL_SEC) return { st: L.showLast ? "last" : "prep", left: PVP_SKILL_SEC - s };
  if (fxOf(ME).jam === R.k && s < PVP_SKILL_SEC + PVP_JAM_SEC) return { st: "jam", left: PVP_SKILL_SEC + PVP_JAM_SEC - s };
  return { st: "ask" };
}
const skillTime = () => { const st = qPhase(now()).st; return st === "last" || st === "prep"; };
function fxOf(side) { return (R && R.fx && R.fx[side]) || {}; }
function ensureFx(d) {
  d.fx = d.fx || {}; d.fx.A = d.fx.A || {}; d.fx.B = d.fx.B || {};
  d.used = d.used || {}; d.used.A = d.used.A || []; d.used.B = d.used.B || [];
  d.usedK = d.usedK || { A: -1, B: -1 }; d.slog = d.slog || [];
}
const otherSide = s => s === "A" ? "B" : "A";
const aliveIdx = (d, s) => d.hp[s].map((h, i) => h > 0 ? i : -1).filter(i => i >= 0);
function healAt(d, s, i, n) {
  const max = pvpHp(d.team[s][i]);
  const before = d.hp[s][i];
  d.hp[s][i] = Math.min(max, before + n);
  return d.hp[s][i] - before;
}

/* ---------------- 技能 ---------------- */
// 在交易裡套用技能效果；回傳要顯示的文字，不能用就回傳 null
function applyPvpSkill(d, side, key, k) {
  const o = otherSide(side), f = d.fx[side], of = d.fx[o];
  const fi = d.hp[side].findIndex(h => h > 0), oi = d.hp[o].findIndex(h => h > 0);
  const nm = (s, i) => monName(d.team[s][i]);
  switch (key) {
    case "pw": f.pw = true; return "下一次攻擊傷害變 1.5 倍";
    case "sh": f.sh = true; return "下一次被攻擊傷害減半";
    case "wall": f.wall = true; return "下一次被攻擊會被完全擋下";
    case "heal": { if (fi < 0) return null; const n = healAt(d, side, fi, PVP_HEAL); return `${nm(side, fi)} 回復 ${n} 血`; }
    case "heal2": { const t = aliveIdx(d, side).map(i => healAt(d, side, i, PVP_HEAL_ALL)).reduce((a, b) => a + b, 0); return `大家一共回復 ${t} 血`; }
    case "angel": { if (fi < 0) return null; const n = healAt(d, side, fi, 20); f.sh = true; return `${nm(side, fi)} 回復 ${n} 血，下一次被攻擊傷害減半`; }
    case "snipe": { if (oi < 0) return null; d.hp[o][oi] = Math.max(0, d.hp[o][oi] - PVP_SNIPE); return `對 ${nm(o, oi)} 造成 ${PVP_SNIPE} 傷害${d.hp[o][oi] === 0 ? "，牠倒下了！" : ""}`; }
    case "drain": f.drain = true; return "下一次攻擊可以吸血";
    case "hint": f.hint = k; return "下一題會拿掉一個錯的選項";
    case "jam": of.jam = k; return `對手下一題要多等 ${PVP_JAM_SEC} 秒才能作答`;
    case "retry": f.retry = k; return "下一題答錯可以再答一次";
    case "counter": f.counter = true; return "下一次被攻擊時會反擊";
    case "pierce": f.pierce = true; return "下一次攻擊不怕護盾和鐵壁";
    case "back": f.back = true; return "下一次攻擊改打對手最後面的夥伴";
    case "swap": {
      const al = aliveIdx(d, side);
      if (al.length < 2) return null;
      const a = al[0], b = al[1];
      [d.team[side][a], d.team[side][b]] = [d.team[side][b], d.team[side][a]];
      [d.hp[side][a], d.hp[side][b]] = [d.hp[side][b], d.hp[side][a]];
      return `${nm(side, a)} 換到前面了`;
    }
    case "magic": f.wall = true; f.x2 = true; return "下一次被攻擊完全擋下，下一次攻擊傷害變 2 倍";
    case "inf": f.inf = 3; return "接下來 3 次攻擊傷害都變 1.5 倍";
    default: return null;
  }
}
async function useSkillPvp(id) {
  if (!R || R.phase !== "fight" || !skillTime()) return;
  const k = R.k;
  let err = null;
  try {
    err = await txDoc(roomRef(RID), d => {
      if (!d || d.phase !== "fight" || d.k !== k) return { ret: "這一題已經開始了，下一題前再用吧！" };
      ensureFx(d);
      if (d.usedK[ME] === k) return { ret: "這段時間你已經用過一個技能了。" };
      const i = d.team[ME].indexOf(id);
      if (i < 0 || d.hp[ME][i] <= 0) return { ret: "倒下的夥伴不能用技能。" };
      if (d.used[ME].includes(id)) return { ret: "這隻夥伴的技能已經用過了。" };
      const key = PVP_SKILL_OF[id] || "pw";
      const txt = applyPvpSkill(d, ME, key, k);
      if (!txt) return { ret: "現在用這個技能沒有效果，換一個吧！" };
      d.used[ME].push(id); d.usedK[ME] = k;
      d.slog.push({ side: ME, id, key, k, txt }); d.slog = d.slog.slice(-10);
      if (d.hp[OP].every(h => h <= 0)) { d.phase = "end"; d.win = ME; d.why = "ko"; }
      return { write: d, ret: null };
    });
  } catch (e) { console.warn(e); }
  if (err) alert(err);
}
// 答對後的攻擊：所有攻擊和防禦的技能效果都在這裡算
function resolveAttack(d, side, k) {
  ensureFx(d);
  const o = otherSide(side), f = d.fx[side], of = d.fx[o];
  const fa = d.hp[side].findIndex(h => h > 0);
  let fd = d.hp[o].findIndex(h => h > 0);
  const notes = [];
  if (f.back) { const al = aliveIdx(d, o); fd = al[al.length - 1]; f.back = false; notes.push("背刺"); }
  let dmg = pvpDmg(d.team[side][fa]);
  let mult = 1;
  if (f.pw) { mult *= 1.5; f.pw = false; notes.push("蓄力 ×1.5"); }
  if (f.x2) { mult *= 2; f.x2 = false; notes.push("魔法 ×2"); }
  if (f.inf > 0) { mult *= 1.5; f.inf -= 1; notes.push("無限連擊 ×1.5"); }
  dmg = Math.round(dmg * mult);
  if (f.pierce) { dmg += PVP_PIERCE; f.pierce = false; notes.push("破甲"); }
  else if (of.wall) { dmg = 0; of.wall = false; notes.push("被鐵壁擋下"); }
  else if (of.sh) { dmg = Math.ceil(dmg / 2); of.sh = false; notes.push("被護盾減半"); }
  d.hp[o][fd] = Math.max(0, d.hp[o][fd] - dmg);
  const ko = d.hp[o][fd] === 0;
  if (f.drain) { const n = healAt(d, side, fa, Math.floor(dmg / 2)); f.drain = false; notes.push(`吸血 +${n}`); }
  let back = 0;
  if (of.counter) { back = PVP_COUNTER; d.hp[side][fa] = Math.max(0, d.hp[side][fa] - back); of.counter = false; notes.push(`被反擊 ${back}`); }
  return { k, by: side, dmg, atk: d.team[side][fa], tgt: d.team[o][fd], ko, notes, backKo: back > 0 && d.hp[side][fa] === 0 };
}
function renderQuestionClock(t) {
  const p = qPhase(t);
  if (p.st !== L.qst) { L.qst = p.st; renderFightCenter(); }
  const el = $("qCount");
  if (el && p.left != null) el.textContent = Math.max(1, Math.ceil(p.left));
}
async function answer(i) {
  if (R.phase !== "fight" || L.answered || qPhase(now()).st !== "ask" || (L.wrongPicks || []).includes(i)) return;
  const k = R.k, Q = questionAt(k), ok = i === Q.ans;
  const retry = !ok && fxOf(ME).retry === k && !L.retried;   // 「再一次」：答錯不鎖住
  if (retry) { L.retried = true; L.wrongPicks = (L.wrongPicks || []).concat(i); }
  else { L.answered = ok ? "right" : "wrong"; L.picked = i; }
  STU.pvp.ans += 1; if (ok) STU.pvp.cor += 1;
  renderFightCenter();
  try {
    await txDoc(roomRef(RID), d => {
      if (!d || d.phase !== "fight" || d.k !== k || d.lock[ME]) return null;
      ensureFx(d);
      if (!ok) {
        if (d.fx[ME].retry === k) { d.fx[ME].retry = null; return { write: d }; }
        d.lock[ME] = true;
        if (d.lock[OP]) nextQ(d, { k, by: null, why: "both" });
        return { write: d };
      }
      // 答對：我前面的夥伴攻擊（技能效果在 resolveAttack 裡算）
      const last = resolveAttack(d, ME, k);
      d.score[ME] += 1;
      nextQ(d, last);
      if (d.hp[OP].every(h => h <= 0)) { d.phase = "end"; d.win = ME; d.why = "ko"; }
      else if (d.hp[ME].every(h => h <= 0)) { d.phase = "end"; d.win = OP; d.why = "ko"; }
      return { write: d };
    });
  } catch (e) { console.warn(e); }
}
function nextQ(d, last) { d.last = last; d.k = last.k + 1; d.lock = { A: false, B: false }; }
function timeoutQ(k) {
  txDoc(roomRef(RID), d => {
    if (!d || d.phase !== "fight" || d.k !== k) return null;
    nextQ(d, { k, by: null, why: "time" });
    return { write: d };
  }).catch(() => {});
}

/* ---------------- 結束 ---------------- */
function judgeByTime(d) {
  const alive = s => d.hp[s].filter(h => h > 0).length;
  const ratio = s => d.hp[s].reduce((a, h, i) => a + h / pvpHp(d.team[s][i]), 0);
  if (alive("A") !== alive("B")) return alive("A") > alive("B") ? "A" : "B";
  const ra = ratio("A"), rb = ratio("B");
  if (Math.abs(ra - rb) > 1e-9) return ra > rb ? "A" : "B";
  return "draw";
}
function endByTime() {
  txDoc(roomRef(RID), d => {
    if (!d || d.phase !== "fight") return null;
    d.phase = "end"; d.win = judgeByTime(d); d.why = "time";
    return { write: d };
  }).catch(() => {});
}
function endBy(winner, why) {
  txDoc(roomRef(RID), d => {
    if (!d || d.phase === "end" || d.phase === "wait") return null;
    d.phase = "end"; d.win = winner; d.why = why;
    return { write: d };
  }).catch(() => {});
}
function surrender() {
  if (!R || R.phase === "end") return;
  if (!confirm("確定要離開這場對戰嗎？離開就算輸喔！")) return;
  endBy(OP, "left");
}

async function finishMatch() {
  if (L.finished) return;
  L.finished = true;
  if (!R.win) return;               // 房間取消了
  let first = false;
  try {
    first = await txDoc(roomRef(RID), d => {
      if (!d || d.done[ME]) return { ret: false };
      d.done[ME] = true;
      return { write: d, ret: true };
    });
  } catch (e) { console.warn(e); }
  if (!first) return;               // 已經領過了（重新整理）
  const p = STU.pvp, fair = R.mode === "fair";
  const res = R.win === "draw" ? "d" : (R.win === ME ? "w" : "l");
  p[(fair ? "f" : "c") + res] += 1;
  p.last = now();
  let coins = 0;
  if (fair) coins = res === "w" ? PVP_COINS.win : res === "l" ? PVP_COINS.lose : PVP_COINS.draw;
  // 高第服裝：只算公平競技；輸了連勝歸零，平手不加也不歸零
  L.newSkin = [];
  if (fair) {
    if (res === "w") { p.sw += 1; p.st += 1; }
    else if (res === "l") p.st = 0;
    if (!p.sk2 && p.sw >= SKIN_NEED.total) { p.sk2 = 1; L.newSkin.push(2); }
    if (!p.sk3 && p.st >= SKIN_NEED.streak) { p.sk3 = 1; L.newSkin.push(3); }
  }
  p.coins += coins;
  L.coins = coins;
  try { await saveGameData(STU, "pvp", coins); } catch (e) { reportError("存檔", e); }
  renderCoins();
  render();
}
function backLobby() {
  stopQueue();
  leaveRoomListen();
  L = {};
  showView("viewLobby");
  renderLobby();
}

/* =========================================================
   畫面
   ========================================================= */
function showView(id) {
  ["viewLobby", "viewWait", "viewRoom"].forEach(v => $(v).classList.toggle("hidden", v !== id));
}
function render() {
  if (!R || !ME) return;
  $("vsA").innerHTML = nameTag(ME, true);
  $("vsB").innerHTML = nameTag(OP, false);
  $("roomMode").textContent = R.mode === "fair" ? "公平競技" : "自訂對戰（不給金幣）";
  ["pPick", "pBan", "pFight", "pEnd"].forEach(id => $(id).classList.add("hidden"));
  if (R.phase === "pick") renderPick();
  else if (R.phase === "ban") renderBan();
  else if (R.phase === "fight") renderFight();
  else if (R.phase === "end") renderEnd();
}
function nameTag(side, me) {
  const p = R[side] || { name: "?" };
  return `<span class="font-black">${escapeHtml(p.name)}</span>${me ? ` <span class="k-chip k-chip--yellow">你</span>` : ""}`;
}

function renderPick() {
  $("pPick").classList.remove("hidden");
  const turn = PVP_PICK_ORDER[R.pi];
  const mine = turn === ME;
  $("pickWho").innerHTML = mine ? `輪到<b>你</b>選了！` : `等 <b>${escapeHtml(R[OP].name)}</b> 選…`;
  $("pickWho").className = "k-display text-xl " + (mine ? "text-[#E8513F]" : "");
  // 選角順序條
  const cnt = { A: 0, B: 0 };
  $("pickOrder").innerHTML = PVP_PICK_ORDER.map((s, i) => {
    const id = R.picks[s][cnt[s]++];
    const cur = i === R.pi;
    return `<div class="pv-slot ${s === ME ? "is-me" : "is-op"} ${cur ? "is-cur" : ""}">
      ${id ? `<img src="${monsterImg(id, skinOf(s))}" alt=""/>` : `<span>${s === ME ? "你" : "對手"}</span>`}</div>`;
  }).join("");
  const tk = takenAll();
  $("pickGrid").innerHTML = (R.pool[ME] || []).map(id => {
    const used = tk.includes(id);
    const byMe = R.picks[ME].includes(id);
    return `<button class="pv-pick ${used ? "is-used" : ""} ${byMe ? "is-mine" : ""}" ${!mine || used ? "disabled" : ""} onclick="doPick('${id}')">
      ${monChip(id, "", skinOf(ME))}${used ? `<span class="pv-tag">${byMe ? "已選" : "對手選了"}</span>` : ""}</button>`;
  }).join("");
  $("opPool").textContent = `對手有 ${(R.pool[OP] || []).length} 隻夥伴可以選`;
}

function renderBan() {
  $("pBan").classList.remove("hidden");
  const done = !!R.ban[ME];
  $("banWho").innerHTML = done ? "等對手禁角…" : "選對手的 <b>1 隻</b>夥伴，讓牠不能上場！";
  $("banOp").innerHTML = R.picks[OP].map(id => `<button class="pv-pick ${R.ban[ME] === id ? "is-ban" : ""}" ${done ? "disabled" : ""} onclick="doBan('${id}')">${monChip(id, "", skinOf(OP))}${R.ban[ME] === id ? `<span class="pv-tag pv-tag--ban">禁</span>` : ""}</button>`).join("");
  $("banMe").innerHTML = R.picks[ME].map(id => monChip(id, "", skinOf(ME))).join("");
}

function teamHtml(side) {
  const f = front(side);
  const used = (R.used && R.used[side]) || [];
  return (R.team[side] || []).map((id, i) => {
    const max = pvpHp(id), h = R.hp[side][i], sk = pvpSkillOf(id);
    return `<div class="pv-mon ${i === f ? "is-front" : ""} ${h <= 0 ? "is-ko" : ""}">
      <div class="k-mon-img"><img src="${monsterImg(id, skinOf(side))}" alt=""/></div>
      <div class="text-[11px] font-black truncate">${escapeHtml(monName(id))}</div>
      <div class="pv-hp"><div style="width:${h / max * 100}%" class="${h / max < .35 ? "is-low" : ""}"></div></div>
      <div class="text-[10px] font-bold text-[#5B6B78]">${h} / ${max}</div>
      <div class="pv-skill ${used.includes(id) ? "is-used" : ""}" title="${escapeHtml(sk.desc)}">${sk.icon} ${sk.name}${used.includes(id) ? "（用過）" : ""}</div></div>`;
  }).join("");
}
// 隊伍目前有效的技能效果
function buffHtml(side) {
  const f = fxOf(side), out = [];
  if (f.pw) out.push("💥 蓄力");
  if (f.x2) out.push("🏰 下一擊×2");
  if (f.inf > 0) out.push(`♾️ ×1.5 還有 ${f.inf} 次`);
  if (f.sh) out.push("🛡️ 護盾");
  if (f.wall) out.push("🧱 鐵壁");
  if (f.drain) out.push("🩸 吸血");
  if (f.counter) out.push("🌵 反擊");
  if (f.pierce) out.push("🔨 破甲");
  if (f.back) out.push("🎯 背刺");
  if (f.retry === R.k) out.push("🔁 再一次");
  if (f.hint === R.k) out.push("💡 小提示");
  if (f.jam === R.k) out.push("🌀 被干擾");
  return out.map(x => `<span class="pv-buff">${x}</span>`).join("");
}
function renderFight() {
  $("pFight").classList.remove("hidden");
  $("teamMe").innerHTML = teamHtml(ME);
  $("teamOp").innerHTML = teamHtml(OP);
  $("buffMe").innerHTML = buffHtml(ME);
  $("buffOp").innerHTML = buffHtml(OP);
  $("scoreMe").textContent = R.score[ME];
  $("scoreOp").textContent = R.score[OP];
  renderFightCenter();
}
function renderFightCenter() {
  if (!R || R.phase !== "fight") return;
  const p = qPhase(now());
  const box = $("qBox");
  if (p.st === "last" || p.st === "prep") {
    let html = "";
    const l = L.showLast;
    if (p.st === "last" && l) {
      if (l.by) {
        const mine = l.by === ME;
        html = `<div class="pv-big ${mine ? "text-[#2E9E6A]" : "text-[#E8513F]"}">${mine ? "你搶到了！" : "對手搶到了！"}</div>
          <p class="font-bold mt-2">${escapeHtml(monName(l.atk))} 攻擊 ${escapeHtml(monName(l.tgt))}，造成 <b>${l.dmg}</b> 點傷害${l.ko ? `，<b>${escapeHtml(monName(l.tgt))}倒下了！</b>` : "！"}</p>
          ${l.notes && l.notes.length ? `<p class="text-sm font-bold text-[#8A63D2] mt-1">（${escapeHtml(l.notes.join("、"))}）</p>` : ""}`;
      } else html = `<div class="pv-big">${l.why === "time" ? "時間到！" : "兩個人都答錯了！"}</div><p class="font-bold mt-2">這題沒有人攻擊。</p>`;
      const LQ = questionAt(l.k);
      html += `<div class="text-sm font-bold text-[#5B6B78] mt-2">正確答案：<b class="text-[#1E2A33] inline-block align-middle">${LQ.opts[LQ.ans]}</b></div>`;
    } else {
      html = `<div class="pv-big">準備開戰！</div><p class="font-bold mt-1">先想想要不要用技能。</p>`;
    }
    // 這段時間用了哪些技能
    const logs = ((R.slog) || []).filter(x => x.k === R.k);
    const logHtml = logs.map(x => `<div class="pv-log ${x.side === ME ? "is-me" : ""}">${x.side === ME ? "你" : "對手"}的 <b>${escapeHtml(monName(x.id))}</b> 用了 ${PVP_SKILLS[x.key].icon}「${PVP_SKILLS[x.key].name}」：${escapeHtml(x.txt)}</div>`).join("");
    // 我可以用的技能
    const usedNow = R.usedK && R.usedK[ME] === R.k;
    const usedIds = (R.used && R.used[ME]) || [];
    const btns = (R.team[ME] || []).map((id, i) => {
      const sk = pvpSkillOf(id), dead = R.hp[ME][i] <= 0, used = usedIds.includes(id);
      const can = !dead && !used && !usedNow;
      return `<button class="pv-skill-btn" ${can ? `onclick="useSkillPvp('${id}')"` : "disabled"}>
        <span class="text-2xl leading-none">${sk.icon}</span>
        <span class="text-left"><b>${sk.name}</b><span class="block text-[11px] font-bold opacity-80">${escapeHtml(monName(id))}・${dead ? "倒下了" : used ? "用過了" : escapeHtml(sk.desc)}</span></span></button>`;
    }).join("");
    box.innerHTML = `<div class="text-center pt-2">${html}</div>
      <div class="mt-4 p-3 rounded-2xl border-2 border-dashed border-[#8A63D2] bg-[#F7F2FF]">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="font-black">✨ 技能時間：下一題 <span id="qCount" class="k-display text-2xl text-[#E8513F]">${Math.ceil(p.left)}</span> 秒後出現</span>
          <span class="text-xs font-bold text-[#5B6B78]">${usedNow ? "這段時間你已經用過技能了" : "每段時間可以用 1 個技能，每隻夥伴一場只能用一次"}</span>
        </div>
        <div class="grid sm:grid-cols-3 gap-2 mt-2">${btns}</div>
        ${logHtml ? `<div class="mt-2 space-y-1">${logHtml}</div>` : ""}
      </div>`;
  } else if (p.st === "jam") {
    box.innerHTML = `<div class="text-center py-10"><div class="pv-big text-[#8A63D2]">🌀 被干擾了！</div>
      <p class="font-bold mt-2">對手用了「干擾」，再等 <span id="qCount" class="k-display text-2xl">${Math.ceil(p.left)}</span> 秒才能作答。</p></div>`;
  } else {
    const Q = questionAt(R.k);
    const locked = !!L.answered;
    // 小提示：拿掉一個錯的選項（用種子決定，重新整理也一樣）
    let cut = -1;
    if (fxOf(ME).hint === R.k) {
      const wrongs = Q.opts.map((_, i) => i).filter(i => i !== Q.ans);
      cut = wrongs[Math.floor(rng(R.seed + R.k * 31)() * wrongs.length)];
    }
    const wp = L.wrongPicks || [];
    box.innerHTML = `
      <p class="text-xs font-bold text-[#5B6B78]">第 ${R.k + 1} 題・搶答！</p>
      <p class="text-lg font-black leading-relaxed mt-1">${Q.q}</p>
      ${Q.fig ? `<div class="flex justify-center mt-3"><div class="pv-fig">${Q.fig}</div></div>` : ""}
      <div class="grid ${Q.figOpts ? "grid-cols-2" : "sm:grid-cols-2"} gap-3 mt-4">${Q.opts.map((o, i) => `
        <button class="k-opt ${Q.figOpts ? "pv-opt-fig" : ""} ${L.picked === i ? (L.answered === "right" ? "is-right" : "is-wrong") : ""} ${wp.includes(i) ? "is-wrong" : ""} ${i === cut ? "pv-cut" : ""}" ${locked || i === cut || wp.includes(i) ? "disabled" : ""} onclick="answer(${i})">
          <span class="k-opt-key">${"ABCD"[i]}</span><span class="k-opt-txt">${o}</span></button>`).join("")}</div>
      <p class="text-center font-bold mt-3 min-h-[1.5rem] ${L.answered === "wrong" ? "text-[#E8513F]" : "text-[#2E9E6A]"}">${L.answered === "wrong" ? "答錯了！這題不能再答，等對手作答…" : L.answered === "right" ? "答對了！" : wp.length ? "🔁 答錯了，但是「再一次」讓你可以再答一次！" : cut >= 0 ? "💡 小提示幫你拿掉了一個錯的選項" : ""}</p>`;
  }
}

function whyText(w) {
  const won = w === ME;
  switch (R.why) {
    case "ko": return won ? "你打倒了對手全部的夥伴！" : "你的夥伴全部被打倒了。";
    case "time": return "5 分鐘到了，" + (w === "draw" ? "剩下的夥伴和血量一樣多。" : won ? "你剩下的夥伴（或血量）比較多！" : "對手剩下的夥伴（或血量）比較多。");
    case "gone": return won ? "對手離線太久，這場算你贏。" : "你離線太久，這場算對手贏。";
    case "left": return won ? "對手離開了對戰。" : "你離開了對戰。";
    default: return "";
  }
}
function renderEnd() {
  $("pEnd").classList.remove("hidden");
  const w = R.win;
  let title = "對戰結束", face = "🤝";
  if (!w) { title = "房間取消了"; face = "👋"; }
  else if (w === "draw") { title = "平手！"; face = "🤝"; }
  else if (w === ME) { title = "你贏了！"; face = "🏆"; }
  else { title = "這次輸了，再接再厲！"; face = "💪"; }
  const fair = R.mode === "fair";
  const coinTxt = !w ? "" : !fair ? "自訂對戰不給金幣，好好練習！" :
    (L.coins != null ? `得到 <b>${L.coins}</b> 金幣！` : "金幣已經領過了。");
  $("endBody").innerHTML = `
    <div class="text-6xl">${face}</div>
    <p class="k-display text-3xl mt-2">${title}</p>
    ${w ? `<p class="font-bold text-[#5B6B78] mt-1">${whyText(w)}</p>` : ""}
    ${w ? `<div class="flex justify-center gap-6 mt-4 font-black">
      <div>${escapeHtml(R[ME].name)}<div class="k-display text-3xl">${R.score[ME]}</div><div class="text-xs text-[#5B6B78]">答對搶到</div></div>
      <div class="k-display text-2xl self-center">VS</div>
      <div>${escapeHtml(R[OP].name)}<div class="k-display text-3xl">${R.score[OP]}</div><div class="text-xs text-[#5B6B78]">答對搶到</div></div></div>` : ""}
    <p class="font-bold mt-4">${coinTxt}</p>
    ${(L.newSkin || []).map(lv => `<div class="mt-4 p-3 rounded-2xl border-[3px] border-[#1E2A33] bg-[#FFF4CC] flex items-center gap-3 text-left">
      <img src="${heroSkinImg(lv)}" class="w-16 h-16 rounded-xl border-2 border-[#1E2A33]" alt=""/>
      <div><div class="k-display text-xl">得到「高第‧${HERO_SKINS[lv - 1].name}」服裝！</div>
      <div class="text-sm font-bold text-[#5B6B78]">${lv === 2 ? "公平競技累積贏 5 場" : "公平競技連贏 5 場"}。到高第的魔法建築點「高第」就能換上（要先有高第喔）。</div></div></div>`).join("")}`;
}
