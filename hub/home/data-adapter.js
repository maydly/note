// ─────────────────────────────────────────────────────────────
// maydly 홈 대시보드 — 읽기 전용 어댑터 (v2.1, 260925 실데이터 연결)
//
// 원칙 (운영-018)
//  1) 쓰기 코드 0줄. Firestore 에 쓰지 않고, localStorage 에도 쓰지 않는다.
//  2) 읽기에 실패하면 0이 아니라 null 을 돌려준다. 화면은 '—' 로 표시한다.
//     (진짜 0 과 "못 읽음" 을 구분하지 못하면 틀린 숫자를 맞는 것처럼 보여주게 된다)
//  3) 각 앱의 데이터 모양·계산 규칙이 바뀌면 이 파일만 고친다.
//     아래 상수·계산은 전부 원래 앱 코드에서 «그대로» 옮겼다(출처 주석 참고).
//     원래 앱에서 값이 바뀌면 여기도 같이 바꿔야 숫자가 맞는다.
//
// 데이터 출처 3가지
//  A. Firestore (구글 로그인 필요) — mjApp/{kind}, mj_cal/events, 문의 컬렉션 2개,
//     수빈 goals/logs, maydly_docs/prep
//  B. localStorage (같은 출처라 로그인 불필요) — 필름·여행지도·조명셋업·독립준비 체크
//  C. 정적 파일 — hub/governance/data.json · note/index.html · 조명셋업 결정표 · 여행 기본 장소
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
         signOut, onAuthStateChanged, setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy, limit, where }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CFG = {
  apiKey: "AIzaSyBfyRE7CNENjgSfe25xHAdr87gOllpYtvM",
  authDomain: "subin-routine.firebaseapp.com",
  projectId: "subin-routine",
  appId: "1:102755018689:web:2927e3b73fb5391db17140"
};

const app  = initializeApp(CFG);
const auth = getAuth(app);
const db   = getFirestore(app);
try { setPersistence(auth, browserLocalPersistence); } catch (e) {}

// ── 로그인 ────────────────────────────────────────────────────
export function onUser(cb) { return onAuthStateChanged(auth, cb); }

// 리다이렉트로 로그인하고 돌아온 경우를 먼저 받아준다(폰에서 이 경로를 탄다)
getRedirectResult(auth).catch(() => {});

/**
 * 구글 로그인.
 * 폰(특히 사파리·인앱 브라우저)은 팝업을 막는 경우가 많다.
 * 팝업이 막히면 전체화면 리다이렉트로 자동 전환한다. (설문데이터 페이지와 같은 방식)
 */
export async function login() {
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(auth, provider);
  } catch (e) {
    try {
      return await signInWithRedirect(auth, provider);
    } catch (e2) {
      throw new Error('로그인에 실패했어요. 주소창 옆 쿠키 설정에서 이 사이트를 허용하거나 사파리로 열어보세요.');
    }
  }
}
export function logout() { return signOut(auth); }
export function currentUser() { return auth.currentUser; }

// ── 읽기 결과 기억 (한 번 그릴 때 같은 문서를 여러 번 읽지 않게) ──
// 로그인 계정이 바뀌면 resetCache() 로 비운다. (메모리 안의 변수만 — 저장소에 쓰지 않는다)
let _memo = {};
export function resetCache() { _memo = {}; }
function once(key, fn) {
  if (!(key in _memo)) {
    const p = Promise.resolve(fn());
    _memo[key] = p;
    // 못 읽음(null)·오류는 기억하지 않는다 — 일시적 실패가 새로고침 전까지 '—' 로 굳지 않게, 다음 그리기에서 다시 읽는다
    p.then((v) => { if (v === null && _memo[key] === p) delete _memo[key]; },
           () => { if (_memo[key] === p) delete _memo[key]; });
  }
  return _memo[key];
}

// ── 날짜 도우미 (기기 시계 기준, 'YYYY-MM-DD') ─────────────────
const pad2 = (n) => String(n).padStart(2, "0");
const fd = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const parseDS = (ds) => { const a = String(ds).split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); };
const todayISO = () => fd(new Date());
const monthPrefix = () => todayISO().slice(0, 7);          // 'YYYY-MM'
const addDays = (iso, n) => { const d = parseDS(iso); d.setDate(d.getDate() + n); return fd(d); };
const dDiff = (from, to) => Math.round((parseDS(to) - parseDS(from)) / 86400000);
const addMonthKey = (mk, n) => { const a = mk.split("-").map(Number); const d = new Date(a[0], a[1] - 1 + n, 1); return d.getFullYear() + "-" + pad2(d.getMonth() + 1); };

// 못 읽으면 null. 빈 배열([])과 못 읽음(null)은 다른 뜻이다.
function mjDoc(kind) {
  return once("mj:" + kind, async () => {
    try {
      const s = await getDoc(doc(db, "mjApp", kind));
      if (!s.exists()) return null;
      const j = s.data().json;
      if (!j) return null;
      return JSON.parse(j);
    } catch (e) { return null; }
  });
}

function lsJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

// ══════════════════════════════════════════════════════════════
// A-1. 예약 캘린더 (mj_cal/events) — 관리자 캘린더 규칙을 그대로 옮김
//      출처: maydly-cal/admin.html
// ══════════════════════════════════════════════════════════════

