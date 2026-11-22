/* =========================================================
   對稱美食街｜線對稱題庫（康軒五上 第七單元 線對稱圖形）
   題目每次隨機組合產生，分成 11 種題型：
   1. 找線對稱圖形　2. 數對稱軸　3. 虛線是不是對稱軸
   4. 對稱點／對稱邊／對稱角　5. 線對稱的性質　6. 方格上畫完另一半（操作題）
   ========================================================= */

const QS = "#1E2A33";
const QFILL = "#BFE3FF";

// ---------- 圖形庫（畫布 120 x 120） ----------
const SHAPES = {
  isoTri:   { name: "等腰三角形", axes: 1, sym: true,  svg: `<polygon points="60,14 100,104 20,104"/>` },
  eqTri:    { name: "正三角形",   axes: 3, sym: true,  svg: `<polygon points="60,16 106,96 14,96"/>` },
  square:   { name: "正方形",     axes: 4, sym: true,  svg: `<rect x="20" y="20" width="80" height="80"/>` },
  rect:     { name: "長方形",     axes: 2, sym: true,  svg: `<rect x="10" y="32" width="100" height="56"/>` },
  circle:   { name: "圓形",       axes: Infinity, sym: true, svg: `<circle cx="60" cy="60" r="44"/>` },
  rhombus:  { name: "菱形",       axes: 2, sym: true,  svg: `<polygon points="60,10 98,60 60,110 22,60"/>` },
  hexagon:  { name: "正六邊形",   axes: 6, sym: true,  svg: `<polygon points="35,17 85,17 110,60 85,103 35,103 10,60"/>` },
  pentagon: { name: "正五邊形",   axes: 5, sym: true,  svg: `<polygon points="60,12 106,46 88,100 32,100 14,46"/>` },
  kite:     { name: "箏形",       axes: 1, sym: true,  svg: `<polygon points="60,10 94,44 60,110 26,44"/>` },
  isoTrap:  { name: "等腰梯形",   axes: 1, sym: true,  svg: `<polygon points="38,28 82,28 108,94 12,94"/>` },
  heart:    { name: "愛心",       axes: 1, sym: true,  svg: `<path d="M60 104 C20 76 8 54 18 34 C28 16 50 18 60 36 C70 18 92 16 102 34 C112 54 100 76 60 104 Z"/>` },
  arrow:    { name: "箭頭",       axes: 1, sym: true,  svg: `<polygon points="60,10 104,56 76,56 76,108 44,108 44,56 16,56"/>` },
  star:     { name: "星形",       axes: 5, sym: true,  svg: `<polygon points="60,8 72,44 110,44 79,66 91,104 60,81 29,104 41,66 10,44 48,44"/>` },
  cross:    { name: "十字形",     axes: 4, sym: true,  svg: `<polygon points="44,10 76,10 76,44 110,44 110,76 76,76 76,110 44,110 44,76 10,76 10,44 44,44"/>` },
  para:     { name: "平行四邊形", sym: false, svg: `<polygon points="34,30 112,30 86,90 8,90"/>` },
  scalene:  { name: "一般三角形", sym: false, svg: `<polygon points="22,100 104,92 44,18"/>` },
  rightTrap:{ name: "直角梯形",   sym: false, svg: `<polygon points="16,24 66,24 106,96 16,96"/>` },
  bolt:     { name: "閃電",       sym: false, svg: `<polygon points="70,8 26,66 56,66 42,112 96,46 64,46"/>` },
  flag:     { name: "旗子",       sym: false, svg: `<polygon points="24,12 96,32 32,52 32,110 24,110"/>` },
  quad:     { name: "不規則四邊形", sym: false, svg: `<polygon points="18,30 92,14 106,98 34,86"/>` },
  lshape:   { name: "L 形",       sym: false, svg: `<polygon points="22,12 50,12 50,82 100,82 100,108 22,108"/>` },
  shoe:     { name: "靴子",       sym: false, svg: `<polygon points="30,10 60,10 60,70 104,82 104,108 30,108"/>` }
};
const SYM_KEYS = Object.keys(SHAPES).filter(k => SHAPES[k].sym);
const NONSYM_KEYS = Object.keys(SHAPES).filter(k => !SHAPES[k].sym);
// 文字（用粗體字型畫出來）
const SYM_CHARS = ["A", "H", "M", "T", "U", "V", "W", "X", "Y", "O", "中", "田", "王", "日", "木", "目", "申", "米"];
const NONSYM_CHARS = ["F", "G", "J", "L", "N", "P", "R", "S", "Z", "你", "我", "好", "和", "的"];

