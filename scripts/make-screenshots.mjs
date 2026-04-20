// 스토어/콘솔 등록용 스크린샷 — 순수 SVG (foreignObject / emoji 미사용)
import { writeFileSync } from "node:fs";

const W = 636, H = 1048;
const C = {
  bg: "#F6F6F9",
  primary: "#0D9488",
  primaryLight: "#F0FDFA",
  primaryPale: "#ECFDF5",
  g900: "#111827", g700: "#374151", g500: "#6B7280",
  g300: "#D1D5DB", g100: "#F3F4F6", g50: "#F9FAFB",
  gold: "#FBBF24", goldLight: "#FEF3C7",
  red: "#EF4444",
};
const FONT = "'Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif";

const statusBar = `
  <rect width="${W}" height="54" fill="${C.bg}"/>
  <text x="40" y="34" font-family="${FONT}" font-size="20" font-weight="700" fill="${C.g900}">9:41</text>
  <g fill="${C.g900}" transform="translate(${W - 130} 18)">
    <rect x="0" y="8" width="6" height="10" rx="1"/>
    <rect x="10" y="5" width="6" height="13" rx="1"/>
    <rect x="20" y="2" width="6" height="16" rx="1"/>
    <rect x="44" y="4" width="42" height="16" rx="3" fill="none" stroke="${C.g900}" stroke-width="1.5"/>
    <rect x="46" y="6" width="32" height="12" rx="1" fill="${C.g900}"/>
  </g>
`;

const top = (title, sub) => `
  <text x="40" y="130" font-family="${FONT}" font-size="34" font-weight="900" letter-spacing="-1" fill="${C.g900}">${title}</text>
  <text x="40" y="165" font-family="${FONT}" font-size="14" font-weight="500" fill="${C.g500}">${sub}</text>
`;

// 탭 아이콘: 이모지 대신 간단한 SVG 글리프
const iconBook = (x, y, color) => `
  <g transform="translate(${x - 14} ${y})" fill="${color}">
    <rect x="0" y="0" width="28" height="20" rx="2"/>
    <rect x="13" y="2" width="2" height="16" fill="${C.bg}"/>
  </g>
`;
const iconHands = (x, y, color) => `
  <g transform="translate(${x} ${y + 10})" fill="${color}">
    <path d="M -10,-10 L -4,4 C -3,7 -5,9 -8,9 L -12,9 C -14,9 -16,7 -15,5 Z"/>
    <path d="M 10,-10 L 4,4 C 3,7 5,9 8,9 L 12,9 C 14,9 16,7 15,5 Z"/>
  </g>
`;
const iconUser = (x, y, color) => `
  <g transform="translate(${x} ${y + 10})" fill="${color}">
    <circle cx="0" cy="-6" r="6"/>
    <path d="M -12,10 C -12,2 -6,-2 0,-2 C 6,-2 12,2 12,10 Z"/>
  </g>
`;

const tabBar = (active) => {
  const y = H - 100;
  const gap = W / 3;
  const tabs = [
    { key: "quiz", label: "퀴즈", icon: iconBook },
    { key: "prayer", label: "기도", icon: iconHands },
    { key: "character", label: "인물", icon: iconUser },
  ];
  return `
    <rect x="0" y="${y}" width="${W}" height="100" fill="rgba(255,255,255,0.95)"/>
    <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.g100}"/>
    ${tabs.map((t, i) => {
      const cx = gap * i + gap / 2;
      const color = active === t.key ? C.primary : "#9CA3AF";
      const fw = active === t.key ? 900 : 600;
      return `
        ${active === t.key ? `<rect x="${cx - 12}" y="${y + 2}" width="24" height="4" rx="2" fill="${C.primary}"/>` : ""}
        ${t.icon(cx, y + 20, color)}
        <text x="${cx}" y="${y + 74}" font-family="${FONT}" font-size="13" font-weight="${fw}" text-anchor="middle" fill="${color}">${t.label}</text>
      `;
    }).join("")}
  `;
};