// 라벨 이름 (admin.html:668-680 LABELS)
const CAL_LABEL_NAME = {
  studio_m: "남스튜디오", studio_f: "여스튜디오", outdoor: "야외",
  studio_pay: "스튜디오페이", outdoor_pay: "야외페이", pa_shoot: "PA촬영",
  rest: "휴무", brand: "브랜드/상업", personal: "개인", suvin: "수빈"
};
export const labelName = (k) => CAL_LABEL_NAME[k] || (k ? String(k) : "라벨 없음");
export const isPayLabel = (k) => k === "studio_pay" || k === "outdoor_pay";

// 촬영으로 세는 라벨 (admin.html:1656 DASH_SHOOT = 745 DELIV_LABELS 와 같은 목록)
const SHOOT_LABELS = ["studio_m", "studio_f", "outdoor", "studio_pay", "outdoor_pay", "brand"];
const EXT_LABELS = ["suvin"];                                     // admin.html:684
// 노쇼·취소만 '실제 예약 아님' (admin.html:704-717 STATUS.active)
const stActive = (s) => s !== "nosh" && s !== "cancel";
const isExt = (e) => !!e && (!!e.ext || EXT_LABELS.includes(e.label));
/** 관리자 대시보드가 '촬영'으로 세는 일정 (admin.html:1660 isShootEv) */
export const isShootEv = (e) => !!e && SHOOT_LABELS.includes(e.label) && stActive(e.status);

// 목표 기준 (admin.html:1658-1659 — 관리자 캘린더에서 바꾸면 여기도 바꿀 것)
export const WEEK_TARGET = 10;          // 이번 주 촬영 10명
export const MONTH_TARGET = 3200000;    // 이번 달 수익 320만원

// 촬영 금액 (admin.html:836-852 PRICE_TABLE · evAmount)
const PRICE_TABLE = [
  { from: "2026-01-01", p: { studio_f: 80000, studio_m: 80000 } }
];
function fixedPriceOf(label, ds) {
  let hit = null;
  PRICE_TABLE.forEach((r) => { if (String(ds) >= r.from) hit = r; });
  return hit && hit.p[label] != null ? hit.p[label] : null;
}
/** 일정에 적은 금액 > 고정 단가(½ 반값) > 미입력(null) */
export function evAmount(e) {
  if (!e) return null;
  if (e.amount != null && e.amount !== "") {
    const n = Number(e.amount);
    return Number.isFinite(n) ? n : null;
  }
  const p = fixedPriceOf(e.label, e.date);
  if (p == null) return null;
  return e.half ? Math.round(p / 2) : p;
}

// 전달 기한 (admin.html:744-805)
const DELIV_SINCE = "2026-07-14";   // 이 날짜 이전 촬영은 이미 전달한 것으로 본다
const ALERT_LEAD = 3;               // 기한 며칠 전부터 급한 일로 볼지
const OUTFIT_LEAD = 3;              // 의상확인 — 촬영 며칠 전부터
const BASIC_DUE = { m: 1 };
const BUY_DUE = { buy_select: { w: 2 }, buy_raw: { w: 2 }, buy_color: { m: 1 } };
const DLV_TITLE = { basic: "기본 보정본", buy_select: "2번 색보정", buy_raw: "전체 원본",
                    buy_color: "전체 색보정", rush: "긴급 보정본", outfit: "의상확인" };
function addDue(ds, due) {
  const d = parseDS(ds);
  if (due.m) {
    const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + due.m);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  if (due.w) d.setDate(d.getDate() + due.w * 7);
  return fd(d);
}
export function dueText(n) { return n < 0 ? `${-n}일 지남` : n === 0 ? "오늘까지" : `${n}일 남음`; }
function isDelivTarget(e) {
  return !!e && !isExt(e) && stActive(e.status) && SHOOT_LABELS.includes(e.label) && e.date >= DELIV_SINCE;
}

/**
 * 지금 챙겨야 할 일 — 관리자 캘린더 buildAlerts 를 읽기만 하도록 옮긴 것.
 * kind: outfit(의상확인) · rush(긴급 보정본) · basic(기본 보정본) · buy(구매분)
 * 결과: [{kind, title, e, due, left, urgent}] — left 가 작은(급한) 순
 */
export function buildAlerts(evs, today = todayISO()) {
  const out = [];
  (evs || []).forEach((e) => {
    if (!e || isExt(e) || !stActive(e.status)) return;
    if (e.status === "booked" && SHOOT_LABELS.includes(e.label)) {
      const left = dDiff(today, e.date);
      if (left >= 0 && left <= OUTFIT_LEAD) out.push({ kind: "outfit", title: DLV_TITLE.outfit, e, due: e.date, left, urgent: true });
    }
    if (e.dlvRush && !e.dlvRushDone) {
      const left = dDiff(today, e.dlvRush);
      out.push({ kind: "rush", title: DLV_TITLE.rush, e, due: e.dlvRush, left, urgent: left <= ALERT_LEAD });
    }
    if (!isDelivTarget(e) || e.date > today) return;
    if (!e.dlvBasic) {
      const due = addDue(e.date, BASIC_DUE), left = dDiff(today, due);
      out.push({ kind: "basic", title: DLV_TITLE.basic, e, due, left, urgent: left <= ALERT_LEAD });
    }
    const bd = BUY_DUE[e.status] ? addDue(e.date, BUY_DUE[e.status]) : null;
    if (bd && !e.dlvBuy) {
      const left = dDiff(today, bd);
      out.push({ kind: "buy", title: DLV_TITLE[e.status] || "구매분", e, due: bd, left, urgent: left <= ALERT_LEAD });
    }
  });
  return out.sort((a, b) => a.left - b.left || String(a.due).localeCompare(String(b.due)));
}
/** 납품(보정본 전달)만 — 의상확인은 뺀다 */
export const isDelivery = (a) => a && (a.kind === "basic" || a.kind === "buy" || a.kind === "rush");

