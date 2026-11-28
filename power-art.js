/* =========================================================
   小小的力量｜地圖繪製（SVG）
   worldMapSVG(state)：個人的世界地圖（夜晚的地球，點亮的地點會發光）
   schoolMapSVG(lit)：全班的學校地圖（lit = 已點亮幾個地點，依 POWER_SPOTS 順序）
   ========================================================= */

const POWER_DEFS = `
  <radialGradient id="pwGlow"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".95"/><stop offset=".35" stop-color="#FFC45C" stop-opacity=".55"/><stop offset="1" stop-color="#FF9A3C" stop-opacity="0"/></radialGradient>
  <radialGradient id="pwGlowSoft"><stop offset="0" stop-color="#FFD98A" stop-opacity=".55"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
  <filter id="pwPaper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 .95  0 0 0 0 .85  0 0 0 .07 0" result="g"/>
    <feComposite in="g" in2="SourceGraphic" operator="in" result="t"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="t"/></feMerge>
  </filter>
  <filter id="pwBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="pwBlurBig" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>`;

function pwStars(w, h, n, seed) {
  let s = seed, out = "";
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const x = (rnd() * w).toFixed(0), y = (rnd() * h).toFixed(0), r = (rnd() * 1.1 + .3).toFixed(1), o = (rnd() * .5 + .25).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF6D8" opacity="${o}"/>`;
  }
  return out;
}

