/* =========================================================
   對稱美食街｜Q 版圖案（裝潢、餐廳背景、擺盤配料）
   每一件裝潢本身都是線對稱圖形（左右對稱）
   ========================================================= */
const ART_INK = "#1E2A33";

/* 裝潢：k = w 掛在牆上、f 放在地上；price 用家鄉幣買 */
const DECOR = [
  { id: "w01", name: "招牌", k: "w", price: 60, svg: `<line x1="30" y1="4" x2="30" y2="22"/><line x1="70" y1="4" x2="70" y2="22"/><rect x="12" y="20" width="76" height="46" rx="10" fill="#FFC83D"/><rect x="20" y="28" width="60" height="30" rx="6" fill="#FFF3C4"/><path d="M34 50 h32 q0 -16 -16 -16 q-16 0 -16 16z" fill="#fff"/><line x1="30" y1="50" x2="70" y2="50"/><line x1="50" y1="34" x2="50" y2="30"/>` },
  { id: "w02", name: "紅燈籠", k: "w", price: 40, svg: `<line x1="50" y1="2" x2="50" y2="16"/><rect x="40" y="14" width="20" height="8" rx="2" fill="#F2C14E"/><ellipse cx="50" cy="48" rx="30" ry="27" fill="#E8513F"/><path d="M50 21 v54 M35 25 q-8 23 0 46 M65 25 q8 23 0 46" fill="none"/><rect x="40" y="74" width="20" height="8" rx="2" fill="#F2C14E"/><path d="M44 82 l-2 14 M50 82 v14 M56 82 l2 14" fill="none"/>` },
  { id: "w03", name: "和風燈籠", k: "w", price: 50, svg: `<line x1="50" y1="2" x2="50" y2="12"/><rect x="34" y="10" width="32" height="9" rx="3" fill="#33434F"/><path d="M34 19 q-8 31 0 62 h32 q8 -31 0 -62z" fill="#FFF8EC"/><path d="M33 34 h34 M31 50 h38 M33 66 h34" fill="none" stroke="#E8513F" stroke-width="4"/><rect x="34" y="81" width="32" height="9" rx="3" fill="#33434F"/>` },
  { id: "w04", name: "吊燈", k: "w", price: 50, svg: `<line x1="50" y1="0" x2="50" y2="30"/><path d="M18 62 q32 -46 64 0z" fill="#FFC83D"/><rect x="18" y="60" width="64" height="6" rx="3" fill="#F2A93B"/><circle cx="50" cy="72" r="9" fill="#FFF3B0"/><path d="M30 86 l-4 6 M50 86 v8 M70 86 l4 6" fill="none" stroke="#F2C14E"/>` },
  { id: "w05", name: "掛畫", k: "w", price: 70, svg: `<line x1="50" y1="4" x2="30" y2="20"/><line x1="50" y1="4" x2="70" y2="20"/><rect x="12" y="20" width="76" height="62" rx="4" fill="#C98B4F"/><rect x="20" y="28" width="60" height="46" fill="#CFEAFF"/><circle cx="50" cy="42" r="8" fill="#FFC83D"/><path d="M20 74 l18 -22 l12 12 l12 -12 l18 22z" fill="#5FB36A"/>` },
  { id: "w06", name: "窗戶", k: "w", price: 80, svg: `<rect x="14" y="10" width="72" height="78" rx="8" fill="#BFE3FF"/><line x1="50" y1="10" x2="50" y2="88"/><line x1="14" y1="49" x2="86" y2="49"/><path d="M14 10 h22 q-6 30 -22 46z" fill="#F7A8C4"/><path d="M86 10 h-22 q6 30 22 46z" fill="#F7A8C4"/><rect x="8" y="86" width="84" height="8" rx="3" fill="#C98B4F"/>` },
  { id: "w07", name: "時鐘", k: "w", price: 50, svg: `<circle cx="50" cy="50" r="38" fill="#7FB5E6"/><circle cx="50" cy="50" r="30" fill="#FFF7E6"/><line x1="50" y1="50" x2="50" y2="28"/><line x1="50" y1="24" x2="50" y2="26"/><line x1="50" y1="74" x2="50" y2="76"/><line x1="24" y1="50" x2="26" y2="50"/><line x1="74" y1="50" x2="76" y2="50"/><circle cx="50" cy="50" r="4" fill="${ART_INK}"/>` },
  { id: "w08", name: "菜單板", k: "w", price: 60, svg: `<line x1="50" y1="2" x2="30" y2="14"/><line x1="50" y1="2" x2="70" y2="14"/><rect x="14" y="14" width="72" height="66" rx="6" fill="#C98B4F"/><rect x="21" y="21" width="58" height="52" rx="3" fill="#2F4B3F"/><line x1="32" y1="34" x2="68" y2="34" stroke="#fff"/><line x1="32" y1="46" x2="68" y2="46" stroke="#fff"/><line x1="38" y1="58" x2="62" y2="58" stroke="#fff"/>` },
  { id: "f01", name: "木桌", k: "f", price: 60, svg: `<rect x="10" y="40" width="80" height="14" rx="5" fill="#C98B4F"/><rect x="20" y="54" width="10" height="40" fill="#A86B36"/><rect x="70" y="54" width="10" height="40" fill="#A86B36"/><ellipse cx="50" cy="34" rx="12" ry="5" fill="#fff"/><path d="M40 34 q10 10 20 0" fill="#fff"/>` },
  { id: "f02", name: "圓桌", k: "f", price: 70, svg: `<ellipse cx="50" cy="44" rx="40" ry="12" fill="#E3B877"/><path d="M10 44 v6 q40 18 80 0 v-6" fill="#C98B4F"/><rect x="44" y="56" width="12" height="30" fill="#A86B36"/><ellipse cx="50" cy="90" rx="22" ry="6" fill="#A86B36"/><circle cx="50" cy="36" r="6" fill="#F7A8C4"/>` },
  { id: "f03", name: "木椅", k: "f", price: 40, svg: `<rect x="30" y="14" width="40" height="42" rx="8" fill="#D9A066"/><line x1="40" y1="24" x2="40" y2="48"/><line x1="60" y1="24" x2="60" y2="48"/><rect x="24" y="56" width="52" height="10" rx="4" fill="#C98B4F"/><rect x="29" y="66" width="8" height="28" fill="#A86B36"/><rect x="63" y="66" width="8" height="28" fill="#A86B36"/>` },
  { id: "f04", name: "高腳椅", k: "f", price: 50, svg: `<ellipse cx="50" cy="26" rx="24" ry="9" fill="#E8513F"/><path d="M26 26 v6 q24 10 48 0 v-6" fill="#C2412D"/><line x1="40" y1="36" x2="32" y2="94"/><line x1="60" y1="36" x2="68" y2="94"/><line x1="35" y1="70" x2="65" y2="70"/>` },
  { id: "f05", name: "吧台", k: "f", price: 150, svg: `<rect x="4" y="34" width="92" height="12" rx="4" fill="#8C5A33"/><rect x="10" y="46" width="80" height="48" rx="4" fill="#C98B4F"/><rect x="18" y="54" width="28" height="32" rx="3" fill="#D9A066"/><rect x="54" y="54" width="28" height="32" rx="3" fill="#D9A066"/><path d="M42 34 v-14 h16 v14" fill="#BFE3FF"/><path d="M26 34 v-10 h10 v10 M64 34 v-10 h10 v10" fill="#FFC83D"/>` },
  { id: "f06", name: "收銀台", k: "f", price: 120, svg: `<rect x="10" y="50" width="80" height="44" rx="6" fill="#7FB5E6"/><rect x="10" y="50" width="80" height="10" rx="4" fill="#5B9BD5"/><rect x="34" y="22" width="32" height="28" rx="4" fill="#E0E7EE"/><rect x="38" y="26" width="24" height="10" rx="2" fill="#4CB782"/><path d="M40 42 h4 M48 42 h4 M56 42 h4" fill="none"/><circle cx="50" cy="74" r="8" fill="#FFC83D"/>` },
  { id: "f07", name: "盆栽", k: "f", price: 40, svg: `<path d="M50 52 q-30 -10 -28 -38 q22 4 28 30 q6 -26 28 -30 q2 28 -28 38z" fill="#5FB36A"/><path d="M50 52 q-6 -25 0 -44 q6 19 0 44" fill="#4A9A56"/><path d="M30 58 h40 l-6 36 h-28z" fill="#E08A55"/><rect x="26" y="52" width="48" height="10" rx="4" fill="#C96F3F"/>` },
  { id: "f08", name: "大盆栽", k: "f", price: 80, svg: `<circle cx="50" cy="26" r="20" fill="#5FB36A"/><circle cx="32" cy="40" r="16" fill="#5FB36A"/><circle cx="68" cy="40" r="16" fill="#5FB36A"/><rect x="46" y="44" width="8" height="24" fill="#A86B36"/><path d="M28 70 h44 l-6 26 h-32z" fill="#E08A55"/><rect x="24" y="64" width="52" height="10" rx="4" fill="#C96F3F"/>` },
  { id: "f09", name: "花瓶", k: "f", price: 40, svg: `<path d="M38 52 q-14 20 0 42 h24 q14 -22 0 -42z" fill="#7FB5E6"/><rect x="40" y="44" width="20" height="10" rx="3" fill="#6AA0D6"/><line x1="50" y1="26" x2="50" y2="44"/><line x1="40" y1="30" x2="46" y2="44"/><line x1="60" y1="30" x2="54" y2="44"/><circle cx="38" cy="26" r="9" fill="#F7A8C4"/><circle cx="62" cy="26" r="9" fill="#F7A8C4"/><circle cx="50" cy="16" r="10" fill="#FFC83D"/>` },
  { id: "f10", name: "地毯", k: "f", price: 60, svg: `<ellipse cx="50" cy="74" rx="44" ry="18" fill="#E8513F"/><ellipse cx="50" cy="74" rx="32" ry="11" fill="#FFC83D"/><ellipse cx="50" cy="74" rx="16" ry="5" fill="#E8513F"/>` },
  { id: "f11", name: "蒸籠架", k: "f", price: 90, svg: `<rect x="18" y="62" width="64" height="24" rx="6" fill="#E3B877"/><rect x="18" y="38" width="64" height="24" rx="6" fill="#E3B877"/><path d="M18 38 q32 -26 64 0z" fill="#D9A866"/><line x1="18" y1="50" x2="82" y2="50" stroke="#B88949"/><line x1="18" y1="74" x2="82" y2="74" stroke="#B88949"/><path d="M40 10 q-4 6 0 12 M60 10 q4 6 0 12 M50 6 v12" fill="none" stroke="#9AA8B3"/>` },
  { id: "f12", name: "披薩窯", k: "f", price: 200, svg: `<path d="M12 94 v-38 q38 -56 76 0 v38z" fill="#D8865C"/><path d="M24 60 h52 M20 76 h60" fill="none" stroke="#B86A45"/><path d="M34 94 v-18 q16 -24 32 0 v18z" fill="#3A2A22"/><path d="M40 94 q10 -14 20 0z" fill="#FF8A3D"/><rect x="43" y="8" width="14" height="18" fill="#B86A45"/>` }
];
const decorById = id => DECOR.find(x => x.id === id);
function decorSvg(id, size = 100) {
  const d = decorById(id);
  if (!d) return "";
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="${d.name}"><g stroke="${ART_INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${d.svg}</g></svg>`;
}

