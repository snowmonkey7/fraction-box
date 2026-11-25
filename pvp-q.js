/* =========================================================
   PvP 競技場｜題庫
   每題格式：{ q: 題目, a: 正確答案, w: [3 個錯誤選項] }
   目前先暫時用〈高第的魔法建築〉的題目（不含閱讀短文題，搶答要短題目）。
   之後換新範圍時，把 PVP_QUESTIONS 換成新的題目陣列就好。
   ========================================================= */
const PVP_QUESTIONS = (typeof GAUDI_QUESTIONS !== "undefined" ? GAUDI_QUESTIONS : [])
  .filter(x => !x.p && Array.isArray(x.w) && x.w.length >= 3)
  .map(x => ({ q: x.q, a: x.a, w: x.w.slice(0, 3) }));
