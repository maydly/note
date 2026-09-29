// ─────────────────────────────────────────────────────────────
// maydly 홈 — 기다리는 동안 도는 «점 구슬» (v2.4 오브스, 260930)
//
// 엔진: ./vendor/thinking-orbs-engine-0.3.1.es.js
//   Thinking Orbs v0.3.1 · MIT © 2026 Jakub Antalik · https://github.com/Jakubantalik/thinking-orbs
//   원본 그대로 복사해 둔 사본(외부 CDN 에서 불러오지 않는다). 라이선스 전문 ./vendor/thinking-orbs-LICENSE.txt
//
// 이 파일이 하는 일
//   엔진의 MODE_FRAMES 로 «점·선 좌표»만 받아 maydly 초록으로 직접 칠한다.
//   (엔진의 MODE_DRAWS 는 회색 잉크로 칠하므로 쓰지 않는다)
//
// 원칙
//   · 읽기 전용 — localStorage·IndexedDB·쿠키 등 어떤 저장소에도 쓰지 않는다. 네트워크도 쓰지 않는다.
//   · 필요한 동안만 돈다 — 화면 밖(IntersectionObserver)·탭 숨김(visibilitychange)이면 멈추고,
//     stop() 하면 requestAnimationFrame 을 해제한다. 캔버스가 화면에서 빠지면 스스로 멈춘다.
//   · 동작 줄이기(prefers-reduced-motion)면 움직이지 않고 대표 정지 프레임 한 장만 그린다.
//
// 쓰는 법
//   import { mountOrb } from './orbs.js';
//   const orb = mountOrb(el, { state: 'searching', size: 20, color: '#3f8f5c' });
//   orb.setState('solving');  …  orb.stop();
// ─────────────────────────────────────────────────────────────

import { resolvePreset, MODE_FRAMES } from './vendor/thinking-orbs-engine-0.3.1.es.js';

// 상태 9개 → 화면 읽기용 한국어 이름 (canvas aria-label)
export const ORB_LABEL = {
  working: '불러오는 중',
  searching: '찾는 중',
  solving: '계산하는 중',
  listening: '듣는 중',
  connecting: '연결 중',
  weaving: '엮는 중',
  composing: '만드는 중',
  breathing: '생각하는 중',
  shaping: '다듬는 중'
};
export const ORB_GREEN = '#3f8f5c';          // maydly 초록 (기본)
const STILL_T = 0.6;                          // 동작 줄이기 — 원작과 같은 대표 정지 프레임 시각
const DPR_MAX = 3;                            // 폰(3배 화면)에서도 또렷하게 — 원작은 2까지지만 캔버스가 20~64px 라 비용은 작다(260930 검수)

// '#rgb' · '#rrggbb' · 'rgb(r,g,b)' → 'r,g,b'. 못 읽으면 maydly 초록
function rgbOf(c) {
  const s = String(c || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16)).join(',');
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',');
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (m) return [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, +v))).join(',');
  return '63,143,92';                         // = ORB_GREEN
}

// 잉크 → 알파.
// 원작(밝은 바탕)은 점마다 회색(white×255)을 알파 a 로 칠한다. 흰 바탕 위에서 그 픽셀은
// «검정 잉크를 a×(1−white) 만큼» 칠한 것과 똑같다. 그래서 검정 대신 초록을 이 알파로 칠하면
// 앞쪽은 진하고 뒤쪽은 옅은 원작의 입체감(진하기)은 그대로, 색만 maydly 초록이 된다.
// (카드·칩처럼 바탕이 완전한 흰색이 아니어도 바탕 위에 자연스럽게 얹힌다)
const inkA = (o) => {
  const a = o.a == null ? 1 : o.a;
  const w = o.white < 0 ? 0 : o.white > 1 ? 1 : o.white;
  return (a < 0 ? 0 : a > 1 ? 1 : a) * (1 - w);
};

// 색 단계 — 초록은 검정보다 밝아서 알파만으로는 원작보다 흐려 보인다(260930 비교 캡처).
// 그래서 잉크가 진한 점(white 가 0 에 가까운 앞쪽 점)일수록 같은 초록의 «짙은 쪽»으로 5단계 옮겨 원작의 앞뒤 대비를 살린다.
const TONES = 5;
function tonesOf(rgb) {
  const base = rgb.split(',').map(Number);
  const deep = base.map((v) => Math.round(v * 0.55));            // 같은 색의 짙은 쪽(밝기 55%)
  const out = [];
  for (let i = 0; i < TONES; i++) {
    const k = i / (TONES - 1);                                     // 0 = 기본색 · 1 = 짙은 색
    out.push(`rgb(${base.map((v, j) => Math.round(v + (deep[j] - v) * k)).join(',')})`);
  }
  return out;
}
// white 0.5 이상(뒤쪽·옅은 점) → 기본색, white 0.05 이하(맨 앞 진한 점) → 짙은 색
const toneIx = (w) => { const k = (0.5 - w) / 0.45; return k <= 0 ? 0 : k >= 1 ? TONES - 1 : Math.round(k * (TONES - 1)); };

