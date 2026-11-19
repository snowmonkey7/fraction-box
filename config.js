/* =========================================================================
 *  ★★★【老師設定區】★★★  所有遊戲共用的設定都在這裡
 * ========================================================================= */

// 網站名稱（顯示在登入頁與遊戲目錄）
const SITE_TITLE = "凱正老師的遊戲教室";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAqzd3DFrLW8bjZwvsRm9kvC48C0m3DDKs",
  authDomain: "fraction-blindbox.firebaseapp.com",
  projectId: "fraction-blindbox",
  storageBucket: "fraction-blindbox.firebasestorage.app",
  messagingSenderId: "673948188539",
  appId: "1:673948188539:web:bd6d443633dfd9973247de",
  measurementId: "G-NPKHYTVZFP"
};

const TEACHER_PASSWORD = "0424";
const COLLECTION_NAME = "kaizheng_fraction_blindbox_v1";

// ===== 防亂猜設定（可自行調整）=====
// 連續答錯 GUESS_WRONG_LIMIT 題，而且這幾題都在 GUESS_WINDOW_SEC 秒內答完，就暫停作答 GUESS_LOCK_SEC 秒
const GUESS_WRONG_LIMIT = 3;
const GUESS_WINDOW_SEC = 60;
const GUESS_LOCK_SEC = 30;
