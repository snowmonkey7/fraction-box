/* 所有頁面共用：資料庫連線、學生資料存取、登入狀態、金幣 */

let db = null;
let isCloudMode = false;
let cloudError = null;      // 雲端連線失敗時的錯誤
let dbReadyResolve;
const dbReady = new Promise(r => (dbReadyResolve = r)); // 初始化完成前，登入按鈕會先等待

// 把 Firebase 的英文錯誤翻成老師看得懂的中文說明
function explainFirebaseError(e) {
  const code = (e && (e.code || "")) + "";
  const msg = (e && e.message) || String(e);
  if (code.includes("permission-denied") || /permission/i.test(msg)) {
    return "Firestore 安全規則拒絕存取（permission-denied）。\n請到 Firebase 主控台 → Firestore Database → 規則，把規則改成允許讀寫此集合後按「發布」。";
  }
  if (code.includes("not-found-account") || /No document to update/i.test(msg)) {
    return "這個帳號已經被老師刪除了，請登出後找老師確認。";
  }
  if (code.includes("not-found-account") || /No document to update/i.test(msg)) {
    return "這個學生帳號已經被老師刪除了，請重新整理頁面或找老師。";
  }
  if (code.includes("not-found") || /database .* does not exist|NOT_FOUND/i.test(msg)) {
    return "這個 Firebase 專案還沒有建立 Firestore 資料庫。\n請到 Firebase 主控台 → Firestore Database → 建立資料庫。";
  }
  if (code.includes("unavailable") || code.includes("timeout") || /offline/i.test(msg)) {
    return "無法連上 Firebase 雲端（網路被擋或離線）。\n請確認網路正常；學校網路若有防火牆，請改用手機熱點測試。";
  }
  if (code.includes("failed-precondition")) {
    return "Firestore 尚未啟用或設定未完成：" + msg;
  }
  return "雲端資料庫錯誤：" + msg;
}

// 雲端操作超過時間沒有回應就視為失敗，避免畫面卡住不動
function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject({ code: "timeout", message: "連線逾時 (offline)" }), ms)
    )
  ]);
}

function setBadge(text, cls) {
  const badge = document.getElementById("syncBadge");
  badge.textContent = text;
  badge.className = "k-chip " + cls;
}

async function initDatabase() {
  const badge = document.getElementById("syncBadge");
  if (!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId)) {
    setupLocalFallback(badge);
    return;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    // 學校網路/防火牆常擋 WebChannel 串流，自動改用長輪詢較穩定
    try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (_) {}
    isCloudMode = true;
    setBadge("☁️ 雲端連線檢查中...", "bg-slate-100 text-slate-600");

    // 實際向伺服器讀一次，確認規則與資料庫都正常
    await withTimeout(db.collection(COLLECTION_NAME).limit(1).get({ source: "server" }));
    cloudError = null;
    setBadge("☁️ 雲端連線同步中", "bg-emerald-100 text-emerald-700");
  } catch (e) {
    console.error("Firebase 連線檢查失敗", e);
    cloudError = e;
    setBadge("⚠️ 雲端連線失敗（點我看原因）", "bg-rose-100 text-rose-700 cursor-pointer");
    badge.onclick = () => alert(explainFirebaseError(cloudError));
  }
}

// 讓舊資料或欄位不完整的學生資料也能正常使用（避免 undefined 造成當機）
function normalizeStudent(raw, id) {
  const base = createDefaultStudentObj(id || (raw && raw.id) || "");
  const s = Object.assign(base, raw || {});
  s.id = String(s.id || id).trim();
  // 舊帳號沒有這個欄位 → 代表還沒把重複公仔換成金幣
  s.dupCoinsConverted = !!(raw && raw.dupCoinsConverted === true);
  ["totalAnswered", "correctCount", "streakTowardBox", "availableBoxes", "shards", "lockUntil", "lockCount", "coins"].forEach(k => {
    s[k] = Number(s[k]) || 0;
  });
  if (!s.toys || typeof s.toys !== "object") s.toys = {};
  if (!Array.isArray(s.answeredIds)) s.answeredIds = [];
  if (!Array.isArray(s.recentLogs)) s.recentLogs = [];
  if (!Array.isArray(s.wrongTimes)) s.wrongTimes = [];
  s.pin = s.pin == null ? "" : String(s.pin).trim();
  return s;
}