function shapeSvg(key, extra = "", size = 120) {
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-label="${SHAPES[key].name}">
    <g fill="${QFILL}" stroke="${QS}" stroke-width="3" stroke-linejoin="round">${SHAPES[key].svg}</g>${extra}</svg>`;
}
function charSvg(ch, size = 120) {
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-label="${ch}">
    <text x="60" y="64" text-anchor="middle" dominant-baseline="middle" font-size="86" font-weight="900"
      font-family="Arial, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif" fill="${QFILL}" stroke="${QS}" stroke-width="3">${ch}</text></svg>`;
}

const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sample(a, n) { return shuffle(a).slice(0, n); }

/* 每題的格式：
   { key, type:'choice', prompt, figure?, options:[{html|text}], answer:index, explain }
   { key, type:'grid', prompt, grid:{...}, explain } */

// 1. 找線對稱圖形（或找「不是」的）
function qFindSym() {
  const findNot = Math.random() < 0.35;
  const useChar = Math.random() < 0.35;
  let right, wrongs, html;
  if (useChar) {
    right = findNot ? pick(NONSYM_CHARS) : pick(SYM_CHARS);
    wrongs = sample(findNot ? SYM_CHARS : NONSYM_CHARS, 3);
    html = c => charSvg(c, 92);
  } else {
    right = findNot ? pick(NONSYM_KEYS) : pick(SYM_KEYS);
    wrongs = sample(findNot ? SYM_KEYS : NONSYM_KEYS, 3);
    html = k => shapeSvg(k, "", 92);
  }
  const opts = shuffle([right, ...wrongs]);
  const nameOf = x => SHAPES[x] ? SHAPES[x].name : `「${x}」`;
  return {
    key: "find" + (findNot ? "Not" : "") + ":" + right, type: "choice", grid4: true,
    prompt: findNot ? "下面哪一個<b>不是</b>線對稱圖形？" : "下面哪一個是線對稱圖形？",
    options: opts.map(x => ({ html: html(x) })),
    answer: opts.indexOf(right),
    explain: findNot
      ? `${nameOf(right)}找不到一條直線，可以把它對摺後完全重合，所以不是線對稱圖形。`
      : `${nameOf(right)}可以沿著一條直線對摺，兩邊完全重合，所以是線對稱圖形。`
  };
}

// 2. 數對稱軸
const AXIS_POOL = ["isoTri", "eqTri", "square", "rect", "circle", "rhombus", "hexagon", "pentagon", "kite", "isoTrap", "heart", "cross"];
function qCountAxes() {
  const k = pick(AXIS_POOL);
  const n = SHAPES[k].axes;
  const right = n === Infinity ? "無數條" : n + " 條";
  const pool = ["1 條", "2 條", "3 條", "4 條", "5 條", "6 條", "無數條"].filter(x => x !== right);
  const opts = shuffle([right, ...sample(pool, 3)]);
  return {
    key: "axes:" + k, type: "choice",
    prompt: `這個<b>${SHAPES[k].name}</b>有幾條對稱軸？`,
    figure: shapeSvg(k, "", 150),
    options: opts.map(t => ({ text: t })), answer: opts.indexOf(right),
    explain: n === Infinity ? "圓形只要通過圓心的直線都是對稱軸，所以有無數條。"
      : `${SHAPES[k].name}有 ${n} 條對稱軸。可以想一想：沿著哪幾條線對摺，兩邊會完全重合？`
  };
}