// 엔진이 준 한 프레임(z 정렬 완료)을 칠한다 — 선 먼저, 점 나중(원작 순서)
// fit — 초록은 검정보다 밝아 원작보다 흐려 보인다(260930 캡처). 진하기를 조금 올리고(al → 1−(1−al)^boost)
//       점 반지름이 rMin(화면 0.5px 안팎) 밑으로 내려가지 않게 한다. 글줄 크기(20px)는 더 많이, 64px 은 조금
function paintFrame(ctx, fr, tones, fit) {
  const boost = fit.boost, rMin = fit.rMin;
  const up = (al) => (boost === 1 ? al : 1 - Math.pow(1 - al, boost));
  for (const l of fr.lines) {
    const al = up(inkA(l));
    if (al < 0.004) continue;
    ctx.globalAlpha = al;
    ctx.strokeStyle = tones[toneIx(l.white)];
    ctx.lineWidth = l.w;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
  }
  let last = -1;
  for (const d of fr.dots) {
    const al = up(inkA(d));
    if (al < 0.004) continue;
    const ti = toneIx(d.white);
    if (ti !== last) { ctx.fillStyle = tones[ti]; last = ti; }
    ctx.globalAlpha = al;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r < rMin ? rMin : d.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * el 안에 구슬 캔버스를 하나 붙인다.
 * @param {Element} el    구슬을 넣을 자리
 * @param {{state?:string, size?:number, color?:string, label?:string}} opt
 *   state — working·searching·solving·listening·connecting·weaving·composing·breathing·shaping
 *   size  — 화면 크기(px). 엔진 설계값은 20(글줄)·64(아바타) 두 가지 — 가까운 쪽 설계로 그리고 크기만 맞춘다
 *   color — 점 색(기본 maydly 초록 #3f8f5c)
 *   label — 화면 읽기 이름(없으면 상태 한국어 이름)
 * @returns {{setState:(s:string)=>void, stop:()=>void, canvas:HTMLCanvasElement}}
 */
export function mountOrb(el, opt) {
  const o = opt || {};
  const css = Math.max(8, Math.round(+o.size || 64));
  const design = css < 42 ? 20 : 64;            // 엔진이 조율해 둔 두 크기 중 하나
  const raw = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
  const dpr = Math.min(DPR_MAX, raw);
  const tones = tonesOf(rgbOf(o.color || ORB_GREEN));
  // rMin 은 설계 단위(화면 0.5px 안팎). 1배 화면(외부 모니터)에서는 점이 한 픽셀도 안 돼 옅은 회색 얼룩처럼 보인다(260930 검수) —
  // 그때만 진하기와 최소 반지름을 조금 더 올려 초록 점으로 읽히게 한다
  const lo = raw < 1.5;
  const fit = design === 20
    ? { boost: lo ? 2.4 : 1.9, rMin: (lo ? 0.7 : 0.5) * design / css }
    : { boost: lo ? 1.7 : 1.35, rMin: (lo ? 0.6 : 0.45) * design / css };

  const cv = document.createElement('canvas');
  cv.className = 'orbcv';
  cv.setAttribute('role', 'img');
  cv.width = Math.round(css * dpr);
  cv.height = Math.round(css * dpr);
  cv.style.width = css + 'px';
  cv.style.height = css + 'px';
  cv.style.display = 'block';
  el.appendChild(cv);
  const ctx = cv.getContext('2d');

  const rm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const still = () => !!(rm && rm.matches);
  let P = null, raf = 0, running = false, seen = true, dead = false;

  const clock = () => (performance.now() / 1000) * P.speed;   // 모든 구슬이 같은 시계 — 멈췄다 돌아와도 같은 위상
  function draw(t) {
    if (!ctx || !P) return;
    const k = dpr * (css / design);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, design, design);
    paintFrame(ctx, MODE_FRAMES[P.mode](design, t, P.opts), tones, fit);
  }
  function tick() {
    raf = 0;
    if (!running) return;
    if (!cv.isConnected) { stop(); return; }     // 자리째 지워졌으면 스스로 멈춘다
    draw(clock());
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function play() {
    if (dead || running || !seen || still()) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!cv.isConnected) { stop(); return; }
    running = true;
    raf = requestAnimationFrame(tick);
  }
  function setState(s) {
    if (dead) return;
    const st = Object.prototype.hasOwnProperty.call(ORB_LABEL, s) ? s : 'working';
    P = resolvePreset(st, design);
    cv.setAttribute('aria-label', o.label || ORB_LABEL[st]);
    cv.dataset.state = st;
    draw(still() ? STILL_T : clock());
  }

  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; if (seen) play(); else pause(); })
    : null;
  const onVis = () => { if (document.visibilityState === 'hidden') pause(); else play(); };
  const onRm = () => { if (still()) { pause(); draw(STILL_T); } else play(); };

  function stop() {
    if (dead) return;
    dead = true;
    pause();
    if (io) io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    if (rm) { if (rm.removeEventListener) rm.removeEventListener('change', onRm); else if (rm.removeListener) rm.removeListener(onRm); }
  }

  setState(o.state || 'working');                 // 첫 장은 바로 그린다(빈 칸이 보이지 않게)
  document.addEventListener('visibilitychange', onVis);
  if (rm) { if (rm.addEventListener) rm.addEventListener('change', onRm); else if (rm.addListener) rm.addListener(onRm); }
  if (io) { seen = false; io.observe(cv); }       // 화면에 들어왔다고 알려 주면 그때 돈다
  else play();

  return { setState, stop, canvas: cv };
}
