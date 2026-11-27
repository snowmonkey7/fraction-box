/* =========================================================
   校園的魔法探險｜角色資料（怪獸、守護精靈、Boss、新招式）
   這個檔案很小，高第遊戲、PvP、教師端也會載入：
   兩個遊戲的夥伴、寶貝道具、薰香和出戰隊伍是共用的。
   題目在 campus-q.js（只有校園遊戲會載入）。
   ========================================================= */

/* ---------------- 可以調整的數值 ---------------- */
const CAMPUS_DAILY_COIN_CAP = 50;     // 這個遊戲每天最多拿幾個金幣（和高第分開算）
const CAMPUS_TIER = 3;                // 五間教室同時開放，強度都一樣（相當於高第的第 3 棟）
const CAMPUS_GUARD_ATK = [20, 22, 24];// 守護精靈當夥伴的攻擊力（每間第 1、2、3 隻）
const CAMPUS_BOSS_NEED = 45;          // 圖鑑收集幾個才能挑戰怪獸∞號
const CAMPUS_INF_NEED = 8;            // 打贏怪獸∞號幾次，得到紀念夥伴

// 題目範圍的名稱（教師端統計也會用到）
const CAMPUS_UNITS = {
  z1: "國語第一課〈幸福筆記本〉", z2: "國語第二課〈做人做事做長久〉", z3: "國語第三課〈孔雀錯了〉",
  z4: "國語第四課〈特別的海〉", z5: "國語第五課〈漫遊花東〉", z6: "國語第六課〈護送螃蟹過馬路〉",
  m1: "數學第一單元 多位小數與加減", m2: "數學第二單元 因數與公因數", m3: "數學第三單元 倍數與公倍數",
  m4: "數學第四單元 擴分、約分與通分", m5: "數學第五單元 多邊形與扇形"
};

// 教室：u 是這間教室出的題目範圍（z = 國語第幾課、m = 數學第幾單元）
const ROOMS = [
  { id: "nature", tier: CAMPUS_TIER, name: "自然教室",  sub: "國語第四課、第六課・數學第二單元", u: ["z4", "z6", "m2"], guardians: ["gc1", "gc2", "gc3"],   foeSkill: "regen" },
  { id: "steam",  tier: CAMPUS_TIER, name: "STEAM LAB", sub: "數學第四單元、第五單元",           u: ["m4", "m5"],       guardians: ["gc4", "gc5", "gc6"],   foeSkill: "eshield" },
  { id: "eclass", tier: CAMPUS_TIER, name: "e化教室",   sub: "國語第一課・數學第一單元",         u: ["z1", "m1"],       guardians: ["gc7", "gc8", "gc9"],   foeSkill: "firewall" },
  { id: "music",  tier: CAMPUS_TIER, name: "音樂教室",  sub: "國語第三課、第五課",               u: ["z3", "z5"],       guardians: ["gc10", "gc11", "gc12"], foeSkill: "quake" },
  { id: "maker",  tier: CAMPUS_TIER, name: "創客基地",  sub: "國語第二課・數學第三單元",         u: ["z2", "m3"],       guardians: ["gc13", "gc14", "gc15"], foeSkill: "patch" }
];