// 產生 4 位數隨機密碼（避開 0000、1234 這種太好猜的）
function generatePin() {
  const weak = ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321"];
  let p;
  do { p = String(Math.floor(Math.random() * 10000)).padStart(4, "0"); } while (weak.includes(p));
  return p;
}

function setupLocalFallback(badge) {
  isCloudMode = false;
  badge.textContent = "💻 本機測試模式 (未填Firebase金鑰)";
  badge.className = "k-chip bg-amber-100 text-amber-800";
}

function createDefaultStudentObj(id, name = "", pin = "") {
  return {
    id: String(id).trim(),
    name: name.trim() || `${String(id).slice(-2)}號同學`,
    pin: String(pin).trim(), // 學生登入密碼（空字串 = 不需密碼）
    totalAnswered: 0,
    correctCount: 0,
    streakTowardBox: 0, // 0, 1, 2 (滿3變0並+1盒)
    availableBoxes: 0,
    shards: 0,          // 0, 1, 2 (滿3自動觸發抽獎)
    toys: {},           // { reg_1: 2, hid_1: 1, ... }
    answeredIds: [],    // 已答對或已作答的題號陣列
    recentLogs: [],     // 最近 30 筆作答明細
    clearedNotified: false,
    coins: 0,           // 金幣：所有遊戲共用
    dupCoinsConverted: true, // 新帳號沒有舊的重複公仔，不需要補換金幣
    wrongTimes: [],     // 連續答錯的時間（答對就清空），用來判斷是否亂猜
    lockUntil: 0,       // 暫停作答到什麼時間（毫秒），重新整理也躲不掉
    lockCount: 0,       // 因亂猜被暫停的總次數（給老師參考）
    updatedAt: Date.now()
  };
}

// 確保預設班級 50101~50122 存在
/* =========================================================================
 * 網站設定（網站名稱、老師名單）：存在資料庫同一個集合裡的 _settings 這一筆
 * 老師密碼只存「雜湊值」，看得到資料庫也看不到原本的密碼
 * ========================================================================= */
const SETTINGS_DOC_ID = "_settings";
const LOCAL_SETTINGS_KEY = "kz_site_settings";
let SITE = null;

// SHA-256（自己寫的版本，任何瀏覽器、任何網址都能用）
function sha256Hex(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = Array.from(unescape(encodeURIComponent(str)), c => c.charCodeAt(0));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = (bytes[off+i*4] << 24) | (bytes[off+i*4+1] << 16) | (bytes[off+i*4+2] << 8) | bytes[off+i*4+3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h = [h[0]+a, h[1]+b, h[2]+c, h[3]+d, h[4]+e, h[5]+f, h[6]+g, h[7]+hh].map(x => x | 0);
  }
  return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
const hashPassword = pwd => sha256Hex("kz-game-site|" + String(pwd || "").trim());

function defaultSettings() {
  return {
    siteTitle: SITE_TITLE,
    adminHash: hashPassword(ADMIN_FIRST_PASSWORD),
    adminMustChange: true,
    teachers: [{
      id: "t1", name: FIRST_TEACHER.name, hash: hashPassword(FIRST_TEACHER.password), mustChange: true,
      prefixes: FIRST_TEACHER.prefixes.slice(), testFrom: FIRST_TEACHER.testFrom || ""
    }],
    updatedAt: Date.now()
  };
}

function normalizeSettings(raw) {
  const s = Object.assign(defaultSettings(), raw || {});
  if (!Array.isArray(s.teachers)) s.teachers = [];
  s.teachers = s.teachers.map(t => ({
    id: String(t.id), name: String(t.name || "老師"), hash: t.hash || "", mustChange: !!t.mustChange,
    prefixes: (Array.isArray(t.prefixes) ? t.prefixes : String(t.prefixes || "").split(/[,，\s]+/)).map(x => String(x).trim()).filter(Boolean),
    testFrom: String(t.testFrom || "").trim()
  }));
  return s;
}

async function loadSettings() {
  try {
    if (isCloudMode && !cloudError) {
      const ref = db.collection(COLLECTION_NAME).doc(SETTINGS_DOC_ID);
      const snap = await withTimeout(ref.get());
      if (snap.exists) SITE = normalizeSettings(snap.data());
      else { SITE = defaultSettings(); await withTimeout(ref.set(SITE)); }
    } else {
      const raw = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || "null");
      SITE = raw ? normalizeSettings(raw) : defaultSettings();
      if (!raw) localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(SITE));
    }
  } catch (e) {
    console.warn("讀取網站設定失敗，先用預設值：", e);
    SITE = defaultSettings();
  }
  return SITE;
}