/** 예약 이벤트 전체. 관리자 캘린더가 쓰는 mj_cal/events 를 «읽기만» 한다. */
export function calEvents() {
  return once("cal", async () => {
    try {
      const s = await getDoc(doc(db, "mj_cal", "events"));
      if (!s.exists()) return null;
      const b = s.data().blob;
      if (!b) return null;
      const j = JSON.parse(b);
      const list = Array.isArray(j) ? j : j.events;
      if (!Array.isArray(list)) return null;
      // 관리자 캘린더가 불러올 때와 같게(admin.html:1361, 685):
      //  id 90000 이상(구글 캘린더에서 온 임시 일정)은 빼고, 옛 라벨(holiday→rest, nopay→studio_f)은 바꿔 읽는다.
      //  원본은 건드리지 않고 복사본만 바꾼다.
      return list.filter((e) => e && !(e.id >= 90000)).map((e) => {
        const c = Object.assign({}, e);
        if (c.label === "holiday") c.label = "rest";
        if (c.label === "nopay") c.label = "studio_f";
        return c;
      });
    } catch (e) { return null; }
  });
}

// 일정의 시작·끝 시각(ms). 시간 없는 일정은 그날 하루 전체로 본다.
export function evStartMs(e) {
  const d = parseDS(e.date);
  if (e.time && !e.allDay) {
    const t = String(e.time).split(":").map(Number);
    d.setHours(t[0] || 0, t[1] || 0, 0, 0);
  }
  return d.getTime();
}
export function evEndMs(e) {
  if (e.time && !e.allDay) return evStartMs(e) + (Number(e.dur) || 2) * 3600000;
  const d = parseDS(e.date);
  d.setDate(d.getDate() + Math.max(1, Math.round((Number(e.dur) || 24) / 24)));
  return d.getTime();
}

/** 다음 촬영 — 지금 이후(진행 중 포함) 가장 가까운 촬영, 앞으로 days 일 안에서 */
export function nextShoot(evs, now = new Date(), days = 14) {
  const t = fd(now), to = addDays(t, days), nowMs = now.getTime();
  const list = evs.filter((e) => isShootEv(e) && e.date >= t && e.date <= to && evEndMs(e) > nowMs)
                  .sort((a, b) => evStartMs(a) - evStartMs(b));
  return {
    next: list[0] || null,
    upcoming: list.length,
    todayCount: evs.filter((e) => isShootEv(e) && e.date === t).length
  };
}

/** 아직 시작 안 한 촬영(남은 촬영) — 내일 이후 + 오늘인데 시작 시각 전. 오늘 저녁 촬영을 '지난 촬영'으로 세지 않기 위함 */
export const isLaterShoot = (e, now = new Date()) =>
  e.date > fd(now) || (e.date === fd(now) && evStartMs(e) > now.getTime());

/** 이번 주(일~토) 촬영 수 · 이번 달 수익 — 관리자 대시보드 dashData 와 같은 계산 (admin.html:1700-1719) */
export function calStats(evs, now = new Date()) {
  const today = fd(now);
  const sun = new Date(now); sun.setHours(0, 0, 0, 0); sun.setDate(sun.getDate() - sun.getDay());
  const wkFrom = fd(sun), wkTo = addDays(wkFrom, 6);
  const mk = today.slice(0, 7);
  const week = evs.filter((e) => isShootEv(e) && e.date >= wkFrom && e.date <= wkTo);
  const month = evs.filter((e) => isShootEv(e) && String(e.date).slice(0, 7) === mk);
  let sum = 0, noAmt = 0, planSum = 0, planNoAmt = 0, planN = 0, doneN = 0;
  month.forEach((e) => {
    const a = evAmount(e);
    if (a == null) noAmt++; else sum += a;
    if (isLaterShoot(e, now)) { planN++; if (a == null) planNoAmt++; else planSum += a; }
    else doneN++;
  });
  return {
    today, wkFrom, wkTo, weekCount: week.length, weekTarget: WEEK_TARGET,
    monthKey: mk, monthN: month.length, monthSum: sum, monthNoAmt: noAmt, monthTarget: MONTH_TARGET,
    doneN, planN, planSum, planNoAmt
  };
}

// 사람 묶기 기준 (admin.html:1739 — 띄어쓰기·괄호·끝의 '님' 을 뗀다)
export const personKey = (s) => String(s || "").replace(/\s+/g, "").replace(/\(.*?\)/g, "").replace(/(님)+$/, "");

/** 노쇼 이력 — 사람별 {name, cnt, last, reasons[]} */
export function noshHistory(evs) {
  const map = {};
  evs.forEach((e) => {
    if (!e || e.status !== "nosh") return;
    const k = personKey(e.client); if (!k) return;
    const o = map[k] || (map[k] = { name: e.client, cnt: 0, last: "", reasons: [] });
    o.cnt++;
    if (e.date > o.last) o.last = e.date;
    const r = String(e.noshReason || "").split(" — ")[0];
    if (r && o.reasons.indexOf(r) < 0) o.reasons.push(r);
  });
  return map;
}

// ══════════════════════════════════════════════════════════════
// A-2. 명진앱 (mjApp/{kind}) — 출처: note/myapp/index.html · parse.js
// ══════════════════════════════════════════════════════════════

