/* =========================================================
   校園的魔法探險｜五間教室的 Q 版圖（SVG）
   ========================================================= */
const C_INK = "#1E2A33";
const roomBase = (wall, roof) => `
  <ellipse cx="100" cy="186" rx="82" ry="9" fill="${C_INK}" opacity=".12"/>
  <rect x="24" y="64" width="152" height="114" rx="10" fill="${wall}" stroke="${C_INK}" stroke-width="3.5"/>
  <path d="M16 70 L100 24 L184 70 Z" fill="${roof}" stroke="${C_INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <rect x="84" y="128" width="32" height="50" rx="4" fill="#FFF8E7" stroke="${C_INK}" stroke-width="3"/>
  <circle cx="109" cy="154" r="2.4" fill="${C_INK}"/>`;

const ROOM_ART = {
/* ---------- 自然教室：盆栽、燒杯、放大鏡 ---------- */
nature: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="自然教室">
  ${roomBase("#E6F5E1", "#7CC46B")}
  <g stroke="${C_INK}" stroke-width="3" stroke-linejoin="round">
    <rect x="36" y="84" width="40" height="34" rx="5" fill="#CFEFFF"/>
    <rect x="124" y="84" width="40" height="34" rx="5" fill="#CFEFFF"/>
    <path d="M44 118 h22 l-3 14 h-16 z" fill="#E0875A"/>
    <path d="M55 118 q-2 -16 -12 -20 q12 -2 12 12 q2 -16 14 -16 q-6 10 -14 24" fill="#7CC46B"/>
    <path d="M136 92 v16 l-8 16 h28 l-8 -16 v-16 z" fill="#fff"/>
    <path d="M131 116 h18 l4 8 h-26 z" fill="#8FD3FF" stroke="none"/>
    <circle cx="150" cy="44" r="13" fill="#fff" stroke-width="4"/>
    <path d="M159 53 l12 12" stroke-width="6" stroke-linecap="round"/>
  </g>
  <text x="100" y="62" text-anchor="middle" font-size="15" font-weight="900" fill="${C_INK}">自然</text>
</svg>`,

/* ---------- STEAM LAB：齒輪、火箭、燈泡 ---------- */
steam: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="STEAM LAB">
  ${roomBase("#E8ECFF", "#8A9BEF")}
  <g stroke="${C_INK}" stroke-width="3" stroke-linejoin="round">
    <g transform="translate(56 100)">
      <path d="M-4 -22 h8 l2 6 l6 3 l6 -3 l6 6 l-3 6 l3 6 h6 v8 h-6 l-3 6 l3 6 l-6 6 l-6 -3 l-6 3 l-2 6 h-8 l-2 -6 l-6 -3 l-6 3 l-6 -6 l3 -6 l-3 -6 h-6 v-8 h6 l3 -6 l-3 -6 l6 -6 l6 3 l6 -3 z" fill="#FFC83D" transform="scale(.8)"/>
      <circle r="6" fill="#fff"/>
    </g>
    <path d="M144 120 q-6 -24 6 -40 q12 16 6 40 z" fill="#fff"/>
    <circle cx="150" cy="96" r="4" fill="#8FD3FF"/>
    <path d="M144 120 l-6 8 h6 z M156 120 l6 8 h-6 z" fill="#E8513F"/>
    <path d="M146 124 q4 10 8 0" fill="#FFC83D"/>
    <circle cx="100" cy="46" r="11" fill="#FFF3A6"/>
    <path d="M95 57 h10 v6 h-10 z" fill="#B8C2CC"/>
  </g>
  <text x="100" y="118" text-anchor="middle" font-size="14" font-weight="900" fill="${C_INK}">STEAM</text>
</svg>`,

/* ---------- e化教室：電腦螢幕、雲端 ---------- */
eclass: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="e化教室">
  ${roomBase("#E3F3FB", "#4AA3DF")}
  <g stroke="${C_INK}" stroke-width="3" stroke-linejoin="round">
    <rect x="34" y="82" width="50" height="34" rx="4" fill="#2B3A47"/>
    <rect x="39" y="87" width="40" height="24" rx="2" fill="#8FD3FF" stroke="none"/>
    <path d="M52 116 h14 l3 8 h-20 z" fill="#B8C2CC"/>
    <rect x="116" y="82" width="50" height="34" rx="4" fill="#2B3A47"/>
    <rect x="121" y="87" width="40" height="24" rx="2" fill="#B8F0C8" stroke="none"/>
    <path d="M134 116 h14 l3 8 h-20 z" fill="#B8C2CC"/>
    <path d="M126 50 q-12 0 -10 -10 q2 -8 12 -6 q4 -10 16 -6 q10 2 8 12 q8 2 4 10 z" fill="#fff"/>
  </g>
  <g fill="${C_INK}" font-size="9" font-weight="900"><text x="44" y="103">0101</text><text x="127" y="103">e化</text></g>
</svg>`,

/* ---------- 音樂教室：鋼琴鍵、音符 ---------- */
music: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="音樂教室">
  ${roomBase("#FCE9F3", "#E88BBE")}
  <g stroke="${C_INK}" stroke-width="3" stroke-linejoin="round">
    <rect x="34" y="88" width="132" height="30" rx="4" fill="#fff"/>
    <g stroke-width="2.5"><path d="M50 88 v30 M66 88 v30 M82 88 v30 M118 88 v30 M134 88 v30 M150 88 v30"/></g>
    <g fill="${C_INK}" stroke="none"><rect x="45" y="88" width="9" height="17"/><rect x="61" y="88" width="9" height="17"/><rect x="113" y="88" width="9" height="17"/><rect x="129" y="88" width="9" height="17"/><rect x="145" y="88" width="9" height="17"/></g>
    <circle cx="140" cy="52" r="6" fill="${C_INK}"/><path d="M146 52 v-20 l10 4" fill="none" stroke-width="3"/>
    <circle cx="62" cy="54" r="5" fill="${C_INK}"/><circle cx="76" cy="50" r="5" fill="${C_INK}"/><path d="M67 54 v-18 l14 -4 v18" fill="none"/>
  </g>
</svg>`,

/* ---------- 創客基地：3D 印表機、工具 ---------- */
maker: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="創客基地">
  ${roomBase("#FFF1DC", "#F2A65A")}
  <g stroke="${C_INK}" stroke-width="3" stroke-linejoin="round">
    <rect x="34" y="80" width="48" height="44" rx="4" fill="#fff"/>
    <path d="M38 88 h40" /><rect x="52" y="88" width="12" height="8" fill="#FFC83D"/>
    <path d="M48 118 h20 l-3 -10 h-14 z" fill="#B455D6"/>
    <path d="M124 92 l26 26" stroke-width="7" stroke-linecap="round"/>
    <circle cx="121" cy="89" r="8" fill="#B8C2CC"/>
    <path d="M150 88 l-22 30" stroke-width="5" stroke-linecap="round"/>
    <rect x="146" y="80" width="12" height="12" rx="2" fill="#E8513F" transform="rotate(35 152 86)"/>
  </g>
  <text x="100" y="62" text-anchor="middle" font-size="15" font-weight="900" fill="${C_INK}">創客</text>
</svg>`
};