// 野生怪獸：rarity 0 普通、1 稀有、2 傳說（每間 4 普通、2 稀有、1 傳說）
const CAMPUS_WILD = [
  { id: "wc12", b: "nature", name: "嗡嗡蜂",   rarity: 0 },
  { id: "wc16", b: "nature", name: "豆芽眼",   rarity: 0 },
  { id: "wc13", b: "nature", name: "鴨嘴獸",   rarity: 0 },
  { id: "wc29", b: "nature", name: "軟管蟲",   rarity: 0 },
  { id: "wc02", b: "nature", name: "自然書",   rarity: 1 },
  { id: "wc22", b: "nature", name: "細胞糖",   rarity: 1 },
  { id: "wc14", b: "nature", name: "蒲公英獸", rarity: 2 },

  { id: "wc35", b: "steam",  name: "方塊寶",   rarity: 0 },
  { id: "wc30", b: "steam",  name: "天線球",   rarity: 0 },
  { id: "wc34", b: "steam",  name: "條紋星",   rarity: 0 },
  { id: "wc25", b: "steam",  name: "雲朵泥",   rarity: 0 },
  { id: "wc18", b: "steam",  name: "M方塊",    rarity: 1 },
  { id: "wc19", b: "steam",  name: "數學怒",   rarity: 1 },
  { id: "wc27", b: "steam",  name: "複習王",   rarity: 2 },

  { id: "wc03", b: "eclass", name: "甲本仔",   rarity: 0 },
  { id: "wc20", b: "eclass", name: "乙本仔",   rarity: 0 },
  { id: "wc17", b: "eclass", name: "瞌睡鐘",   rarity: 0 },
  { id: "wc04", b: "eclass", name: "暈暈社",   rarity: 0 },
  { id: "wc21", b: "eclass", name: "國語書",   rarity: 1 },
  { id: "wc05", b: "eclass", name: "英文書",   rarity: 1 },
  { id: "wc32", b: "eclass", name: "遙控機",   rarity: 2 },

  { id: "wc07", b: "music",  name: "冰淇淋",   rarity: 0 },
  { id: "wc08", b: "music",  name: "鮭魚卵",   rarity: 0 },
  { id: "wc31", b: "music",  name: "炸雞桶",   rarity: 0 },
  { id: "wc15", b: "music",  name: "火氣人",   rarity: 0 },
  { id: "wc11", b: "music",  name: "雙櫻桃",   rarity: 1 },
  { id: "wc23", b: "music",  name: "大嘴唱",   rarity: 1 },
  { id: "wc01", b: "music",  name: "冰羽精",   rarity: 2 },

  { id: "wc06", b: "maker",  name: "鉛筆人",   rarity: 0 },
  { id: "wc10", b: "maker",  name: "紙片人",   rarity: 0 },
  { id: "wc09", b: "maker",  name: "塗鴉擦",   rarity: 0 },
  { id: "wc26", b: "maker",  name: "毛球羊",   rarity: 0 },
  { id: "wc28", b: "maker",  name: "兜帽畫家", rarity: 1 },
  { id: "wc24", b: "maker",  name: "毛線怪",   rarity: 1 },
  { id: "wc33", b: "maker",  name: "骨頭毛",   rarity: 2 }
];

// 守護精靈：hp 是當對手時的血量；n 是這間教室的第幾隻（1～3），決定當夥伴的愛心和攻擊
const CAMPUS_GUARDIANS = [
  { id: "gc1",  b: "nature", n: 1, name: "刺刺花精",     hp: 220, hearts: 1, skill: "photo" },
  { id: "gc2",  b: "nature", n: 2, name: "叉叉章魚",     hp: 290, hearts: 2, skill: "tentacle" },
  { id: "gc3",  b: "nature", n: 3, name: "放大鏡樹精",   hp: 360, hearts: 3, skill: "forest" },
  { id: "gc4",  b: "steam",  n: 1, name: "齒輪機器人",   hp: 220, hearts: 1, skill: "gear" },
  { id: "gc5",  b: "steam",  n: 2, name: "中科小天使",   hp: 290, hearts: 2, skill: "angel" },
  { id: "gc6",  b: "steam",  n: 3, name: "火箭機械龍",   hp: 360, hearts: 3, skill: "rocket" },
  { id: "gc7",  b: "eclass", n: 1, name: "面具大盜",     hp: 220, hearts: 1, skill: "swap" },
  { id: "gc8",  b: "eclass", n: 2, name: "網路警察",     hp: 290, hearts: 2, skill: "patrol" },
  { id: "gc9",  b: "eclass", n: 3, name: "雲端資料龍",   hp: 360, hearts: 3, skill: "backup" },
  { id: "gc10", b: "music",  n: 1, name: "笑臉氣球",     hp: 220, hearts: 1, skill: "balloon" },
  { id: "gc11", b: "music",  n: 2, name: "條紋音樂怪",   hp: 290, hearts: 2, skill: "rhythm" },
  { id: "gc12", b: "music",  n: 3, name: "鋼琴鯨",       hp: 360, hearts: 3, skill: "whale" },
  { id: "gc13", b: "maker",  n: 1, name: "全能小子",     hp: 220, hearts: 1, skill: "repair" },
  { id: "gc14", b: "maker",  n: 2, name: "紙箱騎士",     hp: 290, hearts: 2, skill: "armor" },
  { id: "gc15", b: "maker",  n: 3, name: "3D列印巨人",   hp: 360, hearts: 3, skill: "copy" }
];