// 가계부 합계 규칙 (myapp/index.html:1457 MOVE · 1767 sumReal)
//  이체·충전·ATM 분류는 수입/지출 합계에서 뺀다.
//  → 고수빈 입금(이체·지인정산)·OTT쉐어 입금(이체·OTT쉐어)·본인계좌 이동이 여기서 빠진다(parse.js:40,50).
//  → 노쇼 예약금은 '수입·촬영/사업'으로 남는다(노쇼 = 수입).
const MOVE = /이체|충전|ATM|현금·ATM/;
export const isMove = (t) => MOVE.test(String((t && t.cat) || ""));
const isUnclassified = (t) => String((t && t.cat) || "").indexOf("미분류") === 0;   // parse.js:121

/** 가계부 전체 배열 (못 읽으면 null) */
export async function ledgerAll() {
  const arr = await mjDoc("ledger");
  return Array.isArray(arr) ? arr.filter((x) => x && typeof x.date === "string") : null;
}

/** 이번달 가계부 — 수입/지출(이체 제외)·건수·미분류 건수(전체 기간) */
export function ledgerThisMonth(arr, mk = monthPrefix()) {
  const cur = arr.filter((x) => x.date.slice(0, 7) === mk);
  let income = 0, expense = 0;
  cur.forEach((t) => {
    if (isMove(t)) return;
    const a = Number(t.amt) || 0;
    if (t.type === "in") income += a; else expense += a;
  });
  const unc = arr.filter(isUnclassified);
  return { monthKey: mk, income, expense, count: cur.length, unclassified: unc.length };
}

/** 최근 n개월 달별 수입/지출 — 그 달 거래가 하나도 없으면 in/out 이 null(가져오기 전) */
export function ledgerMonthly(arr, n = 6, mk = monthPrefix()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = addMonthKey(mk, -i);
    const list = arr.filter((t) => t.date.slice(0, 7) === k);
    let inc = 0, exp = 0;
    list.forEach((t) => {
      if (isMove(t)) return;
      const a = Number(t.amt) || 0;
      if (t.type === "in") inc += a; else exp += a;
    });
    out.push({ mk: k, month: Number(k.slice(5)), count: list.length,
               in: list.length ? inc : null, out: list.length ? exp : null });
  }
  return out;
}

/** 이번달 지출을 분류별로 (이체·충전 제외) */
export function expenseByCat(arr, mk = monthPrefix()) {
  const by = {};
  let total = 0, count = 0;
  arr.forEach((t) => {
    if (t.date.slice(0, 7) !== mk || t.type !== "out" || isMove(t)) return;
    const a = Number(t.amt) || 0;
    const c = t.cat || "기타";
    by[c] = (by[c] || 0) + a; total += a; count++;
  });
  const cats = Object.keys(by).map((c) => ({ cat: c, amt: by[c] })).sort((a, b) => b.amt - a.amt);
  return { monthKey: mk, total, count, cats };
}

/** 미분류 거래 — 최근 날짜 순 */
export function unclassifiedList(arr) {
  return arr.filter(isUnclassified)
            .sort((a, b) => ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || "")));
}

// 캘린더 대조 (myapp/index.html:1981-1983, 2073-2117 matchCalendar 를 읽기만 하도록 옮김)
const CAL_DAYS = 60;                       // 입금일 앞뒤 60일
const CAL_TARGET = /수입·촬영|미분류/;       // 대조할 입금 분류
const calNorm = (s) => String(s || "").normalize("NFC").replace(/\s+/g, "").replace(/(님|씨)$/, "").trim();
export function calRawName(desc) {
  const s = calNorm(String(desc || "").replace(/^\d{1,2}월/, "").replace(/\(.*$/, ""));
  return /^[가-힣]{2,4}$/.test(s) ? s : null;
}
const calDay = (d) => Math.round(new Date(d + "T00:00:00").getTime() / 86400000);
const NOT_SHOOT_ALIAS = "(촬영 아님)";     // myapp/index.html:2197 — 「촬영비 아님」 버튼이 별칭에 넣는 값

/** 명진앱 별칭(입금자명 → 실제 예약자명). 못 읽으면 빈 별칭으로 대조한다(쓰지 않음). */
export async function calAlias() {
  const a = await mjDoc("alias");
  return (a && typeof a === "object" && !Array.isArray(a)) ? a : {};
}

/**
 * 입금 ↔ 예약 대조. 결과 R = {ok, bad(노쇼·취소 — 예약금은 수입), far(60일 밖), none(짝 없음), skip(이름 아님), notShoot(명진이 촬영비 아님으로 지정)}
 * used = 어떤 입금과든 짝지어진 예약 id
 */
export function matchLedgerCal(ledger, evs, alias) {
  const nameOf = (desc) => { const n = calRawName(desc); if (!n) return null; return alias[n] || n; };
  const byName = {};
  evs.forEach((e) => { const n = calNorm(e.client); if (n && e.date) (byName[n] = byName[n] || []).push(e); });
  const ins = ledger.filter((t) => t.type === "in" && CAL_TARGET.test(t.cat || ""));
  const R = { ok: [], bad: [], far: [], none: [], skip: [], notShoot: [] };
  ins.forEach((t) => {
    const n = nameOf(t.desc);
    if (!n) { R.skip.push({ t }); return; }
    // 명진이 명진앱에서 「촬영비 아님」으로 짝지어 둔 입금자 (myapp doCalMatch(-1) → 별칭 값 '(촬영 아님)').
    // 명진앱은 이걸 다시 '이름 없음'에 넣지만, 홈에서 '짝 없는 입금(긴급)'으로 올리면 명진 결정과 어긋나므로 따로 둔다.
    if (n === NOT_SHOOT_ALIAS) { R.notShoot.push({ t, n: calRawName(t.desc) }); return; }
    const L = byName[n];
    if (!L) { R.none.push({ t, n }); return; }
    const d0 = calDay(t.date);
    const near = L.map((e) => ({ e, gap: calDay(e.date) - d0 }))
                  .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
    const inR = near.filter((x) => Math.abs(x.gap) <= CAL_DAYS);
    if (!inR.length) { R.far.push({ t, n, near: near[0] }); return; }
    const good = inR.filter((x) => !/nosh|cancel/.test(x.e.status || ""));
    if (good.length) R.ok.push({ t, n, near: good[0] });
    else R.bad.push({ t, n, near: inR[0] });
  });
  const used = {};
  ["ok", "bad", "far"].forEach((k) => R[k].forEach((x) => { if (x.near && x.near.e) used[x.near.e.id] = 1; }));
  return { R, used };
}

/** 할 일 — 명진앱 '오늘 할 일' 정의(오늘 마감 + 날짜 없는 미완, myapp/index.html:989-991) */
export async function todos() {
  const arr = await mjDoc("todos");
  if (!Array.isArray(arr)) return null;
  const t = todayISO();
  const list = arr.filter(Boolean);
  const dueToday = list.filter((x) => !x.done && x.due === t);
  const noDue = list.filter((x) => !x.done && !x.due);
  const overdue = list.filter((x) => !x.done && x.due && x.due < t);
  return {
    total: list.length,
    open: list.filter((x) => !x.done).length,
    dueToday, noDue, overdue,
    todayLeft: dueToday.length + noDue.length,
    doneToday: list.filter((x) => x.done && x.doneAt === t).length
  };
}

/** 구매계획 — {items:[{name,cat,best,avg,max,memo,rank}], del} · 가격 단위 만원 (myapp/index.html:571,633,1359) */
export async function buys() {
  const raw = await mjDoc("buys");
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : null);
  if (!arr) return null;
  const list = arr.filter(Boolean).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  let best = 0, avg = 0, max = 0;
  list.forEach((b) => { best += +b.best || 0; avg += +b.avg || 0; max += (+b.max || +b.cap || 0); });
  return { count: list.length, list, sumBest: best, sumAvg: avg, sumMax: max };
}

