/* =========================================================
   高第的魔法建築｜四棟建築的 Q 版圖（SVG 向量圖，放大也不會糊）
   ========================================================= */
const INK = "#1E2A33";

const BUILDING_ART = {
/* ---------- 米拉之家：波浪外牆、海帶欄杆、屋頂煙囪武士 ---------- */
mila: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="米拉之家">
  <ellipse cx="100" cy="186" rx="80" ry="9" fill="#1E2A33" opacity=".12"/>
  <!-- 屋頂煙囪（戴頭盔的武士） -->
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M52 52 q-3 -16 6 -22 q9 6 6 22 z" fill="#F4E9D8"/>
    <path d="M50 34 q8 -8 16 0" fill="none"/>
    <circle cx="56" cy="44" r="1.8" fill="${INK}" stroke="none"/><circle cx="61" cy="44" r="1.8" fill="${INK}" stroke="none"/>
    <path d="M92 46 q-2 -20 8 -26 q10 6 8 26 z" fill="#E8DCC6"/>
    <path d="M93 30 h14" />
    <circle cx="97" cy="36" r="1.8" fill="${INK}" stroke="none"/><circle cx="103" cy="36" r="1.8" fill="${INK}" stroke="none"/>
    <path d="M136 52 q-4 -14 5 -20 q9 6 5 20 z" fill="#F4E9D8"/>
    <path d="M136 38 q5 -6 10 0 q-5 4 -10 0z" fill="#FFC83D"/>
  </g>
  <!-- 波浪主體 -->
  <path d="M26 176 V74 q0 -20 18 -22 q14 -2 22 6 q10 -10 24 -8 q14 -10 30 0 q14 -6 26 4 q20 -4 26 16 V176 z"
        fill="#F7EEDF" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- 樓層的波浪線 -->
  <g fill="none" stroke="#C9B590" stroke-width="3" stroke-linecap="round">
    <path d="M30 92 q15 -10 30 0 t30 0 t30 0 t30 0 t22 -2"/>
    <path d="M30 120 q15 10 30 0 t30 0 t30 0 t30 0 t22 2"/>
    <path d="M30 148 q15 -10 30 0 t30 0 t30 0 t30 0 t22 -2"/>
  </g>
  <!-- 窗戶＋海帶欄杆 -->
  <g stroke="${INK}" stroke-width="2.5">
    <g fill="#5BB8F0">
      <rect x="40" y="98" width="18" height="14" rx="7"/><rect x="74" y="98" width="18" height="14" rx="7"/>
      <rect x="108" y="98" width="18" height="14" rx="7"/><rect x="142" y="98" width="18" height="14" rx="7"/>
      <rect x="40" y="126" width="18" height="14" rx="7"/><rect x="108" y="126" width="18" height="14" rx="7"/>
      <rect x="142" y="126" width="18" height="14" rx="7"/>
    </g>
  </g>
  <g fill="none" stroke="#24584A" stroke-width="3" stroke-linecap="round">
    <path d="M38 114 q4 -6 6 0 t6 0 t6 0 t6 0"/><path d="M106 114 q4 -6 6 0 t6 0 t6 0 t6 0"/>
    <path d="M140 142 q4 -6 6 0 t6 0 t6 0 t6 0"/><path d="M72 114 q4 -6 6 0 t6 0 t6 0 t6 0"/>
  </g>
  <!-- 大門 -->
  <path d="M80 176 v-16 q10 -14 20 -14 q10 0 20 14 v16 z" fill="#B98A57" stroke="${INK}" stroke-width="3"/>
  <path d="M100 148 v28" stroke="${INK}" stroke-width="2.5"/>
  <!-- 海浪 -->
  <path d="M14 182 q12 -10 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" fill="none" stroke="#5BB8F0" stroke-width="4" stroke-linecap="round"/>
</svg>`,

/* ---------- 巴特羅之家：彩色碎磁磚、骨頭柱、面具陽臺、龍背屋頂 ---------- */
batllo: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="巴特羅之家">
  <ellipse cx="100" cy="186" rx="68" ry="9" fill="#1E2A33" opacity=".12"/>
  <!-- 十字架小塔 -->
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M44 70 v-30 q6 -8 12 0 v30 z" fill="#F4E9D8"/>
    <path d="M50 30 v-14 M44 22 h12" fill="none" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="50" cy="32" r="5" fill="#FFC83D"/>
  </g>
  <!-- 主體 -->
  <path d="M38 176 V70 h124 V176 z" fill="#8FD0F2" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- 碎磁磚點點 -->
  <g stroke="none">
    <circle cx="52" cy="84" r="4" fill="#4CB782"/><circle cx="70" cy="80" r="3" fill="#9B7FD6"/><circle cx="92" cy="86" r="4" fill="#F2644E"/>
    <circle cx="112" cy="80" r="3" fill="#FFC83D"/><circle cx="132" cy="86" r="4" fill="#4CB782"/><circle cx="150" cy="80" r="3" fill="#9B7FD6"/>
    <circle cx="60" cy="140" r="3" fill="#FFC83D"/><circle cx="140" cy="140" r="3" fill="#F2644E"/><circle cx="100" cy="132" r="3" fill="#9B7FD6"/>
    <circle cx="48" cy="120" r="3" fill="#2E8FD0"/><circle cx="152" cy="118" r="3" fill="#2E8FD0"/><circle cx="82" cy="146" r="3" fill="#4CB782"/>
  </g>
  <!-- 龍背屋頂（鱗片） -->
  <path d="M36 72 q16 -34 64 -40 q48 6 66 40 z" fill="#F2644E" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <g fill="none" stroke="${INK}" stroke-width="2.2">
    <path d="M56 64 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0"/>
    <path d="M70 50 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0"/>
  </g>
  <g fill="#4CB782" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">
    <path d="M58 52 l2 -12 l8 8 z"/><path d="M78 40 l4 -12 l7 10 z"/><path d="M98 34 l6 -12 l6 12 z"/>
    <path d="M118 38 l6 -10 l5 12 z"/><path d="M137 46 l7 -8 l3 12 z"/>
  </g>
  <!-- 面具陽臺 -->
  <g stroke="${INK}" stroke-width="2.5" fill="#FFFFFF">
    <path d="M56 96 q12 -6 24 0 v10 q-12 8 -24 0 z"/>
    <path d="M120 96 q12 -6 24 0 v10 q-12 8 -24 0 z"/>
    <path d="M88 112 q12 -6 24 0 v10 q-12 8 -24 0 z"/>
  </g>
  <g fill="${INK}">
    <circle cx="63" cy="101" r="2.4"/><circle cx="73" cy="101" r="2.4"/>
    <circle cx="127" cy="101" r="2.4"/><circle cx="137" cy="101" r="2.4"/>
    <circle cx="95" cy="117" r="2.4"/><circle cx="105" cy="117" r="2.4"/>
  </g>
  <!-- 骨頭柱 -->
  <g fill="#FFFDF6" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M50 176 v-24 q-4 -4 0 -8 h8 q4 4 0 8 v24 z"/>
    <path d="M142 176 v-24 q-4 -4 0 -8 h8 q4 4 0 8 v24 z"/>
    <path d="M96 176 v-20 q-4 -4 0 -8 h8 q4 4 0 8 v20 z"/>
  </g>
  <g fill="#2E5E8C" stroke="${INK}" stroke-width="2.5">
    <path d="M64 176 v-18 q10 -10 26 0 v18 z"/><path d="M110 176 v-18 q10 -10 26 0 v18 z"/>
  </g>
</svg>`,

/* ---------- 奎爾公園：糖霜屋頂的薑餅屋、藍白格子塔、彩色大蜥蜴 ---------- */
guell: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="奎爾公園">
  <ellipse cx="100" cy="186" rx="82" ry="9" fill="#1E2A33" opacity=".12"/>
  <!-- 藍白格子塔 -->
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M140 150 V64 q8 -10 16 0 V150 z" fill="#FFFFFF"/>
    <g fill="#5BB8F0" stroke="none">
      <rect x="141.5" y="70" width="7" height="8"/><rect x="148.5" y="78" width="7" height="8"/>
      <rect x="141.5" y="86" width="7" height="8"/><rect x="148.5" y="94" width="7" height="8"/>
      <rect x="141.5" y="102" width="7" height="8"/><rect x="148.5" y="110" width="7" height="8"/>
      <rect x="141.5" y="118" width="7" height="8"/><rect x="148.5" y="126" width="7" height="8"/>
    </g>
    <path d="M140 150 V64 q8 -10 16 0 V150 z" fill="none"/>
    <path d="M136 62 q12 -20 24 0 z" fill="#4CB782"/>
    <path d="M148 44 v-10 M143 38 h10" fill="none" stroke-linecap="round"/>
  </g>
  <!-- 薑餅屋 -->
  <path d="M40 176 V104 h76 V176 z" fill="#C98A4B" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- 糖霜屋頂 -->
  <path d="M30 108 q8 -46 48 -56 q40 10 48 56 q-6 8 -12 0 q-6 8 -12 0 q-6 8 -12 0 q-6 10 -12 0 q-6 8 -12 0 q-6 8 -12 0 q-6 8 -12 0 q-6 8 -14 0 z"
        fill="#FFFFFF" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M78 52 v-10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="78" cy="38" r="6" fill="#F2644E" stroke="${INK}" stroke-width="3"/>
  <!-- 糖果點點 -->
  <g stroke="${INK}" stroke-width="1.5">
    <circle cx="56" cy="84" r="3.5" fill="#F2644E"/><circle cx="78" cy="74" r="3.5" fill="#FFC83D"/><circle cx="98" cy="86" r="3.5" fill="#4CB782"/>
  </g>
  <!-- 窗與門 -->
  <g stroke="${INK}" stroke-width="3">
    <rect x="50" y="120" width="16" height="16" rx="3" fill="#FFE9A8"/>
    <rect x="90" y="120" width="16" height="16" rx="3" fill="#FFE9A8"/>
    <path d="M68 176 v-20 q10 -10 20 0 v20 z" fill="#7A4F2A"/>
  </g>
  <path d="M58 120 v16 M50 128 h16 M98 120 v16 M90 128 h16" stroke="${INK}" stroke-width="2"/>
  <!-- 彩色大蜥蜴 -->
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M118 176 q4 -18 22 -18 q18 0 34 -6 q10 -4 12 4 q2 8 -10 10 q-14 2 -18 10 z" fill="#4CB782"/>
    <circle cx="178" cy="156" r="2" fill="${INK}" stroke="none"/>
  </g>
  <g stroke="none">
    <circle cx="140" cy="166" r="3" fill="#FFC83D"/><circle cx="152" cy="164" r="3" fill="#5BB8F0"/><circle cx="164" cy="160" r="3" fill="#F2644E"/>
  </g>
</svg>`,

/* ---------- 聖家堂：高高的尖塔、彩色塔頂、玫瑰窗 ---------- */
sagrada: `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="聖家堂">
  <ellipse cx="100" cy="186" rx="74" ry="9" fill="#1E2A33" opacity=".12"/>
  <g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round">
    <!-- 四座尖塔 -->
    <path d="M38 150 V70 q8 -50 12 -54 q4 4 12 54 V150 z" fill="#D9CBB3"/>
    <path d="M68 150 V54 q10 -50 14 -54 q4 4 14 54 V150 z" fill="#E6DAC4"/>
    <path d="M104 150 V54 q10 -50 14 -54 q4 4 14 54 V150 z" fill="#E6DAC4"/>
    <path d="M138 150 V70 q8 -50 12 -54 q4 4 12 54 V150 z" fill="#D9CBB3"/>
    <!-- 彩色塔頂 -->
    <circle cx="50" cy="16" r="6" fill="#F2644E"/>
    <circle cx="82" cy="2" r="0" fill="none" stroke="none"/>
    <circle cx="82" cy="6" r="6" fill="#FFC83D"/>
    <circle cx="118" cy="6" r="6" fill="#4CB782"/>
    <circle cx="150" cy="16" r="6" fill="#5BB8F0"/>
  </g>
  <!-- 塔上的小洞 -->
  <g fill="${INK}">
    <rect x="47" y="60" width="6" height="9" rx="3"/><rect x="47" y="80" width="6" height="9" rx="3"/><rect x="47" y="100" width="6" height="9" rx="3"/>
    <rect x="79" y="46" width="6" height="9" rx="3"/><rect x="79" y="66" width="6" height="9" rx="3"/><rect x="79" y="86" width="6" height="9" rx="3"/>
    <rect x="115" y="46" width="6" height="9" rx="3"/><rect x="115" y="66" width="6" height="9" rx="3"/><rect x="115" y="86" width="6" height="9" rx="3"/>
    <rect x="147" y="60" width="6" height="9" rx="3"/><rect x="147" y="80" width="6" height="9" rx="3"/><rect x="147" y="100" width="6" height="9" rx="3"/>
  </g>
  <!-- 正門 -->
  <path d="M30 176 V128 q70 -26 140 0 V176 z" fill="#EFE5D2" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- 玫瑰窗（彩繪玻璃） -->
  <g stroke="${INK}" stroke-width="2.5">
    <circle cx="100" cy="134" r="13" fill="#FFFFFF"/>
    <path d="M100 121 v26 M87 134 h26" />
    <path d="M100 121 a13 13 0 0 1 13 13 h-13z" fill="#F2644E"/>
    <path d="M87 134 a13 13 0 0 1 13 -13 v13z" fill="#5BB8F0"/>
    <path d="M100 147 a13 13 0 0 1 -13 -13 h13z" fill="#FFC83D"/>
    <path d="M113 134 a13 13 0 0 1 -13 13 v-13z" fill="#4CB782"/>
  </g>
  <g stroke="${INK}" stroke-width="3" fill="#7A4F2A">
    <path d="M86 176 v-14 q14 -10 28 0 v14 z"/>
    <path d="M48 176 v-12 q8 -8 16 0 v12 z"/><path d="M136 176 v-12 q8 -8 16 0 v12 z"/>
  </g>
</svg>`
};