/* 餐廳等級：人氣到了自動升級 */
const SHOP_LEVELS = [
  { name: "小店",     need: 0,   cols: 4, menu: 3, title: "對稱小吃店", awn: "#E8513F", wall: "#FBE3C4", wall2: "#F6CFA3", floor: "#E9C79B", line: "#D1A877" },
  { name: "中型餐廳", need: 1500, cols: 6, menu: 4, title: "對稱美食館", awn: "#2E9E6A", wall: "#F4E6D6", wall2: "#E9CDB0", floor: "#D9B48A", line: "#B98E62" },
  { name: "大餐廳",   need: 5000, cols: 8, menu: 6, title: "對稱大飯店", awn: "#3F6FD8", wall: "#FFF1D6", wall2: "#F2D9A6", floor: "#C9D5DF", line: "#A9B8C6" }
];
// 背景尺寸：每格 100，左右各留 20；牆 1 排、地板 2 排
const SHOP_ROWS = 3;
const shopW = cols => cols * 100 + 40;
const SHOP_H = 440;
const slotRect = (r, c) => ({ x: 20 + c * 100, y: r === 0 ? 108 : (r === 1 ? 232 : 334), w: 100, h: 100 });

function shopBgSvg(lv, showAxis) {
  const L = SHOP_LEVELS[lv], W = shopW(L.cols), mid = W / 2;
  let wallPat = "";
  if (lv === 0) for (let x = 0; x < W; x += 60) wallPat += `<rect x="${x}" y="90" width="30" height="138" fill="${L.wall2}" opacity=".55"/>`;
  else if (lv === 1) for (let y = 98, r = 0; y < 226; y += 22, r++) for (let x = (r % 2 ? -25 : 0); x < W; x += 50) wallPat += `<rect x="${x + 3}" y="${y}" width="44" height="18" rx="3" fill="${L.wall2}" opacity=".8"/>`;
  else for (let y = 104, r = 0; y < 226; y += 30, r++) for (let x = (r % 2 ? 25 : 0); x < W + 25; x += 50) wallPat += `<path d="M${x} ${y - 8} l8 8 l-8 8 l-8 -8z" fill="${L.wall2}"/>`;
  let floorPat = "";
  if (lv === 2) for (let y = 230, r = 0; y < SHOP_H; y += 42, r++) for (let x = (r % 2 ? 42 : 0); x < W; x += 84) floorPat += `<rect x="${x}" y="${y}" width="42" height="42" fill="#E6ECF1"/>`;
  else for (let y = 270; y < SHOP_H; y += 46) floorPat += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${L.line}" stroke-width="3"/>`;
  let scallop = `M10 66 h${W - 20} v12`;
  const n = Math.round((W - 20) / 40), step = (W - 20) / n;
  for (let i = 0; i < n; i++) scallop += ` q${-step / 2} 18 ${-step} 0`;
  scallop += "z";
  let stripes = "";
  for (let i = 0; i < n; i += 2) stripes += `<rect x="${10 + i * step}" y="66" width="${step}" height="12" fill="${L.awn}"/>`;
  return `<svg viewBox="0 0 ${W} ${SHOP_H}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto">
    <rect width="${W}" height="${SHOP_H}" fill="${L.floor}"/>
    <rect y="0" width="${W}" height="228" fill="${L.wall}"/>${wallPat}
    ${floorPat}
    <rect y="224" width="${W}" height="8" fill="${ART_INK}"/>
    <g stroke="${ART_INK}" stroke-width="4" stroke-linejoin="round">
      <rect x="10" y="12" width="${W - 20}" height="54" rx="10" fill="${L.awn}"/>
      <path d="${scallop}" fill="#fff"/>
    </g>
    ${stripes}
    <path d="${scallop}" fill="none" stroke="${ART_INK}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="${mid - 110}" y="20" width="220" height="38" rx="19" fill="#fff" stroke="${ART_INK}" stroke-width="3.5"/>
    <text x="${mid}" y="47" text-anchor="middle" font-size="24" font-weight="900" fill="${ART_INK}" font-family="Huninn, 'Noto Sans TC', sans-serif">${L.title}</text>
    ${showAxis ? `<line x1="${mid}" y1="86" x2="${mid}" y2="${SHOP_H - 4}" stroke="#E5484D" stroke-width="4" stroke-dasharray="10 8"/>` : ""}
  </svg>`;
}