/** 보유 장비 — 분류별 개수·시세 (myapp/index.html:1409-1415) */
export async function owns() {
  const arr = await mjDoc("owns");
  if (!Array.isArray(arr)) return null;
  const by = {};
  let price = 0;
  arr.filter(Boolean).forEach((o) => {
    const c = o.cat || "기타";
    const b = by[c] || (by[c] = { cat: c, n: 0, price: 0 });
    b.n++; b.price += (+o.price || 0); price += (+o.price || 0);
  });
  const cats = Object.keys(by).map((k) => by[k]).sort((a, b) => b.n - a.n);
  return { count: arr.length, cats, price };
}

/** 촬영 기록 — 최근(오늘까지) 4건 · 모델 수 · 기간 (myapp/index.html:2505-2540, cancel 제외) */
export async function shootRecords() {
  const arr = await mjDoc("shoots");
  if (!Array.isArray(arr)) return null;
  const t = todayISO();
  const valid = arr.filter((s) => s && !s.cancel && s.date);
  const key = (s) => (s.date || "") + (s.time || "");
  const recent = valid.filter((s) => s.date <= t).sort((a, b) => key(b).localeCompare(key(a))).slice(0, 4);
  const names = new Set(valid.map((s) => String(s.name || "").trim()).filter(Boolean));
  const years = valid.map((s) => String(s.date).slice(0, 4)).filter((y) => /^\d{4}$/.test(y)).sort();
  return { count: valid.length, models: names.size, fromYear: years[0] || null,
           toYear: years[years.length - 1] || null, recent };
}

/** 사진 색인 — {map:{이름:{rep,all:[]}}, base} (myapp/index.html:2341-2343) · 사진 수만 센다 */
export async function photoIndex() {
  const p = await mjDoc("photos");
  if (!p || typeof p !== "object") return null;
  const map = (p.map && typeof p.map === "object") ? p.map : p;
  let n = 0, people = 0;
  Object.keys(map).forEach((k) => {
    const v = map[k];
    if (v && Array.isArray(v.all)) { n += v.all.length; people++; }
  });
  return { photos: n, people };
}

// ══════════════════════════════════════════════════════════════
// A-3. 시안 문의 · 수빈 루틴 · 독립 준비 문서
// ══════════════════════════════════════════════════════════════

/**
 * 시안 문의 — 서랍 두 개를 합쳐서 본다.
 * (설문데이터 페이지와 같은 기준: maydly_inquiries_test + maydly_inquiries)
 * 문서 필드: name, keep, insta, status(신규/상담중/예약/완료), source, ts
 * 하나라도 못 읽으면 null. 일부만 읽고 숫자를 내면 실제보다 적게 보인다.
 */
export function inquiries() {
  return once("inq", async () => {
    const COLS = ["maydly_inquiries_test", "maydly_inquiries"];
    const CAP = 300;
    const all = [];
    let capped = false;
    for (const c of COLS) {
      try {
        const snap = await getDocs(query(collection(db, c), orderBy("ts", "desc"), limit(CAP)));
        if (snap.size >= CAP) capped = true;
        snap.forEach((d) => {
          const x = d.data() || {};
          let ms = 0;
          try { ms = x.ts && x.ts.toDate ? x.ts.toDate().getTime() : new Date(x.ts).getTime(); } catch (e) {}
          all.push({ id: d.id, col: c, name: x.name || "", keep: x.keep || "",
                     insta: x.insta || "", status: x.status || "신규", ms: ms || 0 });
        });
      } catch (e) { return null; }   // 한 서랍이라도 실패하면 숫자를 내지 않는다
    }
    all.sort((a, b) => b.ms - a.ms);
    const by = (s) => all.filter((x) => x.status === s);
    return { total: all.length, capped, list: all,
             fresh: by("신규"), talking: by("상담중"), booked: by("예약"), done: by("완료") };
  });
}