// 3. 虛線是不是對稱軸
const AXIS_CASES = [
  { k: "rect", line: [60, 22, 60, 98], yes: true,  why: "沿著直的中線對摺，左右兩邊完全重合。" },
  { k: "rect", line: [4, 60, 116, 60], yes: true,  why: "沿著橫的中線對摺，上下兩邊完全重合。" },
  { k: "rect", line: [10, 32, 110, 88], yes: false, why: "長方形沿著對角線對摺，兩邊不會完全重合，所以對角線不是對稱軸。" },
  { k: "square", line: [20, 20, 100, 100], yes: true, why: "正方形沿著對角線對摺，兩邊完全重合，對角線是對稱軸。" },
  { k: "square", line: [60, 10, 60, 110], yes: true, why: "正方形沿著直的中線對摺，左右完全重合。" },
  { k: "para", line: [34, 30, 86, 90], yes: false, why: "平行四邊形沿著對角線對摺不會重合，它不是線對稱圖形。" },
  { k: "para", line: [60, 22, 60, 98], yes: false, why: "平行四邊形沿著這條線對摺，兩邊形狀不一樣，不會重合。" },
  { k: "isoTri", line: [60, 8, 60, 112], yes: true, why: "等腰三角形沿著頂點到底邊中點的直線對摺，兩邊完全重合。" },
  { k: "isoTri", line: [10, 70, 110, 70], yes: false, why: "沿著這條橫線對摺，上面和下面的形狀不一樣，不會重合。" },
  { k: "rhombus", line: [60, 4, 60, 116], yes: true, why: "菱形沿著對角線對摺，兩邊完全重合。" },
  { k: "rhombus", line: [22, 60, 98, 60], yes: true, why: "菱形的兩條對角線都是對稱軸。" },
  { k: "rhombus", line: [30, 20, 90, 100], yes: false, why: "這條斜線不是菱形的對角線，對摺後兩邊不會重合。" },
  { k: "kite", line: [60, 4, 60, 116], yes: true, why: "箏形沿著直的對角線對摺，左右完全重合。" },
  { k: "kite", line: [16, 44, 104, 44], yes: false, why: "箏形沿著橫的對角線對摺，上下形狀不一樣，不會重合。" },
  { k: "isoTrap", line: [60, 18, 60, 104], yes: true, why: "等腰梯形沿著上下底中點連線對摺，左右完全重合。" },
  { k: "isoTrap", line: [6, 61, 114, 61], yes: false, why: "等腰梯形上面窄、下面寬，沿著橫線對摺不會重合。" },
  { k: "hexagon", line: [10, 60, 110, 60], yes: true, why: "正六邊形通過相對兩個頂點的直線是對稱軸。" },
  { k: "heart", line: [60, 14, 60, 110], yes: true, why: "愛心沿著中間的直線對摺，左右完全重合。" },
  { k: "heart", line: [8, 56, 112, 56], yes: false, why: "愛心上下形狀不一樣，沿著橫線對摺不會重合。" },
  { k: "arrow", line: [60, 4, 60, 114], yes: true, why: "箭頭沿著中間的直線對摺，左右完全重合。" }
];
function qIsAxis() {
  const c = pick(AXIS_CASES);
  const [x1, y1, x2, y2] = c.line;
  const extra = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#E5484D" stroke-width="3.5" stroke-dasharray="7 5" stroke-linecap="round"/>`;
  return {
    key: "isAxis:" + c.k + ":" + c.line.join(","), type: "choice",
    prompt: `紅色虛線是不是這個${SHAPES[c.k].name}的對稱軸？`,
    figure: shapeSvg(c.k, extra, 160),
    options: [{ text: "是" }, { text: "不是" }], answer: c.yes ? 0 : 1, explain: c.why
  };
}