const sheet = (height, content) => {
  const topY = H - height - 40;
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="#000" opacity="0.35"/>
    <rect x="0" y="${topY}" width="${W}" height="${height + 40}" rx="28" fill="#FFFFFF"/>
    <rect x="${W/2 - 22}" y="${topY + 12}" width="44" height="5" rx="2.5" fill="${C.g300}"/>
    <g transform="translate(0 ${topY + 34})">${content}</g>
  `;
};

// Twemoji 경로 (작은 이모지 필요 시)
const CROSS_TWEMOJI = `
  <path fill="#FCD34D" d="M -9,-44 L 9,-44 L 9,-12 L 30,-12 L 30,6 L 9,6 L 9,44 L -9,44 L -9,6 L -30,6 L -30,-12 L -9,-12 Z"/>
`;

// ─────────── 1. 퀴즈 ───────────
const quiz = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar}
  ${top("오늘의 말씀", "성경 퀴즈로 말씀을 즐겨보세요")}

  <g transform="translate(40 200)">
    <text font-family="${FONT}" font-size="13" font-weight="700" fill="${C.primary}">문제 3 / 10</text>
    <rect x="0" y="14" width="${W - 80}" height="8" rx="4" fill="${C.g100}"/>
    <rect x="0" y="14" width="${(W - 80) * 0.3}" height="8" rx="4" fill="${C.primary}"/>
  </g>

  <g transform="translate(28 260)">
    <rect width="${W - 56}" height="320" rx="20" fill="#FFFFFF"/>
    <text x="24" y="40" font-family="${FONT}" font-size="12" font-weight="800" fill="${C.primary}" letter-spacing="1">구약 · 창세기</text>
    <text x="24" y="86" font-family="${FONT}" font-size="19" font-weight="800" fill="${C.g900}">하나님이 노아에게 방주를</text>
    <text x="24" y="116" font-family="${FONT}" font-size="19" font-weight="800" fill="${C.g900}">만들라 명하신 이유는?</text>

    <g transform="translate(24 164)">
      <rect width="${W - 104}" height="46" rx="12" fill="${C.g100}"/>
      <text x="20" y="30" font-family="${FONT}" font-size="15" fill="${C.g700}">1. 방주를 자랑하기 위해</text>
    </g>
    <g transform="translate(24 218)">
      <rect width="${W - 104}" height="46" rx="12" fill="${C.primaryPale}" stroke="${C.primary}" stroke-width="2"/>
      <text x="20" y="30" font-family="${FONT}" font-size="15" font-weight="700" fill="${C.primary}">2. 홍수 심판에서 가족 구원</text>
    </g>
    <g transform="translate(24 272)">
      <rect width="${W - 104}" height="32" rx="10" fill="${C.g100}"/>
      <text x="20" y="22" font-family="${FONT}" font-size="14" fill="${C.g700}">3. 동물을 관리하기 위해</text>
    </g>
  </g>

  ${tabBar("quiz")}

  ${sheet(430, `
    <g transform="translate(40 0)">
      <circle cx="28" cy="28" r="28" fill="${C.primaryPale}"/>
      <path d="M 18,30 L 26,38 L 40,22" stroke="${C.primary}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <text x="76" y="24" font-family="${FONT}" font-size="14" font-weight="800" fill="${C.primary}" letter-spacing="1">정답입니다!</text>
      <text x="76" y="52" font-family="${FONT}" font-size="22" font-weight="900" fill="${C.g900}">+10점 획득</text>

      <g transform="translate(0 80)">
        <rect width="${W - 80}" height="170" rx="16" fill="${C.g50}"/>
        <text x="20" y="30" font-family="${FONT}" font-size="12" font-weight="800" fill="${C.primary}" letter-spacing="1">관련 말씀 · 창세기 6:13-14</text>
        <text x="20" y="62" font-family="${FONT}" font-size="14" fill="${C.g700}">"내가 한 끝 날이 내 앞에 이르렀으니…</text>
        <text x="20" y="86" font-family="${FONT}" font-size="14" fill="${C.g700}">너는 잣나무로 너를 위하여 방주를 지으라"</text>
        <text x="20" y="124" font-family="${FONT}" font-size="13" fill="${C.g500}">해설: 하나님은 의로운 노아의 가정을</text>
        <text x="20" y="146" font-family="${FONT}" font-size="13" fill="${C.g500}">홍수 심판에서 구원하셨어요.</text>
      </g>

      <g transform="translate(0 272)">
        <rect width="${W - 80}" height="56" rx="14" fill="${C.primary}"/>
        <text x="${(W - 80) / 2}" y="36" font-family="${FONT}" font-size="17" font-weight="800" text-anchor="middle" fill="#FFFFFF">다음 문제</text>
      </g>
    </g>
  `)}
</svg>`;

// ─────────── 2. 기도 ───────────
const prayer = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar}
  ${top("오늘의 말씀", "상황에 맞는 기도문을 읽어보세요")}

  <g transform="translate(28 200)">
    <rect width="${W - 56}" height="44" rx="12" fill="${C.g50}"/>
    <text x="20" y="28" font-family="${FONT}" font-size="13" font-weight="700" fill="${C.g700}">30대 · 직장인 · 기혼</text>
    <text x="${W - 76 - 10}" y="28" font-family="${FONT}" font-size="12" font-weight="800" fill="${C.primary}" text-anchor="end">수정</text>
  </g>

  <g transform="translate(28 260)">
    <rect width="108" height="36" rx="18" fill="${C.primary}"/>
    <text x="54" y="24" font-family="${FONT}" font-size="13" font-weight="800" text-anchor="middle" fill="#FFFFFF">✨ 맞춤</text>
    <g transform="translate(116 0)"><rect width="60" height="36" rx="18" fill="${C.g100}"/><text x="30" y="24" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="middle" fill="${C.g500}">전체</text></g>
    <g transform="translate(184 0)"><rect width="60" height="36" rx="18" fill="${C.g100}"/><text x="30" y="24" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="middle" fill="${C.g500}">감사</text></g>
    <g transform="translate(252 0)"><rect width="60" height="36" rx="18" fill="${C.g100}"/><text x="30" y="24" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="middle" fill="${C.g500}">치유</text></g>
  </g>

  <g transform="translate(28 320)">
    <rect width="${W - 56}" height="40" rx="12" fill="${C.primaryLight}"/>
    <text x="${(W - 56) / 2}" y="26" font-family="${FONT}" font-size="13" font-weight="800" text-anchor="middle" fill="${C.primary}">12개 기도 완료 • 보기</text>
  </g>

  <g transform="translate(28 380)">
    <rect width="${W - 56}" height="78" rx="16" fill="#FFFFFF"/>
    <text x="20" y="30" font-family="${FONT}" font-size="11" font-weight="800" fill="${C.primary}" letter-spacing="1">직장</text>
    <text x="20" y="58" font-family="${FONT}" font-size="16" font-weight="700" fill="${C.g900}">상사와의 관계를 위한 기도</text>

    <g transform="translate(0 90)">
      <rect width="${W - 56}" height="78" rx="16" fill="#FFFFFF"/>
      <text x="20" y="30" font-family="${FONT}" font-size="11" font-weight="800" fill="${C.primary}" letter-spacing="1">가정</text>
      <text x="20" y="58" font-family="${FONT}" font-size="16" font-weight="700" fill="${C.g900}">부부 관계를 위한 기도</text>
    </g>
  </g>

  ${tabBar("prayer")}

  ${sheet(530, `
    <g transform="translate(36 14)">
      <text font-family="${FONT}" font-size="11" font-weight="800" fill="${C.primary}" letter-spacing="1">직장 · 맞춤</text>
      <text y="32" font-family="${FONT}" font-size="22" font-weight="900" fill="${C.g900}">출근길의 기도</text>

      <g font-family="${FONT}" font-size="15" fill="${C.g700}">
        <text y="72">사랑하는 하나님, 오늘도 저를 일터로</text>
        <text y="100">보내시는 주님께 감사드립니다.</text>
        <text y="140">바쁜 아침 한 걸음마다 주님과 동행하게</text>
        <text y="168">하시고, 오늘 만나는 사람들을 사랑으로</text>
        <text y="196">품게 하소서. 예수님의 이름으로, 아멘.</text>
      </g>

      <g transform="translate(0 228)">
        <rect width="${W - 72}" height="76" rx="12" fill="${C.goldLight}"/>
        <text x="20" y="28" font-family="${FONT}" font-size="11" font-weight="800" fill="#B45309" letter-spacing="1">관련 말씀 · 시편 118:24</text>
        <text x="20" y="54" font-family="${FONT}" font-size="13" fill="${C.g700}">"이 날은 여호와께서 정하신 것이라</text>
        <text x="20" y="72" font-family="${FONT}" font-size="13" fill="${C.g700}">이 날에 우리가 즐거워하고 기뻐하리로다"</text>
      </g>

      <g transform="translate(0 324)">
        <rect width="${W - 72}" height="52" rx="14" fill="${C.primary}"/>
        <text x="${(W - 72) / 2}" y="34" font-family="${FONT}" font-size="16" font-weight="800" text-anchor="middle" fill="#FFFFFF">따라 읽기</text>
      </g>
      <g transform="translate(0 388)">
        <rect width="${W - 72}" height="52" rx="14" fill="${C.primaryLight}" stroke="${C.primary}" stroke-width="2"/>
        <text x="${(W - 72) / 2}" y="34" font-family="${FONT}" font-size="16" font-weight="800" text-anchor="middle" fill="${C.primary}">읽음 표시 (아멘)</text>
      </g>
    </g>
  `)}