async function saveSettings() {
  SITE.updatedAt = Date.now();
  if (isCloudMode) await withTimeout(db.collection(COLLECTION_NAME).doc(SETTINGS_DOC_ID).set(SITE));
  else localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(SITE));
}

// 這個座號屬於哪位老師（座號開頭最長的那個優先）
function teacherOfStudent(id) {
  if (!SITE) return null;
  id = String(id || "");
  let best = null, bestLen = 0;
  SITE.teachers.forEach(t => t.prefixes.forEach(p => {
    if (p && id.startsWith(p) && p.length > bestLen) { best = t; bestLen = p.length; }
  }));
  return best;
}
// 兩個學生是不是同一班（同一位老師）
function sameClass(idA, idB) {
  const a = teacherOfStudent(idA), b = teacherOfStudent(idB);
  return !!a && !!b && a.id === b.id;
}
const isSystemDocId = id => String(id || "").startsWith("_");

async function ensureDefaultClassExists() {
  const defaultIds = [];
  for (let i = 1; i <= 22; i++) {
    defaultIds.push("501" + String(i).padStart(2, "0"));
  }

  if (isCloudMode) {
    if (cloudError) return; // 連線失敗時不重複嘗試
    try {
      const snap = await withTimeout(db.collection(COLLECTION_NAME).limit(1).get());
      if (snap.empty) {
        const batch = db.batch();
        defaultIds.forEach(id => {
          const ref = db.collection(COLLECTION_NAME).doc(id);
          batch.set(ref, createDefaultStudentObj(id, "", generatePin()));
        });
        await withTimeout(batch.commit());
      }
    } catch (e) {
      console.warn("檢查預設班級時發生錯誤：", e);
    }
  } else {
    const store = getLocalStore();
    let changed = false;
    defaultIds.forEach(id => {
      if (!store[id]) {
        store[id] = createDefaultStudentObj(id, "", generatePin());
        changed = true;
      }
    });
    if (changed) saveLocalStore(store);
  }
}

function getLocalStore() {
  try {
    return JSON.parse(localStorage.getItem(COLLECTION_NAME) || "{}");
  } catch {
    return {};
  }
}

function saveLocalStore(data) {
  localStorage.setItem(COLLECTION_NAME, JSON.stringify(data));
}

async function fetchStudent(studentId) {
  if (isSystemDocId(studentId)) return null;
  if (isCloudMode) {
    const doc = await withTimeout(db.collection(COLLECTION_NAME).doc(studentId).get());
    return doc.exists ? normalizeStudent(doc.data(), doc.id) : null;
  } else {
    const store = getLocalStore();
    return store[studentId] ? normalizeStudent(store[studentId], studentId) : null;
  }
}

async function saveStudent(studentObj) {
  studentObj.updatedAt = Date.now();
  if (isCloudMode) {
    await withTimeout(db.collection(COLLECTION_NAME).doc(studentObj.id).set(studentObj, { merge: true }));
  } else {
    const store = getLocalStore();
    store[studentObj.id] = studentObj;
    saveLocalStore(store);
  }
}

// 學生端專用：只更新作答/抽獎進度，不會蓋掉老師剛改的姓名或密碼；
// 帳號若已被老師刪除，也不會被學生端「復活」
async function saveStudentProgress(studentObj, coinDelta = 0) {
  // 金幣是所有遊戲共用的，所以不直接覆蓋，而是用「加減多少」的方式寫入，
  // 避免兩個遊戲同時存檔時把對方的金幣蓋掉。
  const data = Object.assign({}, studentObj, { updatedAt: Date.now() });
  delete data.name;
  delete data.pin;
  delete data.id;
  delete data.coins;
  GAME_FIELDS.forEach(f => delete data[f]); // 其他遊戲的進度不歸這裡管，不要蓋掉
  TEACHER_ONLY_FIELDS.forEach(f => delete data[f]); // 老師設定的開放範圍，學生端不能改
  if (coinDelta) studentObj.coins = (studentObj.coins || 0) + coinDelta;
  if (isCloudMode) {
    if (coinDelta) data.coins = firebase.firestore.FieldValue.increment(coinDelta);
    await withTimeout(db.collection(COLLECTION_NAME).doc(studentObj.id).update(data));
  } else {
    const store = getLocalStore();
    if (!store[studentObj.id]) throw { code: "not-found-account", message: "帳號已被刪除" };
    Object.assign(store[studentObj.id], data);
    if (coinDelta) store[studentObj.id].coins = (store[studentObj.id].coins || 0) + coinDelta;
    saveLocalStore(store);
  }
}