// 4. 對稱點、對稱邊、對稱角（圖形左右對稱，對稱軸是直的虛線）
const LABEL_FIGS = [
  // 頂點從最上面開始，順時針；onAxis = 在對稱軸上的點
  { name: "箏形", pts: [[60, 10], [100, 46], [60, 112], [20, 46]] },
  { name: "等腰梯形", pts: [[38, 22], [82, 22], [110, 98], [10, 98]] },
  { name: "五邊形", pts: [[60, 8], [108, 44], [90, 108], [30, 108], [12, 44]] },
  { name: "六邊形", pts: [[40, 14], [80, 14], [108, 60], [80, 106], [40, 106], [12, 60]] },
  { name: "房子形", pts: [[60, 6], [112, 50], [90, 50], [90, 112], [30, 112], [30, 50], [8, 50]] }
];
const LETTERS = "ABCDEFGH";
function mirrorIndex(pts, i) {
  const [x, y] = pts[i];
  let best = 0, bd = 1e9;
  pts.forEach(([px, py], j) => { const d = Math.abs(px - (120 - x)) + Math.abs(py - y); if (d < bd) { bd = d; best = j; } });
  return best;
}
function labelSvg(fig, size = 170) {
  const poly = fig.pts.map(p => p.join(",")).join(" ");
  const cx = 60, cy = 60;
  const labels = fig.pts.map(([x, y], i) => {
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    const lx = x + dx / len * 13, ly = y + dy / len * 13;
    return `<text x="${lx}" y="${ly + 5}" text-anchor="middle" font-size="15" font-weight="900" fill="${QS}" font-family="Arial">${LETTERS[i]}</text>`;
  }).join("");
  return `<svg viewBox="-14 -14 148 148" width="${size}" height="${size}">
    <polygon points="${poly}" fill="${QFILL}" stroke="${QS}" stroke-width="3" stroke-linejoin="round"/>
    <line x1="60" y1="-8" x2="60" y2="128" stroke="#E5484D" stroke-width="2.5" stroke-dasharray="6 5"/>
    ${labels}</svg>`;
}
function qPairs() {
  const fig = pick(LABEL_FIGS);
  const n = fig.pts.length;
  const offAxis = [...Array(n).keys()].filter(i => mirrorIndex(fig.pts, i) !== i);
  const kind = pick(["point", "point", "edge", "angle"]);
  const L = i => LETTERS[i];
  let prompt, right, pool, explain;
  if (kind === "point") {
    const i = pick(offAxis), j = mirrorIndex(fig.pts, i);
    prompt = `紅色虛線是對稱軸。<b>${L(i)} 點</b>的對稱點是哪一點？`;
    right = L(j) + " 點";
    pool = [...Array(n).keys()].filter(k => k !== j && k !== i).map(k => L(k) + " 點");
    explain = `沿著對稱軸對摺，${L(i)} 點會和 ${L(j)} 點重合，所以它們是對稱點。`;
  } else if (kind === "edge") {
    // 對稱邊要照對應點的順序寫：邊 AB 的對稱邊是「A 的對稱點」接「B 的對稱點」
    const edges = [...Array(n).keys()].map(i => [i, (i + 1) % n]).map(([a, b]) => a < b ? [a, b] : [b, a]);
    const nm = ([a, b]) => "邊 " + L(a) + L(b);
    const mir = ([a, b]) => [mirrorIndex(fig.pts, a), mirrorIndex(fig.pts, b)];
    const same = (e, f) => (e[0] === f[0] && e[1] === f[1]) || (e[0] === f[1] && e[1] === f[0]);
    const cand = edges.filter(e => !same(mir(e), e));
    const e = pick(cand), m = mir(e);
    prompt = `紅色虛線是對稱軸。<b>${nm(e)}</b> 的對稱邊是哪一條？（要照對應點的順序寫）`;
    right = nm(m);
    const reversed = nm([m[1], m[0]]);
    const others = edges.filter(f => !same(f, e) && !same(f, m)).map(nm);
    pool = [reversed, ...sample(others, 2)];
    explain = `${L(e[0])} 點的對稱點是 ${L(m[0])} 點，${L(e[1])} 點的對稱點是 ${L(m[1])} 點，所以${nm(e)}的對稱邊要照順序寫成${right}（不是${reversed}）。對稱邊一樣長。`;
  } else {
    const i = pick(offAxis), j = mirrorIndex(fig.pts, i);
    prompt = `紅色虛線是對稱軸。<b>角 ${L(i)}</b> 的對稱角是哪一個？`;
    right = "角 " + L(j);
    pool = [...Array(n).keys()].filter(k => k !== j && k !== i).map(k => "角 " + L(k));
    explain = `對摺後角 ${L(i)} 和角 ${L(j)} 重合，所以是對稱角，兩個角一樣大。`;
  }
  const opts = shuffle([right, ...sample(pool, Math.min(3, pool.length))]);
  return {
    key: "pair:" + fig.name + ":" + kind, type: "choice", prompt,
    figure: labelSvg(fig), options: opts.map(t => ({ text: t })), answer: opts.indexOf(right), explain
  };
}