/* 擺盤配料（本身都是線對稱） */
const GARNISH = [
  { id: "tom", name: "番茄片", svg: `<circle cx="0" cy="0" r="13" fill="#F2644E"/><circle cx="0" cy="0" r="8" fill="#FF9A86"/><circle cx="-3" cy="-2" r="1.8" fill="#FFE27A" stroke="none"/><circle cx="3" cy="-2" r="1.8" fill="#FFE27A" stroke="none"/><circle cx="0" cy="3" r="1.8" fill="#FFE27A" stroke="none"/>` },
  { id: "leaf", name: "葉子", svg: `<path d="M0 -15 q13 12 0 30 q-13 -18 0 -30z" fill="#5FB36A"/><line x1="0" y1="-10" x2="0" y2="13"/>` },
  { id: "lemon", name: "檸檬片", svg: `<circle cx="0" cy="0" r="13" fill="#FFE27A"/><circle cx="0" cy="0" r="8.5" fill="#FFF6C4"/><path d="M0 -8 v16 M-7 -4 l14 8 M-7 4 l14 -8" fill="none" stroke="#F2C14E" stroke-width="2"/>` },
  { id: "sauce", name: "醬汁", svg: `<path d="M0 -13 q11 12 8 18 a9 9 0 0 1 -16 0 q-3 -6 8 -18z" fill="#8C4A2F"/><circle cx="-3" cy="3" r="2" fill="#C98063" stroke="none"/>` }
];
const garnishById = id => GARNISH.find(g => g.id === id);
