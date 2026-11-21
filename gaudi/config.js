/* =========================================================================
 *  ★★★【老師設定區】★★★  所有遊戲共用的設定都在這裡
 * ========================================================================= */

// 網站名稱的預設值（之後請到「管理員頁面」admin.html 修改，改那邊就好）
const SITE_TITLE = "班級遊戲教室";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAqzd3DFrLW8bjZwvsRm9kvC48C0m3DDKs",
  authDomain: "fraction-blindbox.firebaseapp.com",
  projectId: "fraction-blindbox",
  storageBucket: "fraction-blindbox.firebasestorage.app",
  messagingSenderId: "673948188539",
  appId: "1:673948188539:web:bd6d443633dfd9973247de",
  measurementId: "G-NPKHYTVZFP"
};

// 第一位老師（第一次使用時自動建立）。之後老師名單、密碼都在管理員頁面管理，這裡只用一次
const FIRST_TEACHER = { name: "凱正老師", password: "0424", prefixes: ["501"], testFrom: "50122" };
// 管理員頁面 admin.html 的「第一次」密碼；第一次登入後一定要改成新密碼
const ADMIN_FIRST_PASSWORD = "admin2026";
const COLLECTION_NAME = "kaizheng_fraction_blindbox_v1";

// ===== 防亂猜設定（可自行調整）=====
// 連續答錯 GUESS_WRONG_LIMIT 題，而且這幾題都在 GUESS_WINDOW_SEC 秒內答完，就暫停作答 GUESS_LOCK_SEC 秒
const GUESS_WRONG_LIMIT = 3;
const GUESS_WINDOW_SEC = 60;
const GUESS_LOCK_SEC = 30;