/* ---------------- 個人的世界地圖 ---------------- */
// state: { lit: {L01: true...}, open: {r1: true...}, sel: "L05" }
function pwLocPos(L) {
  if (!L.inset) return { x: L.x, y: L.y };
  const I = POWER_INSET;
  return { x: I.cx + L.x, y: I.cy + L.y };
}
function worldMapSVG(state) {
  const lit = state.lit || {}, open = state.open || {};
  const I = POWER_INSET;
  // 點亮的地點：在地圖上鋪一層暖色光暈（越多越亮）
  const pools = POWER_LOCS.filter(L => lit[L.id]).map(L => {
    const p = L.inset ? { x: I.twx, y: I.twy } : { x: L.tx || L.x, y: L.ty || L.y };
    return `<circle cx="${p.x}" cy="${p.y}" r="46" fill="url(#pwGlowSoft)"/>`;
  }).join("");
  const twLit = POWER_LOCS.some(L => L.inset && lit[L.id]);
  const leaders = POWER_LOCS.filter(L => !L.inset && L.tx != null).map(L =>
    `<line x1="${L.tx}" y1="${L.ty}" x2="${L.x}" y2="${L.y}" stroke="${lit[L.id] ? "#FFD27A" : "#8FA3B8"}" stroke-width=".8" stroke-dasharray="2 2" opacity=".8"/><circle cx="${L.tx}" cy="${L.ty}" r="1.6" fill="${lit[L.id] ? "#FFE3A0" : "#8FA3B8"}"/>`).join("");
  const pins = POWER_LOCS.map(L => {
    const p = pwLocPos(L), on = !!lit[L.id], can = !!open[L.r], sel = state.sel === L.id;
    const r = L.inset ? 6.5 : 7.5;
    let g = `<g class="pw-pin${on ? " is-lit" : ""}${can ? "" : " is-locked"}${sel ? " is-sel" : ""}" data-id="${L.id}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${L.name}${on ? "（已點亮）" : ""}">`;
    g += `<circle r="16" fill="transparent"/>`;
    if (on) g += `<circle r="${r * 3}" fill="url(#pwGlow)" class="pw-halo"/>`;
    if (sel) g += `<circle r="${r + 5}" fill="none" stroke="#FFF6D8" stroke-width="1.6" stroke-dasharray="3 2.4" class="pw-sel-ring"/>`;
    if (L.star) {
      const st = (R, k) => Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? R * k : R; return `${(rr * Math.cos(a)).toFixed(1)},${(rr * Math.sin(a)).toFixed(1)}`; }).join(" ");
      g += `<polygon points="${st(r + 2, .45)}" fill="${on ? "#FFE08A" : (can ? "#3B4C63" : "#2A3647")}" stroke="${on ? "#FFF3C9" : (can ? "#C9D6E6" : "#4C5B70")}" stroke-width="1.4"/>`;
    } else {
      g += `<circle r="${r}" fill="${on ? "#FFE08A" : (can ? "#33445A" : "#232F3F")}" stroke="${on ? "#FFF3C9" : (can ? "#C9D6E6" : "#4C5B70")}" stroke-width="1.6"/>`;
      g += on ? `<circle r="${r * .45}" fill="#FFF8E1"/>` : `<text y="${r * .42}" text-anchor="middle" font-size="${r * 1.15}" font-weight="900" fill="${can ? "#E6EEF7" : "#5D6C80"}">${Number(L.id.slice(1))}</text>`;
    }
    return g + "</g>";
  }).join("");
  const labels = [
    ["非洲", 548, 240], ["亞洲", 700, 92], ["美洲", 205, 112], ["歐洲", 520, 58], ["太平洋", 120, 170]
  ].map(([t, x, y]) => `<text x="${x}" y="${y}" font-size="13" fill="#B9C8DA" opacity=".55" font-weight="700" letter-spacing="4">${t}</text>`).join("");
  return `<svg viewBox="0 -24 1000 400" xmlns="http://www.w3.org/2000/svg" class="pw-world">
  <defs>${POWER_DEFS}
    <linearGradient id="pwSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1830"/><stop offset=".55" stop-color="#122744"/><stop offset="1" stop-color="#1B3556"/></linearGradient>
    <linearGradient id="pwLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A4B5C"/><stop offset="1" stop-color="#2C3B4C"/></linearGradient>
    <clipPath id="pwInsetClip"><circle cx="${I.cx}" cy="${I.cy}" r="${I.r}"/></clipPath>
  </defs>
  <rect x="0" y="-24" width="1000" height="400" fill="url(#pwSea)"/>
  ${pwStars(1000, 400, 90, 11).replace(/cy="(\d+)"/g, (m, v) => `cy="${v - 24}"`)}
  <path d="${POWER_LAND}" fill="#0E1C30" transform="translate(2 3)" opacity=".6"/>
  <path d="${POWER_LAND}" fill="url(#pwLand)" stroke="#55697F" stroke-width=".7" filter="url(#pwPaper)"/>
  <g style="mix-blend-mode:screen">${pools}</g>
  ${labels}
  ${leaders}
  <line x1="${I.twx}" y1="${I.twy}" x2="${I.cx - I.r * .72}" y2="${I.cy - I.r * .7}" stroke="${twLit ? "#FFD27A" : "#9BB0C6"}" stroke-width="1" stroke-dasharray="3 2"/>
  <circle cx="${I.twx}" cy="${I.twy}" r="5" fill="none" stroke="${twLit ? "#FFD27A" : "#9BB0C6"}" stroke-width="1"/>
  <g>
    <circle cx="${I.cx}" cy="${I.cy}" r="${I.r + 3}" fill="${twLit ? "#FFCE73" : "#6F86A0"}" opacity=".35"/>
    <circle cx="${I.cx}" cy="${I.cy}" r="${I.r}" fill="#14294A" stroke="${twLit ? "#FFE1A0" : "#A9BCD1"}" stroke-width="1.6"/>
    <g clip-path="url(#pwInsetClip)">
      <path d="M${I.cx + 14} ${I.cy - 42} C${I.cx + 22} ${I.cy - 38} ${I.cx + 26} ${I.cy - 30} ${I.cx + 22} ${I.cy - 18} C${I.cx + 18} ${I.cy - 2} ${I.cx + 16} ${I.cy + 16} ${I.cx + 10} ${I.cy + 34} C${I.cx + 7} ${I.cy + 44} ${I.cx + 2} ${I.cy + 46} ${I.cx} ${I.cy + 40} C${I.cx - 6} ${I.cy + 28} ${I.cx - 16} ${I.cy + 16} ${I.cx - 20} ${I.cy + 2} C${I.cx - 24} ${I.cy - 12} ${I.cx - 16} ${I.cy - 26} ${I.cx - 4} ${I.cy - 36} C${I.cx + 2} ${I.cy - 41} ${I.cx + 8} ${I.cy - 44} ${I.cx + 14} ${I.cy - 42}Z" fill="url(#pwLand)" stroke="#8197AE" stroke-width="1" filter="url(#pwPaper)"/>
      ${POWER_LOCS.filter(L => L.inset && lit[L.id]).map(L => `<circle cx="${I.cx + L.x}" cy="${I.cy + L.y}" r="20" fill="url(#pwGlowSoft)"/>`).join("")}
    </g>
    <text x="${I.cx}" y="${I.cy + I.r + 15}" text-anchor="middle" font-size="12" font-weight="900" fill="#FFE7B0" letter-spacing="3">家鄉臺灣</text>
  </g>
  ${pins}
</svg>`;
}