// 수빈 앱의 주 시작 = 월요일 (subin/index.html:2040 weekStart)
function weekStartMon(d) {
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return fd(dt);
}

/**
 * 수빈 루틴 — 이번 주(월~일) daily 목표별 달성.
 * 수빈 uid = users 에서 role=='user' (myapp/index.html:2917 과 같은 방법, 명진 계정으로 읽힘)
 * goals {uid,title,type,targetCount,unit,priority} · logs {goalId,uid,date,count} (subin/index.html:2893-2903)
 * 달성 = count >= targetCount (subin/index.html:2974-2991)
 */
export function subinRoutine() {
  return once("subin", async () => {
    try {
      const us = await getDocs(query(collection(db, "users"), where("role", "==", "user")));
      if (us.empty) return { uid: null };
      const uid = us.docs[0].id;
      const gs = await getDocs(query(collection(db, "goals"), where("uid", "==", uid), orderBy("priority", "asc")));
      const goals = gs.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      const ws = weekStartMon(new Date());
      const ls = await getDocs(query(collection(db, "logs"), where("uid", "==", uid), where("date", ">=", ws)));
      const logs = {};
      ls.forEach((d) => { const v = d.data() || {}; logs[v.goalId + "_" + v.date] = Number(v.count) || 0; });
      const days = [];
      for (let i = 0; i < 7; i++) days.push(addDays(ws, i));
      const today = todayISO();
      const daily = goals.filter((g) => g.type === "daily").map((g) => {
        const target = Number(g.targetCount) || 1;
        return {
          id: g.id, title: g.title || "(제목 없음)", unit: g.unit || "", target,
          cells: days.map((d) => {
            const c = logs[g.id + "_" + d] || 0;
            // 오늘은 아직 안 끝났으므로 목표 미달(0회든 일부든)은 '못 채움'이 아니라 '오늘 아직'
            return { d, count: c, state: d > today ? "future" : c >= target ? "done" : d === today ? "todo" : "miss" };
          })
        };
      });
      const doneToday = daily.filter((g) => (logs[g.id + "_" + today] || 0) >= g.target).length;
      return { uid, days, today, daily, doneToday, dailyTotal: daily.length, otherGoals: goals.length - daily.length };
    } catch (e) { return null; }
  });
}

/**
 * 독립 준비 점검표 — Firestore maydly_docs/prep 의 html 을 파싱(스크립트는 실행하지 않음)하고
 * 이 기기의 체크 상태(localStorage 'maydly_prep_chk')와 맞춘다. (prep/index.html:130-205 와 같은 해시)
 * 체크는 기기마다 다르다.
 */
export function prepProgress() {
  return once("prep", async () => {
    let snap;
    try { snap = await getDoc(doc(db, "maydly_docs", "prep")); }
    catch (e) { return null; }
    if (!snap.exists() || !snap.data().html) return { uploaded: false };
    const d = snap.data();
    try {
      const parsed = new DOMParser().parseFromString(d.html, "text/html");
      parsed.querySelectorAll("script,style,#gate,#bar,.backhub").forEach((n) => n.remove());
      const lis = Array.from(parsed.querySelectorAll("ul.chk > li"));
      const store = lsJSON("maydly_prep_chk") || {};
      const key = (s) => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(36); };
      const done = lis.filter((li) => store[key(li.textContent.trim())]).length;
      const at = d.at && d.at.toDate ? fd(d.at.toDate()) : null;
      return { uploaded: true, total: lis.length, done, at };
    } catch (e) { return null; }
  });
}

// ══════════════════════════════════════════════════════════════
// B. localStorage (같은 출처라 로그인 없이 읽힌다) — 이 기기 기준
// ══════════════════════════════════════════════════════════════

// 필름 앱 계산 (film/index.html:481-499 — NOW 는 필름 앱이 쓰는 기준 연도)
const FILM_NOW = 2026;
const FILM_STD = [3200, 1600, 800, 400, 200, 100, 50, 25, 12];
function filmStops(iso, year, store) {
  const y = FILM_NOW - year;
  let s = y <= 2 ? 0 : y <= 10 ? 1 : y <= 20 ? 2 : 3;
  if (store === "cold") s = Math.max(0, s - 1); else if (store === "hot") s = s + 1;
  return { years: y, stops: s };
}
function filmSetIso(boxIso, stops) {
  const t = boxIso / Math.pow(2, stops);
  if (t < 25) return { dial: 25, manual: Math.round(Math.log2(25 / t)) };
  return { dial: FILM_STD.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a)), manual: 0 };
}
function filmSunnyShutter(iso) {
  const map = { 12: "1/15", 25: "1/30", 50: "1/60", 100: "1/125", 200: "1/250", 400: "1/500", 800: "1/1000" };
  const b = FILM_STD.reduce((a, c) => (Math.abs(c - iso) < Math.abs(a - iso) ? c : a));
  return map[b] || "1/" + iso;
}
/** 필름 한 롤의 세팅 (필름 앱 settingText 와 같은 결과, 네거티브 기준) */
export function filmSetting(iso, year, store) {
  const c = filmStops(Number(iso) || 0, Number(year) || FILM_NOW, store);
  const si = filmSetIso(Number(iso) || 100, c.stops);
  return { years: c.years, stops: c.stops, dial: si.dial, manual: si.manual,
           label: "ISO " + si.dial + (si.manual > 0 ? " + 수동 " + si.manual + "스톱" : ""),
           shutter: filmSunnyShutter(si.dial) };
}
export const FILM_WEATHER = [["쨍한 맑음", "f/16"], ["살짝 흐림", "f/11"], ["흐림", "f/8"], ["그늘·해질녘", "f/5.6~4"]];
const STORE_KO = { cold: "냉장", room: "상온", hot: "더운곳" };

