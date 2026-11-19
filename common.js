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
    return "這個學生帳號已經被老師刪除了，請重新整理頁面或找凱正老師。";
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
  badge.className = "text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800";
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
    snap.forEach(doc => list.push(normalizeStudent(doc.data(), doc.id)));
  } else {
    const store = getLocalStore();
    list = Object.keys(store).map(k => normalizeStudent(store[k], k));
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
window.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".jsSiteTitle").forEach(el => (el.textContent = SITE_TITLE));
  try {
    await initDatabase();
    await ensureDefaultClassExists();
  } finally {
    dbReadyResolve();
  }
  if (typeof window.onPageReady === "function") window.onPageReady();
});