</svg>`;

// ─────────── 3. 인물 ───────────
const character = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar}
  ${top("오늘의 말씀", "성경 인물을 만나보세요")}

  <g transform="translate(28 200)">
    <g>
      <rect width="${(W - 72) / 2}" height="170" rx="20" fill="#FFFFFF"/>
      <circle cx="${(W - 72) / 4}" cy="70" r="40" fill="${C.goldLight}"/>
      <g transform="translate(${(W - 72) / 4 - 18} 52)">
        <path fill="${C.gold}" d="M 0,20 L 6,0 L 12,14 L 18,0 L 24,14 L 30,0 L 36,20 Z"/>
      </g>
      <text x="${(W - 72) / 4}" y="146" font-family="${FONT}" font-size="15" font-weight="800" text-anchor="middle" fill="${C.g900}">다윗 · 왕</text>
    </g>
    <g transform="translate(${(W - 72) / 2 + 16} 0)">
      <rect width="${(W - 72) / 2}" height="170" rx="20" fill="#FFFFFF"/>
      <circle cx="${(W - 72) / 4}" cy="70" r="40" fill="${C.primaryPale}"/>
      <g transform="translate(${(W - 72) / 4 - 14} 50)" fill="${C.primary}">
        <path d="M 14,0 C 18,0 28,4 28,14 C 28,24 18,30 14,30 C 10,30 0,24 0,14 C 0,4 10,0 14,0 Z"/>
      </g>
      <text x="${(W - 72) / 4}" y="146" font-family="${FONT}" font-size="15" font-weight="800" text-anchor="middle" fill="${C.g900}">노아 · 의인</text>
    </g>
    <g transform="translate(0 190)">
      <rect width="${(W - 72) / 2}" height="170" rx="20" fill="#FFFFFF"/>
      <circle cx="${(W - 72) / 4}" cy="70" r="40" fill="#FEE2E2"/>
      <text x="${(W - 72) / 4}" y="146" font-family="${FONT}" font-size="15" font-weight="800" text-anchor="middle" fill="${C.g900}">모세 · 지도자</text>
    </g>
    <g transform="translate(${(W - 72) / 2 + 16} 190)">
      <rect width="${(W - 72) / 2}" height="170" rx="20" fill="#FFFFFF"/>
      <circle cx="${(W - 72) / 4}" cy="70" r="40" fill="#DBEAFE"/>
      <text x="${(W - 72) / 4}" y="146" font-family="${FONT}" font-size="15" font-weight="800" text-anchor="middle" fill="${C.g900}">아브라함 · 믿음</text>
    </g>
  </g>

  ${tabBar("character")}

  ${sheet(560, `
    <g>
      <circle cx="${W / 2}" cy="64" r="56" fill="${C.goldLight}"/>
      <g transform="translate(${W / 2 - 22} 46)">
        <path fill="${C.gold}" d="M 0,24 L 8,0 L 16,18 L 22,0 L 28,18 L 36,0 L 44,24 Z"/>
      </g>
      <text x="${W / 2}" y="158" font-family="${FONT}" font-size="28" font-weight="900" text-anchor="middle" fill="${C.g900}">다윗</text>
      <text x="${W / 2}" y="186" font-family="${FONT}" font-size="13" font-weight="600" text-anchor="middle" fill="${C.g500}">이스라엘의 두 번째 왕 · 목자 출신</text>

      <g transform="translate(36 210)">
        <rect width="${W - 72}" height="96" rx="16" fill="${C.g50}"/>
        <text x="20" y="30" font-family="${FONT}" font-size="11" font-weight="800" fill="${C.primary}" letter-spacing="1">핵심 이야기</text>
        <text x="20" y="58" font-family="${FONT}" font-size="14" fill="${C.g700}">골리앗을 물맷돌로 쓰러뜨린 소년 목자,</text>
        <text x="20" y="80" font-family="${FONT}" font-size="14" fill="${C.g700}">주님의 마음에 합한 사람이었어요.</text>
      </g>

      <g transform="translate(36 322)">
        <rect width="${W - 72}" height="96" rx="16" fill="${C.g50}"/>
        <text x="20" y="30" font-family="${FONT}" font-size="11" font-weight="800" fill="${C.primary}" letter-spacing="1">대표 말씀 · 시편 23:1</text>
        <text x="20" y="58" font-family="${FONT}" font-size="14" fill="${C.g700}">"여호와는 나의 목자시니 내게</text>
        <text x="20" y="80" font-family="${FONT}" font-size="14" fill="${C.g700}">부족함이 없으리로다"</text>
      </g>

      <g transform="translate(36 436)">
        <rect width="${W - 72}" height="52" rx="14" fill="${C.primary}"/>
        <text x="${(W - 72) / 2}" y="34" font-family="${FONT}" font-size="16" font-weight="800" text-anchor="middle" fill="#FFFFFF">이 인물 퀴즈 풀기</text>
      </g>
    </g>
  `)}
</svg>`;