/** 필름 재고 — maydly-film-v1 {stock:[{id,name,iso,year,qty,store}],deals,plan,seq} */
export function film() {
  const d = lsJSON("maydly-film-v1");
  if (!d || !Array.isArray(d.stock)) return null;   // 키가 없으면 필름 앱은 데모 2종을 보여주지만 홈은 쓰지 않는다
  const stock = d.stock.filter(Boolean).map((s) => Object.assign({}, s, {
    qty: Number(s.qty) || 0, storeKo: STORE_KO[s.store] || s.store || "",
    setting: filmSetting(s.iso, s.year, s.store)
  })).sort((a, b) => b.qty - a.qty);
  const rolls = stock.reduce((a, x) => a + x.qty, 0);
  const oldest = stock.filter((s) => Number(s.year)).sort((a, b) => a.year - b.year)[0] || null;
  return { kinds: stock.length, rolls, stock, oldest, nowYear: FILM_NOW };
}

/**
 * 여행지도 — 내가 저장한 장소 (maydly_travel_places, 순수 배열)
 * 기기에 없으면 여행지도 앱처럼 기본 목록(travel/data/myplaces.js SEED_PLACES)을 쓴다 (travel/index.html:1258-1259)
 */
export function travelPlaces() {
  return once("travel", async () => {
    const arr = lsJSON("maydly_travel_places");
    if (Array.isArray(arr) && arr.length) return { list: arr.filter(Boolean), source: "device" };
    try {
      const r = await fetch("../../travel/data/myplaces.js");
      if (!r.ok) return null;
      const txt = await r.text();
      const i = txt.indexOf("["), j = txt.lastIndexOf("]");
      if (i < 0 || j < i) return null;
      const list = JSON.parse(txt.slice(i, j + 1));
      return Array.isArray(list) ? { list: list.filter(Boolean), source: "seed" } : null;
    } catch (e) { return null; }
  });
}

// 지역 이름 맞추기 — 주소(memo) 첫 낱말. 좌표로 한국/그 밖을 먼저 가른다(대략).
const REGION_NORM = [
  [/^서울/, "서울"], [/^인천/, "인천"], [/^경기/, "경기"], [/^강원/, "강원"], [/^제주/, "제주"],
  [/^부산/, "부산"], [/^대구/, "대구"], [/^대전/, "대전"], [/^광주/, "광주"], [/^울산/, "울산"], [/^세종/, "세종"],
  [/^충청?남|^충남/, "충남"], [/^충청?북|^충북/, "충북"], [/^전라?남|^전남/, "전남"], [/^전라?북|^전북/, "전북"],
  [/^경상?남|^경남/, "경남"], [/^경상?북|^경북/, "경북"]
];
function inKorea(p) {
  const lat = +p.lat, lng = +p.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat >= 33.0 && lat <= 33.7 && lng >= 126.0 && lng <= 127.1) return true;      // 제주
  if (lat >= 37.3 && lat <= 37.7 && lng >= 130.7 && lng <= 131.0) return true;      // 울릉
  if (lat < 34.0 || lat > 38.7 || lng < 124.5 || lng > 129.65) return false;
  if (lat < 34.75 && lng > 129.1) return false;                                   // 쓰시마
  return true;
}
export function placeRegion(p) {
  if (!inKorea(p)) return /^일본|〒/.test(String(p.memo || "")) || (+p.lng > 128 && +p.lat > 24 && +p.lat < 46) ? "일본" : "해외";
  const w = String(p.memo || "").trim().split(/\s+/)[0] || "";
  for (const [re, name] of REGION_NORM) if (re.test(w)) return name;
  return "한국(주소 없음)";
}
/** 장소 통계 — 지역별 개수 · 네이버에서 가져온 비율 · 날짜 있는 최근 장소 */
export function placeStats(list) {
  const region = {};
  list.forEach((p) => { const r = placeRegion(p); region[r] = (region[r] || 0) + 1; });
  const regions = Object.keys(region).map((k) => ({ name: k, n: region[k] })).sort((a, b) => b.n - a.n);
  const naver = list.filter((p) => String(p.source || "").indexOf("naver:") === 0).length;
  const google = list.filter((p) => String(p.source || "").indexOf("google:") === 0).length;
  const withTs = list.filter((p) => Number(p.ts) > 0).sort((a, b) => b.ts - a.ts);
  const monthAgo = Date.now() - 30 * 86400000;
  return { count: list.length, regions, naver, google, withTs, recent30: withTs.filter((p) => p.ts >= monthAgo).length,
           korea: list.filter(inKorea) };
}
export const PLACE_CATS = {   // travel/index.html:1264-1268
  rice: "🍚 밥", cafe: "☕ 카페", drink: "🍷 술", see: "👀 볼것", todo: "🎯 할것",
  shop: "🛍️ 쇼핑", photo: "📸 촬영지", studio: "🎬 촬영장", stay: "🏨 숙소"
};