// 守護精靈當對手時的技能（每間教室第 2、3 隻才有；鋼琴鯨的「鯨之歌」可以讓它失效）
const FOE_SKILLS = {
  regen:    { name: "自我修復", desc: "你答錯時，它會回復 15 點血量。" },
  eshield:  { name: "能量護盾", desc: "前 2 次被攻擊，只會受到一半的傷害。" },
  firewall: { name: "防火牆",   desc: "每被攻擊第 3 次，那一次的攻擊會被擋下。" },
  quake:    { name: "震耳欲聾", desc: "你答錯時，站在前面的夥伴少 2 顆愛心。" },
  patch:    { name: "臨時加固", desc: "血量第一次掉到一半以下時，會回復 20% 的血量。" }
};
const FOE_REGEN_HP = 15;
const FOE_PATCH_RATE = 0.2;

// 最終 Boss：怪獸∞號（只有一隻，等級「終極」，可以一直挑戰）
const CAMPUS_BOSS = {
  id: "cboss", b: "boss", name: "怪獸∞號", lv: "inf", hp: 500, reward: 25, repeat: true,
  skillName: "無限黑洞＋∞再生",
  skillDesc: "答錯時，出戰的夥伴全部倒下！血量第一次掉到一半以下時，會回復 50 點血量。"
};
const CAMPUS_BOSS_REGEN = 50;
// 紀念夥伴「怪獸∞號」：打贏 CAMPUS_INF_NEED 次得到（存在 gaudi.beaten.gInf）
const INF_HERO = { id: "gInf", b: "boss", name: "怪獸∞號", hp: 0, hearts: 4, skill: "inf", atk: 30, hero: true };

// 新招式（加進 gaudi-data.js 的 SKILLS）：兩個遊戲都能用
const CAMPUS_SKILLS = {
  photo:    { name: "光合作用", desc: "幫受傷最重的夥伴補 1 顆愛心" },
  tentacle: { name: "觸手纏繞", desc: "接下來 2 次答錯都不會受傷" },
  forest:   { name: "森林之力", desc: "出戰的夥伴每隻都補 1 顆愛心" },
  gear:     { name: "齒輪加速", desc: "接下來 3 次答對，每次多 8 點傷害" },
  angel:    { name: "天使光環", desc: "下一次答對，傷害變兩倍" },
  rocket:   { name: "火箭發射", desc: "不用答題，直接造成 40 點傷害（不會被擋下）" },
  swap:     { name: "偷天換日", desc: "把這一題換掉，換一題新的（不算答錯）" },
  patrol:   { name: "網路巡邏", desc: "拿掉兩個錯的選項" },
  backup:   { name: "雲端備份", desc: "這場戰鬥中，下一隻倒下的夥伴會自動以 1 顆愛心復活" },
  balloon:  { name: "飄飄氣球", desc: "下一次答錯不會受傷" },
  rhythm:   { name: "節奏拍子", desc: "接下來連續答對，傷害依序多 5、10、15 點；答錯就停" },
  whale:    { name: "鯨之歌",   desc: "這場戰鬥中，守護精靈的技能全部失效（對 Boss 沒有用）" },
  repair:   { name: "修理扳手", desc: "讓這場倒下的一隻夥伴以 1 顆愛心回到戰場" },
  armor:    { name: "紙箱盾牌", desc: "站在前面的夥伴多 1 顆暫時的愛心" },
  copy:     { name: "列印複製", desc: "把這場已經用過的另一個夥伴招式，再用一次" },
  inf:      { name: "無限連擊", desc: "接下來 3 次答對，傷害都變 1.5 倍" }
};
const ROCKET_DAMAGE = 40;
const GEAR_BONUS = 8;
const RHYTHM_BONUS = [5, 10, 15];

function campusImg(id) { return "images/campus/" + id + ".jpg"; }
function campusSilhouette(id) { return "images/campus/s_" + id + ".png"; }
const isCampusId = id => /^(wc|gc)\d/.test(id) || id === "cboss" || id === "gInf";