// 5. 線對稱的性質（含計算）
function qProperty() {
  const t = rnd(10);
  if (t === 0) {
    const d = 2 + rnd(8);
    const right = d * 2 + " 公分";
    const opts = shuffle([right, d + " 公分", d * 4 + " 公分", d * 2 + 2 + " 公分"]);
    return { key: "prop:dist", type: "choice",
      prompt: `線對稱圖形中，A 點和 B 點是對稱點。A 點到對稱軸的距離是 ${d} 公分，A 點和 B 點相距幾公分？`,
      options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
      explain: `對稱點到對稱軸的距離一樣，B 點也離對稱軸 ${d} 公分，所以 AB = ${d} + ${d} = ${d * 2} 公分。` };
  }
  if (t === 1) {
    const ab = 6 + rnd(10) * 2;
    const right = ab / 2 + " 公分";
    const opts = shuffle([right, ab + " 公分", ab * 2 + " 公分", ab / 2 + 1 + " 公分"]);
    return { key: "prop:half", type: "choice",
      prompt: `線對稱圖形中，C 點和 D 點是對稱點，CD 長 ${ab} 公分。C 點到對稱軸的距離是幾公分？`,
      options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
      explain: `對稱軸會把 CD 平分成一樣長的兩段，${ab} ÷ 2 = ${ab / 2} 公分。` };
  }
  if (t === 2) {
    const len = 3 + rnd(12);
    const right = len + " 公分";
    const opts = shuffle([right, len * 2 + " 公分", (len + 1) + " 公分", Math.max(1, len - 2) + " 公分"]);
    return { key: "prop:edge", type: "choice",
      prompt: `線對稱圖形中，邊 AB 和邊 EF 是對稱邊。邊 AB 長 ${len} 公分，邊 EF 長幾公分？`,
      options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
      explain: "對稱邊的長度相等。" };
  }
  if (t === 3) {
    const ang = pick([35, 40, 55, 60, 65, 72, 80, 105, 110, 120]);
    const right = ang + " 度";
    const opts = shuffle([right, (180 - ang) + " 度", (90 - ang > 0 ? 90 - ang : ang + 20) + " 度", ang * 2 + " 度"]);
    return { key: "prop:angle", type: "choice",
      prompt: `線對稱圖形中，角 B 和角 F 是對稱角。角 B 是 ${ang} 度，角 F 是幾度？`,
      options: [...new Set(opts)].map(x => ({ text: x })), answer: [...new Set(opts)].indexOf(right),
      explain: "對稱角的大小相等。" };
  }
  const facts = [
    { q: "線對稱圖形中，兩個對稱點的連線和對稱軸有什麼關係？", a: "互相垂直", w: ["互相平行", "一樣長", "沒有關係"],
      e: "對稱點的連線和對稱軸互相垂直，而且被對稱軸平分。" },
    { q: "對稱點的連線和對稱軸相交的角是幾度？", a: "90 度", w: ["45 度", "60 度", "180 度"], e: "對稱點連線和對稱軸互相垂直，所以是 90 度。" },
    { q: "下面關於線對稱圖形的說法，哪一個是<b>對的</b>？", a: "對稱邊一樣長", w: ["對稱角加起來一定是 90 度", "每個線對稱圖形都只有 1 條對稱軸", "對稱點到對稱軸的距離不一樣"],
      e: "對稱邊一樣長、對稱角一樣大、對稱點到對稱軸的距離相等；對稱軸可能有很多條。" },
    { q: "把一張紙對摺後剪下一個圖形再打開，打開後的圖形一定是什麼？", a: "線對稱圖形", w: ["正方形", "圓形", "三角形"],
      e: "摺痕就是對稱軸，兩邊剪下的形狀完全一樣，所以一定是線對稱圖形。" },
    { q: "一個圖形沿著一條直線對摺後，兩邊完全重合，這條直線叫做什麼？", a: "對稱軸", w: ["對角線", "對稱邊", "垂直線"],
      e: "能讓圖形對摺後完全重合的那條直線叫做對稱軸。" },
    { q: "線對稱圖形中，對稱點和對稱軸的距離有什麼關係？", a: "距離相等", w: ["一個比較遠", "加起來是 10 公分", "沒有關係"],
      e: "兩個對稱點到對稱軸的距離一定相等。" }
  ];
  const f = facts[t - 4] || pick(facts);
  const opts = shuffle([f.a, ...f.w]);
  return { key: "prop:fact" + facts.indexOf(f), type: "choice", prompt: f.q,
    options: opts.map(x => ({ text: x })), answer: opts.indexOf(f.a), explain: f.e };
}

// 6. 方格操作題：塗滿另一半，讓圖形變成線對稱圖形
function qGrid() {
  const vertical = Math.random() < 0.65;           // 對稱軸是直的（左右對稱）或橫的（上下對稱）
  const cols = vertical ? 8 : 6, rows = vertical ? 6 : 8;
  const half = vertical ? cols / 2 : rows / 2;
  // 在左半邊（或上半邊）產生一個連在一起的形狀，而且要碰到對稱軸
  const cells = new Set();
  const key = (r, c) => r + "," + c;
  let r0 = vertical ? 1 + rnd(rows - 2) : half - 1, c0 = vertical ? half - 1 : 1 + rnd(cols - 2);
  cells.add(key(r0, c0));
  const target = 4 + rnd(4);
  let guard = 0;
  while (cells.size < target && guard++ < 200) {
    const [r, c] = pick([...cells]).split(",").map(Number);
    const [dr, dc] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    if (vertical ? nc >= half : nr >= half) continue;
    cells.add(key(nr, nc));
  }
  const given = [...cells];
  const answer = given.map(k => {
    const [r, c] = k.split(",").map(Number);
    return vertical ? key(r, cols - 1 - c) : key(rows - 1 - r, c);
  });
  return {
    key: "grid:" + (vertical ? "v" : "h"), type: "grid",
    prompt: `紅線是對稱軸。請點方格，把${vertical ? "右邊" : "下面"}塗好，讓整個圖形變成線對稱圖形。`,
    grid: { rows, cols, vertical, half, given, answer },
    explain: `每一格的對稱格，到對稱軸的距離要一樣，而且在${vertical ? "同一列" : "同一行"}。`
  };
}