// 조명 셋업 결정표 (07_장비비교자료/11_조명셋업짜기_latest.html:153 'const DEC=[…]' — JSON 배열)
function extractDEC(html) {
  const i = html.indexOf("const DEC=");
  if (i < 0) return null;
  let k = i + 10, depth = 0, inS = false, q = "";
  const start = k;
  for (; k < html.length; k++) {
    const c = html[k];
    if (inS) { if (c === "\\") { k++; continue; } if (c === q) inS = false; continue; }
    if (c === '"' || c === "'") { inS = true; q = c; continue; }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { depth--; if (depth === 0) { k++; break; } }
  }
  try { const D = JSON.parse(html.slice(start, k)); return Array.isArray(D) ? D : null; } catch (e) { return null; }
}

/**
 * 조명 셋업 — s007setup {결정id:[고른 선택지 uid]} + 결정표 DEC(13개).
 * 결정표를 못 읽으면 고른 결정 수만 센다.
 */
export function lightSetup() {
  return once("light", async () => {
    const raw = lsJSON("s007setup");
    let DEC = null;
    try {
      const r = await fetch("../../07_장비비교자료/11_조명셋업짜기_latest.html");
      if (r.ok) DEC = extractDEC(await r.text());
    } catch (e) {}
    if (!raw || typeof raw !== "object") return { hasSel: false, decOk: !!DEC, total: DEC ? DEC.length : 13 };
    if (!DEC) {
      const picked = Object.keys(raw).filter((k) => Array.isArray(raw[k]) ? raw[k].length > 0 : !!raw[k]).length;
      return { hasSel: true, decOk: false, picked, total: 13 };
    }
    // 앱과 같게 — 없는 결정·다른 결정의 선택지는 무시 (11_조명셋업짜기_latest.html:157-159)
    const ALL = {};
    DEC.forEach((d) => (d.opts || []).forEach((o) => { ALL[o.uid] = { o, d }; }));
    const sel = {};
    DEC.forEach((d) => { sel[d.id] = (Array.isArray(raw[d.id]) ? raw[d.id] : []).filter((u) => ALL[u] && ALL[u].d.id === d.id); });
    const ordered = DEC.slice().sort((a, b) => (a.num || 0) - (b.num || 0));
    const picked = ordered.filter((d) => sel[d.id].length).length;
    const nextD = ordered.find((d) => !sel[d.id].length) || null;
    const chosen = [];
    let lo = 0, hi = 0, unk = 0;
    ordered.forEach((d) => sel[d.id].forEach((u) => {
      const o = ALL[u].o;
      chosen.push({ dec: d.title, num: d.num, cat: d.cat, name: o.name, lo: o.lo, hi: o.hi, qty: o.qty > 1 ? o.qty : 1, stock: o.stock });
      if (o.lo === 0) return;
      if (o.lo == null) { unk++; return; }
      const q = o.qty > 1 ? o.qty : 1; lo += o.lo * q; hi += (o.hi != null ? o.hi : o.lo) * q;
    }));
    return {
      hasSel: true, decOk: true, total: DEC.length, picked, chosen, lo, hi, unk,
      next: nextD ? { num: nextD.num, title: nextD.title, mode: nextD.mode,
                      opts: (nextD.opts || []).map((o) => ({ name: o.name, sold: o.stock === "soldout" })) } : null
    };
  });
}

// ══════════════════════════════════════════════════════════════
// C. 정적 파일
// ══════════════════════════════════════════════════════════════

/** 거버넌스 감사 로그 (로그인 불필요) — 날짜 최신 순 전체 */
export function governance() {
  return once("gov", async () => {
    try {
      const r = await fetch("../governance/data.json", { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      const log = (Array.isArray(j.log) ? j.log : []).slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      const latest = (type) => log.find((x) => x && x.type === type) || null;
      return { updated: j.updated || null, log, weekly: latest("weekly"), biweekly: latest("biweekly"), monthly: latest("monthly") };
    } catch (e) { return null; }
  });
}

/** note 아카이브 — note/index.html 의 article.note(빈 칸 제외) 제목·링크 */
export function noteArchive() {
  return once("note", async () => {
    try {
      const r = await fetch("../../index.html", { cache: "no-store" });
      if (!r.ok) return null;
      const p = new DOMParser().parseFromString(await r.text(), "text/html");
      const items = Array.from(p.querySelectorAll("article.note:not(.note--empty)")).map((a) => {
        const h = a.querySelector("h3"), tg = a.querySelector(".note__tag"), ln = a.querySelector("a.note__open");
        let href = "";
        try { href = ln ? new URL(ln.getAttribute("href"), r.url).href : ""; } catch (e) {}
        return { title: h ? h.textContent.trim() : "", tag: tg ? tg.textContent.trim() : "", href };
      }).filter((x) => x.title);
      return { count: items.length, items };
    } catch (e) { return null; }
  });
}

// ── 화면 표시 도우미 ─────────────────────────────────────────
/** 못 읽은 값은 0이 아니라 '—' 로 보여준다. */
export const show = (v, unit = "") =>
  (v === null || v === undefined || Number.isNaN(v)) ? "—" : (v.toLocaleString ? v.toLocaleString() : String(v)) + unit;

export const won = (v) =>
  (v === null || v === undefined || Number.isNaN(v)) ? "—" : Number(v).toLocaleString() + "원";

/** 만원 단위 짧게 (관리자 캘린더 manwon 과 같은 모양) */
export const manwon = (v) =>
  (v === null || v === undefined) ? "—" : (Math.abs(v) >= 10000 ? Math.round(v / 10000).toLocaleString() + "만" : Number(v).toLocaleString());

export { todayISO, monthPrefix, addDays, dDiff, parseDS, fd };