// ─────────── 4. 가로형 ───────────
const LW = 1504, LH = 741;
const panelW = (LW - 80) / 3;
const landscape = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LW} ${LH}" width="${LW}" height="${LH}">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14B8A6"/>
      <stop offset="100%" stop-color="#0F766E"/>
    </linearGradient>
  </defs>
  <rect width="${LW}" height="${LH}" fill="url(#bg2)"/>

  <text x="${LW / 2}" y="100" font-family="${FONT}" font-size="60" font-weight="900" text-anchor="middle" fill="#FFFFFF" letter-spacing="-2">오늘의 말씀</text>
  <text x="${LW / 2}" y="148" font-family="${FONT}" font-size="22" font-weight="500" text-anchor="middle" fill="#FFFFFF" opacity="0.88">성경 퀴즈 · 맞춤 기도 · 성경 인물 — 하루 5분의 은혜</text>

  ${[
    { tag: "QUIZ", label: "성경 퀴즈", line1: "500문제로", line2: "말씀을 재미있게", accent: "${C.goldLight}" },
    { tag: "PRAYER", label: "맞춤 기도", line1: "내 삶에 꼭 맞는", line2: "387개 기도문", accent: "#DBEAFE" },
    { tag: "CHAR", label: "성경 인물", line1: "인물의 이야기와", line2: "대표 말씀 함께", accent: "#FCE7F3" },
  ].map((p, i) => {
    const x = 40 + (panelW + 20) * i;
    const cx = x + panelW / 2;
    return `
      <g transform="translate(${x} 200)">
        <rect width="${panelW}" height="${LH - 240}" rx="28" fill="#FFFFFF" opacity="0.96"/>
      </g>
      <rect x="${x + 28}" y="232" width="${panelW - 56}" height="130" rx="22" fill="${p.accent.replace("${C.goldLight}", C.goldLight)}"/>
      ${i === 0 ? `
        <g transform="translate(${cx - 40} 262)" fill="${C.gold}">
          <rect x="0" y="0" width="80" height="64" rx="4"/>
          <rect x="38" y="4" width="4" height="56" fill="#FFFFFF"/>
        </g>` : ""}
      ${i === 1 ? `
        <g transform="translate(${cx} 292)" fill="${C.primary}">
          <path d="M -20,-30 L -6,8 C -4,14 -9,20 -15,20 L -25,20 C -30,20 -34,15 -32,10 Z"/>
          <path d="M 20,-30 L 6,8 C 4,14 9,20 15,20 L 25,20 C 30,20 34,15 32,10 Z"/>
        </g>` : ""}
      ${i === 2 ? `
        <g transform="translate(${cx - 24} 262)">
          <circle cx="24" cy="20" r="18" fill="${C.primary}"/>
          <path d="M 0,64 C 0,44 10,34 24,34 C 38,34 48,44 48,64 Z" fill="${C.primary}"/>
        </g>` : ""}
      <text x="${cx}" y="420" font-family="${FONT}" font-size="34" font-weight="900" text-anchor="middle" fill="#0F766E">${p.label}</text>
      <text x="${cx}" y="470" font-family="${FONT}" font-size="20" font-weight="500" text-anchor="middle" fill="${C.g700}">${p.line1}</text>
      <text x="${cx}" y="498" font-family="${FONT}" font-size="20" font-weight="500" text-anchor="middle" fill="${C.g700}">${p.line2}</text>
    `;
  }).join("")}
</svg>`;

writeFileSync("public/icons/screen-quiz.svg", quiz);
writeFileSync("public/icons/screen-prayer.svg", prayer);
writeFileSync("public/icons/screen-character.svg", character);
writeFileSync("public/icons/screen-landscape.svg", landscape);
console.log("wrote 4 SVGs");