// 每個遊戲各自存在學生資料裡的一個欄位（例如高第遊戲存在 gaudi）
const GAME_FIELDS = ["gaudi", "dress", "food", "pvp", "campus"];
// 只有老師能改的欄位：gaudiOpen = 高第遊戲開放到第幾棟（0 = 不能進入，1～4 = 開放到第幾棟）
const TEACHER_ONLY_FIELDS = ["gaudiOpen", "dressOpen", "foodOpen", "campusOpen", "pvpOpen"];
// dressOpen = 換裝扭蛋開放幾台扭蛋機（0 = 不能玩）
// 測試帳號：每位老師可以設定「從哪個座號開始是測試帳號」，不列入排行榜和班級統計
function isTestAccount(id) {
  id = String(id || "");
  const t = teacherOfStudent(id);
  const from = t && t.testFrom;
  if (!from) return false;
  return id.length === from.length && id >= from;
}

// 教師端：增減金幣（雲端用 increment，不會蓋掉學生同時賺到的金幣）
async function addCoinsToStudent(studentId, delta) {
  if (isCloudMode) {
    await withTimeout(db.collection(COLLECTION_NAME).doc(studentId).update({
      coins: firebase.firestore.FieldValue.increment(delta), updatedAt: Date.now()
    }));
  } else {
    const store = getLocalStore();
    if (!store[studentId]) throw { code: "not-found-account", message: "帳號不存在" };
    store[studentId].coins = (store[studentId].coins || 0) + delta;
    store[studentId].updatedAt = Date.now();
    saveLocalStore(store);
  }
}

function getGaudiOpen(stu) {
  const n = Number(stu && stu.gaudiOpen);
  return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.floor(n))) : 0;
}

// 新遊戲專用：只寫入自己的那一格資料＋金幣增減，不會動到其他遊戲的進度
async function saveGameData(studentObj, field, coinDelta = 0) {
  const data = { [field]: studentObj[field], updatedAt: Date.now() };
  if (coinDelta) studentObj.coins = (studentObj.coins || 0) + coinDelta;
  if (isCloudMode) {
    if (coinDelta) data.coins = firebase.firestore.FieldValue.increment(coinDelta);
    await withTimeout(db.collection(COLLECTION_NAME).doc(studentObj.id).update(data));
  } else {
    const store = getLocalStore();
    if (!store[studentObj.id]) throw { code: "not-found-account", message: "帳號已被刪除" };
    store[studentObj.id][field] = data[field];
    store[studentObj.id].updatedAt = data.updatedAt;
    if (coinDelta) store[studentObj.id].coins = (store[studentObj.id].coins || 0) + coinDelta;
    saveLocalStore(store);
  }
}

// 一次寫入好幾個遊戲欄位（校園的魔法探險：共用的夥伴在 gaudi、自己的紀錄在 campus）
async function saveGameFields(studentObj, fields, coinDelta = 0) {
  const data = { updatedAt: Date.now() };
  fields.forEach(f => { data[f] = studentObj[f]; });
  if (coinDelta) studentObj.coins = (studentObj.coins || 0) + coinDelta;
  if (isCloudMode) {
    if (coinDelta) data.coins = firebase.firestore.FieldValue.increment(coinDelta);
    await withTimeout(db.collection(COLLECTION_NAME).doc(studentObj.id).update(data));
  } else {
    const store = getLocalStore();
    if (!store[studentObj.id]) throw { code: "not-found-account", message: "帳號已被刪除" };
    fields.forEach(f => { store[studentObj.id][f] = data[f]; });
    store[studentObj.id].updatedAt = data.updatedAt;
    if (coinDelta) store[studentObj.id].coins = (store[studentObj.id].coins || 0) + coinDelta;
    saveLocalStore(store);
  }
}

// 校園的魔法探險、PvP 競技場：老師在教師端一位一位（或勾選多位）設定開放（campusOpen、pvpOpen：1 = 開放）
const isCampusOpen = stu => (Number(stu && stu.campusOpen) || 0) > 0;
const isPvpOpen = stu => (Number(stu && stu.pvpOpen) || 0) > 0;