// 7. 正多邊形和其他圖形的對稱軸（課本 7-1 第 7、8 題）
function qPolyAxes() {
  const t = rnd(3);
  if (t < 2) {
    const n = 3 + rnd(8);   // 正三角形～正十邊形
    const NAME = { 3: "正三角形", 4: "正方形", 5: "正五邊形", 6: "正六邊形", 7: "正七邊形", 8: "正八邊形", 9: "正九邊形", 10: "正十邊形" };
    const right = n + " 條";
    const pool = [n - 1, n + 1, n * 2, 1, 2, Math.max(1, n - 2)].filter(x => x > 0 && x !== n).map(x => x + " 條");
    const opts = shuffle([right, ...sample([...new Set(pool)], 3)]);
    return { key: "poly:" + n, type: "choice", prompt: `<b>${NAME[n]}</b>有幾條對稱軸？`,
      options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
      explain: `正多邊形有幾條邊，就有幾條對稱軸。${NAME[n]}有 ${n} 條邊，所以有 ${n} 條對稱軸。` };
  }
  const cases = [
    { name: "菱形", a: "2 條", e: "菱形的兩條對角線都是對稱軸，共 2 條。" },
    { name: "平行四邊形", a: "沒有對稱軸", e: "平行四邊形不管怎麼對摺都不會完全重合，不是線對稱圖形。很多人以為兩條對角線是對稱軸，其實不是。" },
    { name: "扇形", a: "1 條", e: "扇形沿著通過圓心、把弧平分的直線對摺，兩邊會重合，有 1 條對稱軸。" },
    { name: "圓形", a: "無數條", e: "通過圓心的直線都是對稱軸，所以有無數條。" },
    { name: "長方形", a: "2 條", e: "長方形沿著兩條中線對摺都會重合，對角線不是對稱軸，共 2 條。" },
    { name: "等腰三角形", a: "1 條", e: "等腰三角形只有 1 條對稱軸，通過頂點和底邊中點。" },
    { name: "箏形", a: "1 條", e: "箏形只有 1 條對稱軸。" },
    { name: "等腰梯形", a: "1 條", e: "等腰梯形只有 1 條對稱軸，通過上下底的中點。" }
  ];
  const c = pick(cases);
  const all = ["沒有對稱軸", "1 條", "2 條", "4 條", "無數條"];
  const opts = shuffle([c.a, ...sample(all.filter(x => x !== c.a), 3)]);
  return { key: "poly:" + c.name, type: "choice", prompt: `<b>${c.name}</b>有幾條對稱軸？`,
    options: opts.map(x => ({ text: x })), answer: opts.indexOf(c.a), explain: c.e };
}