/* ---------------- 全班的學校地圖 ---------------- */
// 10 個地點的位置（viewBox 0 0 1000 1240）
const SCHOOL_SPOT_POS = {
  S1: [510, 968], S2: [510, 1062], S3: [530, 738], S4: [628, 212], S5: [548, 318],
  S6: [312, 92], S7: [535, 438], S8: [748, 968], S9: [300, 968], S10: [530, 1150]
};
function pwWindows(x, y, w, h, cols, rows, on, seed) {
  let s = seed || 3, out = "";
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const cw = w / cols, rh = h / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lit = on ? rnd() > .12 : rnd() > .93;
    out += `<rect x="${(x + c * cw + cw * .2).toFixed(1)}" y="${(y + r * rh + rh * .22).toFixed(1)}" width="${(cw * .6).toFixed(1)}" height="${(rh * .5).toFixed(1)}" rx="1.5" fill="${lit ? (on ? "#FFD982" : "#C9A55A") : "#1C2838"}" opacity="${lit ? (on ? 1 : .55) : .9}"/>`;
  }
  return out;
}
function pwBuilding(x, y, w, h, opt) {
  // 簡單的俯視建築：屋頂＋側面＋窗戶
  const on = opt.on, roof = on ? "#5E5A6E" : "#2E3A4C", side = on ? "#3F3D52" : "#202B3B";
  const depth = opt.depth || 14;
  let g = "";
  if (on) g += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * .75}" ry="${h * .95 + 20}" fill="url(#pwGlowSoft)"/>`;
  g += `<rect x="${x + 4}" y="${y + depth + 6}" width="${w}" height="${h}" rx="6" fill="#0A121D" opacity=".45"/>`;
  g += `<rect x="${x}" y="${y + depth}" width="${w}" height="${h}" rx="5" fill="${side}"/>`;
  g += pwWindows(x + 4, y + depth + h * .15, w - 8, h * .8, opt.cols || Math.max(3, Math.round(w / 18)), opt.rows || 2, on, opt.seed);
  g += `<rect x="${x}" y="${y}" width="${w}" height="${depth + 4}" rx="5" fill="${roof}" stroke="${on ? "#FFE3A0" : "#3E4D62"}" stroke-width="${on ? 1.5 : 1}"/>`;
  if (opt.label) g += `<text x="${x + w / 2}" y="${y + depth - 1}" text-anchor="middle" font-size="12" font-weight="900" fill="${on ? "#FFF1C9" : "#8EA0B6"}">${opt.label}</text>`;
  return g;
}
function schoolMapSVG(lit) {
  const on = id => POWER_SPOTS.findIndex(s => s.id === id) < lit;
  const glow = (id, rx, ry) => on(id) ? `<ellipse cx="${SCHOOL_SPOT_POS[id][0]}" cy="${SCHOOL_SPOT_POS[id][1]}" rx="${rx}" ry="${ry}" fill="url(#pwGlow)" opacity=".75" class="pw-spot-glow"/>` : "";
  let s = `<svg viewBox="0 0 1000 1240" xmlns="http://www.w3.org/2000/svg" class="pw-school">
  <defs>${POWER_DEFS}
    <linearGradient id="pwNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D1A2E"/><stop offset="1" stop-color="#16263B"/></linearGradient>
    <linearGradient id="pwGrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1F3A34"/><stop offset="1" stop-color="#18302C"/></linearGradient>
    <linearGradient id="pwGrassOn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5C8A4E"/><stop offset="1" stop-color="#3F6B3D"/></linearGradient>
  </defs>
  <rect width="1000" height="1240" fill="url(#pwNight)"/>
  ${pwStars(1000, 1240, 70, 5)}
  <!-- 校地 -->
  <path d="M150 40 L600 30 L700 120 L880 150 L900 520 L150 520 Z" fill="url(#pwGrass)" filter="url(#pwPaper)"/>
  <rect x="80" y="520" width="860" height="46" fill="#2A3445"/>
  <text x="900" y="550" text-anchor="end" font-size="13" fill="#6F8197" font-weight="700">40M 計畫道路</text>`;
  // 水池（S6）
  s += glow("S6", 90, 60);
  s += `<ellipse cx="312" cy="92" rx="58" ry="32" fill="${on("S6") ? "#4FA3C7" : "#1D3550"}" stroke="${on("S6") ? "#BEE8F7" : "#30496A"}" stroke-width="2"/>
  <ellipse cx="296" cy="84" rx="20" ry="7" fill="#fff" opacity="${on("S6") ? .35 : .08}"/>`;
  // 國中部 I、H
  s += pwBuilding(170, 112, 110, 46, { on: false, label: "I 國中部", seed: 11 });
  s += pwBuilding(250, 176, 200, 40, { on: false, label: "H 國中部", seed: 12 });
  // 籃球場
  s += `<rect x="380" y="92" width="150" height="70" rx="4" fill="#22403F" stroke="#3E6460"/><line x1="455" y1="92" x2="455" y2="162" stroke="#3E6460"/><circle cx="455" cy="127" r="12" fill="none" stroke="#3E6460"/>`;
  // 高中部 C、B
  s += pwBuilding(190, 250, 210, 44, { on: false, label: "C 高中部", seed: 13 });
  s += pwBuilding(190, 330, 210, 44, { on: false, label: "B 高中部", seed: 14 });
  // 中庭綠地與步道（S5）
  s += glow("S5", 130, 110);
  s += `<path d="M430 236 Q520 220 600 250 L640 300 Q630 390 560 410 L440 406 Q420 330 430 236Z" fill="${on("S5") ? "url(#pwGrassOn)" : "#1B3530"}" stroke="${on("S5") ? "#CDEBA6" : "#2C4A44"}" stroke-width="2"/>
  <path d="M470 400 C500 360 470 320 520 290 S600 270 590 240" fill="none" stroke="${on("S5") ? "#E8C98E" : "#33463F"}" stroke-width="10" stroke-linecap="round"/>`;
  for (const [tx, ty] of [[455, 270], [610, 320], [585, 380], [470, 350], [540, 330]]) {
    s += `<circle cx="${tx}" cy="${ty}" r="11" fill="${on("S5") ? "#6FAE5A" : "#21403A"}"/><circle cx="${tx - 3}" cy="${ty - 3}" r="4" fill="${on("S5") ? "#A6D97E" : "#2A4A43"}"/>`;
  }
  // G 餐廳（S4）
  s += pwBuilding(570, 168, 120, 40, { on: on("S4"), label: "G 餐廳", seed: 21, rows: 1 });
  // 球場、F 宿舍
  s += `<rect x="660" y="250" width="170" height="80" rx="4" fill="#22403F" stroke="#3E6460"/><line x1="745" y1="250" x2="745" y2="330" stroke="#3E6460"/>`;
  s += pwBuilding(840, 200, 50, 170, { on: false, label: "F", seed: 15, cols: 2, rows: 6 });
  // A0 行政大樓（高中部）、A1 圖資大樓（S7）、E 活動中心
  s += pwBuilding(190, 420, 170, 44, { on: false, label: "A0 行政大樓", seed: 16 });
  s += glow("S7", 150, 80);
  s += pwBuilding(430, 412, 210, 46, { on: on("S7"), label: "A1 圖資大樓", seed: 22 });
  s += `<path d="M690 400 Q760 360 830 400 L830 486 L690 486 Z" fill="#202B3B" stroke="#3E4D62"/><text x="760" y="452" text-anchor="middle" font-size="12" font-weight="900" fill="#8EA0B6">E 活動中心</text>`;
  // 操場（S3）
  s += glow("S3", 300, 160);
  s += `<rect x="190" y="600" width="680" height="280" rx="12" fill="${on("S3") ? "url(#pwGrassOn)" : "#1A332D"}" filter="url(#pwPaper)"/>
  <rect x="250" y="640" width="560" height="200" rx="100" fill="none" stroke="${on("S3") ? "#E0815E" : "#3A3E52"}" stroke-width="26"/>
  <rect x="250" y="640" width="560" height="200" rx="100" fill="none" stroke="${on("S3") ? "#FFE0CC" : "#4A5068"}" stroke-width="1" stroke-dasharray="6 6"/>
  <rect x="330" y="680" width="400" height="120" rx="60" fill="${on("S3") ? "#6FA35B" : "#1E3A32"}"/>
  <text x="530" y="746" text-anchor="middle" font-size="16" font-weight="900" fill="${on("S3") ? "#FFF6DA" : "#7D90A6"}" letter-spacing="6">操場</text>`;
  // 國小部（一大棟：左＝行政辦公室 S9、中＝教室 S1、右＝活動中心 S8；前面走廊與樓梯 S2）
  s += `<rect x="190" y="896" width="680" height="12" fill="#2A3445"/>`;
  s += glow("S9", 120, 80) + glow("S1", 150, 80) + glow("S8", 120, 80);
  s += pwBuilding(200, 918, 190, 70, { on: on("S9"), label: "行政辦公室", seed: 31, rows: 3 });
  s += pwBuilding(392, 918, 236, 70, { on: on("S1"), label: "國小部教室", seed: 32, rows: 3 });
  s += pwBuilding(630, 918, 230, 70, { on: on("S8"), label: "活動中心", seed: 33, rows: 3 });
  s += `<text x="530" y="910" text-anchor="middle" font-size="13" font-weight="900" fill="#C9D6E6" letter-spacing="4">國小部</text>`;
  // 走廊與樓梯（S2）
  s += glow("S2", 330, 40);
  s += `<rect x="200" y="1008" width="660" height="22" rx="4" fill="${on("S2") ? "#C9A46A" : "#273244"}" stroke="${on("S2") ? "#FFE3A0" : "#3E4D62"}"/>`;
  for (const sx of [378, 618]) {
    s += `<rect x="${sx}" y="1000" width="24" height="40" rx="3" fill="${on("S2") ? "#E7C487" : "#2E3A4C"}" stroke="${on("S2") ? "#FFF1C9" : "#45556B"}"/>`;
    for (let k = 0; k < 5; k++) s += `<line x1="${sx + 3}" y1="${1006 + k * 7}" x2="${sx + 21}" y2="${1006 + k * 7}" stroke="${on("S2") ? "#9C7A45" : "#3A4859"}" stroke-width="1.5"/>`;
  }
  s += `<text x="530" y="1024" text-anchor="middle" font-size="11" font-weight="900" fill="${on("S2") ? "#3A2A12" : "#7D90A6"}">走廊與樓梯</text>`;
  // 校門口（S10）
  s += glow("S10", 150, 60);
  s += `<rect x="80" y="1180" width="860" height="44" fill="#2A3445"/>
  <rect x="440" y="1118" width="16" height="64" rx="3" fill="${on("S10") ? "#E9D3A6" : "#2E3A4C"}"/><rect x="604" y="1118" width="16" height="64" rx="3" fill="${on("S10") ? "#E9D3A6" : "#2E3A4C"}"/>
  <path d="M434 1124 Q530 1080 626 1124" fill="none" stroke="${on("S10") ? "#FFE3A0" : "#45556B"}" stroke-width="10" stroke-linecap="round"/>
  <text x="530" y="1158" text-anchor="middle" font-size="13" font-weight="900" fill="${on("S10") ? "#FFF1C9" : "#7D90A6"}">校門口</text>`;
  for (const lx of [420, 640]) s += `<circle cx="${lx}" cy="1112" r="6" fill="${on("S10") ? "#FFE7A0" : "#3B4A5E"}"/>${on("S10") ? `<circle cx="${lx}" cy="1112" r="22" fill="url(#pwGlow)"/>` : ""}`;
  // 地點編號標籤
  POWER_SPOTS.forEach((sp, i) => {
    const [x, y] = SCHOOL_SPOT_POS[sp.id], o = i < lit;
    const by = { S1: y + 8, S8: y + 8, S9: y + 8, S2: y - 43, S7: y - 52 }[sp.id] ?? y - 46;
    const bx = { S2: 250 }[sp.id] ?? x;
    s += `<g class="pw-spot${o ? " is-lit" : ""}" data-spot="${sp.id}" transform="translate(${bx} ${by})" tabindex="0" role="button" aria-label="${sp.name}">
      <circle r="15" fill="${o ? "#FFD966" : "#22303F"}" stroke="${o ? "#FFF6D8" : "#8FA3B8"}" stroke-width="2"/>
      <text y="5" text-anchor="middle" font-size="14" font-weight="900" fill="${o ? "#4A3305" : "#C9D6E6"}">${i + 1}</text></g>`;
  });
  return s + "</svg>";
}