// 教師端專用：只更新指定欄位（例如姓名、密碼），不會用舊資料蓋掉學生最新的作答進度
async function saveStudentFields(studentId, fields) {
  const data = Object.assign({}, fields, { updatedAt: Date.now() });
  if (isCloudMode) {
    await withTimeout(db.collection(COLLECTION_NAME).doc(studentId).update(data));
  } else {
    const store = getLocalStore();
    if (!store[studentId]) throw { code: "not-found-account", message: "帳號不存在" };
    Object.assign(store[studentId], data);
    saveLocalStore(store);
  }
}

// 顯示姓名前先跳脫特殊符號，避免名字裡的 < > 破壞畫面
function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function deleteStudentRecord(studentId) {
  if (isCloudMode) {
    await withTimeout(db.collection(COLLECTION_NAME).doc(studentId).delete());
  } else {
    const store = getLocalStore();
    delete store[studentId];
    saveLocalStore(store);
  }
}

// 一次寫入多位學生（雲端用 batch，比一筆一筆寫快很多）
async function saveStudentsBulk(list) {
  if (list.length === 0) return;
  if (isCloudMode) {
    for (let i = 0; i < list.length; i += 400) {
      const batch = db.batch();
      list.slice(i, i + 400).forEach(s => {
        s.updatedAt = Date.now();
        batch.set(db.collection(COLLECTION_NAME).doc(s.id), s, { merge: true });
      });
      await withTimeout(batch.commit());
    }
  } else {
    const store = getLocalStore();
    list.forEach(s => { s.updatedAt = Date.now(); store[s.id] = s; });
    saveLocalStore(store);
  }
}

async function fetchAllStudents() {
  let list;
  if (isCloudMode) {
    const snap = await withTimeout(db.collection(COLLECTION_NAME).get());
    list = [];
    snap.forEach(doc => { if (!isSystemDocId(doc.id)) list.push(normalizeStudent(doc.data(), doc.id)); });
  } else {
    const store = getLocalStore();
    list = Object.keys(store).filter(k => !isSystemDocId(k)).map(k => normalizeStudent(store[k], k));
  }
  return list.sort((a, b) => a.id.localeCompare(b.id));
}

// 遇到雲端錯誤時統一顯示原因
function reportError(action, e) {
  console.error(action + " 失敗：", e);
  alert(`${action}失敗！\n\n${explainFirebaseError(e)}`);
}

/**
 * =========================================================================
 * 4. 學生端狀態與核心遊戲邏輯
 * =========================================================================
 */

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

/* ---------- 登入狀態（同一個分頁內換遊戲不用重新登入） ---------- */
const SESSION_KEY = "kz_student_id";

function setSessionStudent(id) {
  try { sessionStorage.setItem(SESSION_KEY, id); } catch (e) {}
}
function getSessionStudentId() {
  try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch (e) { return ""; }
}
function clearSessionStudent() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}

// 遊戲頁面用：取得目前登入的學生；沒有登入就回到首頁
async function loadSessionStudentOrRedirect() {
  await dbReady;
  const id = getSessionStudentId();
  if (!id) {
    location.href = "index.html";
    return null;
  }
  try {
    if (isCloudMode && cloudError) throw cloudError;
    const stu = await fetchStudent(id);
    if (!stu) {
      clearSessionStudent();
      alert("找不到你的帳號，請重新登入。");
      location.href = "index.html";
      return null;
    }
    return stu;
  } catch (e) {
    reportError("讀取學生資料", e);
    return null;
  }
}

/* ---------- 頁面載入：先連資料庫，再交給各頁面的 onPageReady ---------- */
function applySiteTitle() {
  const title = (SITE && SITE.siteTitle) || SITE_TITLE;
  document.querySelectorAll(".jsSiteTitle").forEach(el => (el.textContent = title));
  if (document.body && document.body.dataset.titleFromSite === "1") document.title = title;
}

window.addEventListener("DOMContentLoaded", async () => {
  applySiteTitle();
  try {
    await initDatabase();
    await ensureDefaultClassExists();   // 要在建立 _settings 之前檢查「資料庫是不是空的」
    await loadSettings();
    applySiteTitle();
  } finally {
    dbReadyResolve();
  }
  if (typeof window.onPageReady === "function") window.onPageReady();
});