// 8. 是非題（課本 練習百分百、重點整理）
const TF_FACTS = [
  ["線對稱的圖形都只有一條對稱軸。", false, "正方形有 4 條、圓形有無數條對稱軸，所以不一定只有一條。"],
  ["線對稱圖形的對稱邊一樣長。", true, "對摺後對稱邊會完全疊合，所以一樣長。"],
  ["將線對稱圖形的兩個對稱點連起來，它會和對稱軸垂直。", true, "對稱點的連線和對稱軸互相垂直。"],
  ["線對稱圖形的對稱角一樣大。", true, "對摺後對稱角會完全疊合，所以一樣大。"],
  ["平行四邊形的對角線是它的對稱軸。", false, "平行四邊形沿對角線對摺不會重合，它不是線對稱圖形。"],
  ["正方形有 4 條對稱軸。", true, "正方形有 2 條中線和 2 條對角線，共 4 條對稱軸。"],
  ["長方形的對角線也是對稱軸。", false, "長方形只有 2 條對稱軸（兩條中線），對角線不是。"],
  ["兩個對稱點到對稱軸的距離相等。", true, "對稱軸會把對稱點的連線平分。"],
  ["把紙對摺後剪下的圖形，打開後一定是線對稱圖形。", true, "摺痕就是對稱軸，兩邊形狀完全一樣。"],
  ["對摺後兩邊能完全疊合的圖形，叫做線對稱圖形。", true, "這就是線對稱圖形的意思，摺線就是對稱軸。"],
  ["圓形只有 2 條對稱軸。", false, "通過圓心的直線都是對稱軸，圓形有無數條。"],
  ["正五邊形有 5 條對稱軸。", true, "正多邊形有幾條邊就有幾條對稱軸。"],
  ["等腰三角形的兩個底角一樣大。", true, "等腰三角形的兩個底角是對稱角，所以一樣大。"],
  ["線對稱圖形中，對稱點的連線會被對稱軸平分。", true, "兩個對稱點到對稱軸的距離一樣，所以連線被平分。"],
  ["菱形有 4 條對稱軸。", false, "菱形只有 2 條對稱軸，就是它的兩條對角線。"],
  ["對稱軸一定是直的。", true, "對稱軸是對摺的摺線，一定是一條直線。"]
];
function qTF() {
  const f = pick(TF_FACTS);
  return { key: "tf:" + TF_FACTS.indexOf(f), type: "choice", prompt: `下面這句話對不對？<br/>「${f[0]}」`,
    options: [{ text: "對 ○" }, { text: "錯 ×" }], answer: f[1] ? 0 : 1, explain: f[2] };
}

// 9. 方格紙、方格點上的對稱點（課本 7-3）
function qGridDist() {
  const d = 1 + rnd(6), t = rnd(3);
  if (t === 0) {
    const right = d + " 格";
    const opts = shuffle([right, ...sample([...new Set([d + 1, d * 2, Math.max(1, d - 1), d + 2])].filter(x => x !== d).map(x => x + " 格"), 3)]);
    return { key: "dist:1", type: "choice",
      prompt: `在方格紙上，點 A 和對稱軸相距 ${d} 格。點 A 的對稱點 F，應該在對稱軸另一邊的幾格處？`,
      options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
      explain: `對稱點到對稱軸的距離相等，所以點 F 也要和對稱軸相距 ${d} 格。` };
  }
  if (t === 1) {
    const right = d * 2 + " 格";
    const opts = shuffle([right, ...sample([...new Set([d, d * 2 + 1, d * 3, d + 1])].filter(x => x !== d * 2).map(x => x + " 格"), 3)]);
    return { key: "dist:2", type: "choice",
      prompt: `在方格紙上，點 B 和對稱軸相距 ${d} 格。點 B 和它的對稱點相距幾格？`,
      options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
      explain: `兩個對稱點各離對稱軸 ${d} 格，加起來是 ${d} + ${d} = ${d * 2} 格。` };
  }
  const total = 2 * d;
  const right = d + " 格";
  const opts = shuffle([right, ...sample([...new Set([total, d + 1, Math.max(1, d - 1), total + 1])].filter(x => x !== d).map(x => x + " 格"), 3)]);
  return { key: "dist:3", type: "choice",
    prompt: `在方格點上，點 C 和它的對稱點 G 相距 ${total} 格，而且 CG 和對稱軸垂直。點 C 和對稱軸相距幾格？`,
    options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
    explain: `對稱軸把 CG 平分，${total} ÷ 2 = ${d} 格。` };
}

// 10. 用對稱邊算周長（課本 7-2 做做看）
function qPerimeter() {
  const a = 5 + rnd(20), b = 5 + rnd(20), c = 4 + rnd(16);
  if (Math.random() < 0.5) {
    const P = 2 * (a + b + c);
    const right = P + " 公分";
    const opts = shuffle([right, (a + b + c) + " 公分", (P + a) + " 公分", (2 * (a + b) + c) + " 公分"]);
    return { key: "peri:1", type: "choice",
      prompt: `一個六邊形是線對稱圖形，對稱軸通過兩個頂點。它的三組對稱邊，一邊分別長 ${a} 公分、${b} 公分、${c} 公分。這個六邊形的周長是多少？`,
      options: [...new Set(opts)].map(x => ({ text: x })), answer: [...new Set(opts)].indexOf(right),
      explain: `對稱邊一樣長，每一組有 2 條邊：(${a} + ${b} + ${c}) × 2 = ${P} 公分。` };
  }
  const P = 2 * (a + b + c);
  const right = c + " 公分";
  const opts = shuffle([right, ...sample([...new Set([2 * c, c + 2, Math.max(1, c - 2), a + b])].filter(x => x !== c).map(x => x + " 公分"), 3)]);
  return { key: "peri:2", type: "choice",
    prompt: `一個六邊形是線對稱圖形，周長 ${P} 公分。它有三組對稱邊，其中兩組的邊長是 ${a} 公分和 ${b} 公分。第三組的一條邊長幾公分？`,
    options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
    explain: `${P} ÷ 2 = ${a + b + c}，${a + b + c} − ${a} − ${b} = ${c} 公分。` };
}

