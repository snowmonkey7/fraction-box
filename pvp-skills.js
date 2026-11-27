/* =========================================================
   PvP 競技場｜每隻角色的對戰技能
   - 每隻角色一場對戰只能用一次；倒下的角色不能用
   - 只能在「上一題結束 → 下一題出現」的 5 秒內使用，而且每段時間每人只能用 1 個技能
   - 數字可以在這裡調整
   ========================================================= */
const PVP_SKILL_SEC = 5;      // 每題出現前，可以用技能的秒數（第一題前也有）
const PVP_JAM_SEC = 2;        // 干擾：對手要多等幾秒才能作答
const PVP_HEAL = 30;          // 補血
const PVP_HEAL_ALL = 15;      // 大家補血
const PVP_SNIPE = 20;         // 偷襲
const PVP_COUNTER = 15;       // 反擊
const PVP_PIERCE = 10;        // 破甲多出的傷害

const PVP_SKILLS = {
  pw:      { name: "蓄力一擊",   icon: "💥", desc: "下一次攻擊，傷害變 1.5 倍" },
  sh:      { name: "護盾",       icon: "🛡️", desc: "下一次被攻擊，傷害減半" },
  wall:    { name: "鐵壁",       icon: "🧱", desc: "下一次被攻擊，完全擋下" },
  heal:    { name: "補血",       icon: "💚", desc: `前面的夥伴回復 ${PVP_HEAL} 血` },
  heal2:   { name: "大家補血",   icon: "🌿", desc: `每隻還在場上的夥伴回復 ${PVP_HEAL_ALL} 血` },
  snipe:   { name: "偷襲",       icon: "🗡️", desc: `馬上對對手前面的夥伴造成 ${PVP_SNIPE} 傷害` },
  drain:   { name: "吸血",       icon: "🩸", desc: "下一次攻擊打掉的血，一半補回前面的夥伴" },
  hint:    { name: "小提示",     icon: "💡", desc: "下一題幫你拿掉一個錯的選項" },
  jam:     { name: "干擾",       icon: "🌀", desc: `下一題對手要多等 ${PVP_JAM_SEC} 秒才能作答` },
  retry:   { name: "再一次",     icon: "🔁", desc: "下一題答錯不會被鎖住，可以再答一次" },
  counter: { name: "反擊",       icon: "🌵", desc: `下一次被攻擊時，對手前面的夥伴也受到 ${PVP_COUNTER} 傷害` },
  pierce:  { name: "破甲",       icon: "🔨", desc: `下一次攻擊不怕護盾和鐵壁，傷害再加 ${PVP_PIERCE}` },
  back:    { name: "背刺",       icon: "🎯", desc: "下一次攻擊改打對手最後面還在場上的夥伴" },
  swap:    { name: "換位",       icon: "🔄", desc: "前面的夥伴和下一隻還在場上的夥伴交換位置" },
  angel:   { name: "天使祝福",   icon: "👼", desc: "前面的夥伴回復 20 血，而且下一次被攻擊傷害減半" },
  magic:   { name: "魔法建築",   icon: "🏰", desc: "下一次被攻擊完全擋下，而且下一次攻擊傷害變 2 倍" },
  inf:     { name: "無限連擊",   icon: "♾️", desc: "接下來 3 次攻擊，傷害都變 1.5 倍" }
};

// 每隻角色的技能（高第的魔法建築 + 校園的魔法探險）
const PVP_SKILL_OF = {
  // 高第：野生怪獸
  w13: "sh", w17: "pw", w11: "hint", w19: "drain", w15: "wall",
  w8: "snipe", w14: "sh", w5: "pw", w20: "counter", w4: "snipe",
  w6: "drain", w9: "retry", w18: "counter", w10: "heal", w16: "pierce",
  w3: "jam", w2: "jam", w7: "back", w12: "heal", w1: "heal2",
  // 高第：守護精靈
  g12: "drain", g11: "snipe", g10: "back", g9: "sh", g8: "pierce", g7: "pw",
  g6: "heal", g5: "wall", g4: "counter", g3: "heal2", g2: "wall", g1: "heal2",
  // 校園：野生怪獸
  wc12: "heal", wc16: "heal", wc13: "snipe", wc29: "counter", wc02: "hint", wc22: "drain", wc14: "heal2",
  wc35: "pw", wc30: "back", wc34: "swap", wc25: "sh", wc18: "pierce", wc19: "pw", wc27: "hint",
  wc03: "sh", wc20: "retry", wc17: "jam", wc04: "jam", wc21: "hint", wc05: "hint", wc32: "back",
  wc07: "swap", wc08: "swap", wc31: "drain", wc15: "pw", wc11: "counter", wc23: "jam", wc01: "heal2",
  wc06: "snipe", wc10: "retry", wc09: "retry", wc26: "sh", wc28: "pierce", wc24: "pierce", wc33: "wall",
  // 校園：守護精靈
  gc1: "heal", gc2: "counter", gc3: "heal2", gc4: "pierce", gc5: "angel", gc6: "snipe",
  gc7: "back", gc8: "hint", gc9: "retry", gc10: "swap", gc11: "swap", gc12: "jam",
  gc13: "swap", gc14: "wall", gc15: "wall",
  // 紀念夥伴
  gHero: "magic", gInf: "inf"
};
const pvpSkillOf = id => PVP_SKILLS[PVP_SKILL_OF[id] || "pw"];