// 11. 等腰三角形與對稱角（課本 數學想一想）
function qTriAngle() {
  const t = rnd(3);
  const base = pick([30, 35, 40, 45, 50, 55, 60, 65, 70, 75]);
  if (t === 0) {
    const right = base + " 度";
    const opts = shuffle([right, ...sample([...new Set([180 - base, 90 - base, 180 - 2 * base, base + 10])].filter(x => x > 0 && x !== base).map(x => x + " 度"), 3)]);
    return { key: "tri:1", type: "choice",
      prompt: `三角形 ABC 是線對稱圖形，對稱軸通過頂點 A。∠B 是 ${base} 度，∠C 是幾度？`,
      options: opts.map(x => ({ text: x })), answer: opts.indexOf(right),
      explain: `∠B 和 ∠C 是對稱角，對稱角一樣大，所以 ∠C = ${base} 度。` };
  }
  if (t === 1) {
    const apex = 180 - 2 * base;
    const right = apex + " 度";
    const opts = shuffle([right, ...sample([base, 180 - base, 90 - base > 0 ? 90 - base : base + 20, apex + 10].filter(x => x > 0 && x !== apex).map(x => x + " 度"), 3)]);
    return { key: "tri:2", type: "choice",
      prompt: `三角形 ABC 是線對稱圖形，對稱軸通過頂點 A。∠B 是 ${base} 度，∠A 是幾度？`,
      options: [...new Set(opts)].map(x => ({ text: x })), answer: [...new Set(opts)].indexOf(right),
      explain: `∠C 和 ∠B 一樣是 ${base} 度。三角形三個角加起來是 180 度：180 − ${base} − ${base} = ${apex} 度。` };
  }
  const opts = shuffle(["90 度", "45 度", "60 度", "180 度"]);
  return { key: "tri:3", type: "choice",
    prompt: "把等腰三角形 ABC 沿著對稱軸對摺，對稱軸和底邊 BC 相交形成 ∠1 和 ∠2。已知 ∠1 = ∠2，∠1 + ∠2 = 180 度，∠1 是幾度？",
    options: opts.map(x => ({ text: x })), answer: opts.indexOf("90 度"),
    explain: "∠1 和 ∠2 一樣大，加起來是 180 度，所以各是 90 度，對稱軸和底邊互相垂直。" };
}

const Q_MAKERS = [
  { f: qFindSym, w: 3 }, { f: qCountAxes, w: 2 }, { f: qIsAxis, w: 2 },
  { f: qPairs, w: 3 }, { f: qProperty, w: 3 }, { f: qGrid, w: 2 },
  { f: qPolyAxes, w: 2 }, { f: qTF, w: 2 }, { f: qGridDist, w: 2 }, { f: qPerimeter, w: 2 }, { f: qTriAngle, w: 2 }
];
// 產生一組題目（題型盡量不重複）
function makeQuestionSet(n = 3) {
  const out = [], usedMakers = new Set(), usedKeys = new Set();
  let guard = 0;
  while (out.length < n && guard++ < 60) {
    const total = Q_MAKERS.reduce((s, m) => s + (usedMakers.has(m) ? 0 : m.w), 0);
    let x = Math.random() * total, maker = Q_MAKERS[0];
    for (const m of Q_MAKERS) { if (usedMakers.has(m)) continue; x -= m.w; if (x <= 0) { maker = m; break; } }
    const q = maker.f();
    if (usedKeys.has(q.key)) continue;
    usedMakers.add(maker); usedKeys.add(q.key);
    out.push(q);
  }
  return out;
}
const Q_TYPE_NAMES = { find: "找線對稱圖形", axes: "數對稱軸", isAxis: "判斷對稱軸", pair: "對稱點、邊、角", prop: "線對稱的性質", grid: "方格畫另一半",
  poly: "多邊形的對稱軸", tf: "觀念是非題", dist: "方格上的對稱點", peri: "對稱邊與周長", tri: "等腰三角形的角" };
