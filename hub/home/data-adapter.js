// ─────────────────────────────────────────────────────────────
// maydly 홈 대시보드 — 읽기 전용 어댑터
//
// 원칙 (운영-018)
//  1) 쓰기 코드 0줄. setDoc/updateDoc/deleteDoc 을 쓰지 않는다.
//  2) 읽기에 실패하면 0이 아니라 null 을 돌려준다. 화면은 '—' 로 표시한다.
//     (진짜 0 과 "못 읽음" 을 구분하지 못하면 틀린 숫자를 맞는 것처럼 보여주게 된다)
//  3) 각 앱의 데이터 모양이 바뀌면 이 파일만 고친다.
//
// 데이터 출처 3가지
//  A. Firestore (구글 로그인 필요) — mjApp/{kind}, mj_cal/events, 문의 컬렉션 2개
//  B. localStorage (같은 출처라 로그인 불필요) — 필름·여행지도·조명셋업
//  C. 정적 JSON — hub/governance/data.json
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
         setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy, limit }
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
export function login()  { return signInWithPopup(auth, new GoogleAuthProvider()); }
export function logout() { return signOut(auth); }
export function currentUser() { return auth.currentUser; }

// ── 공통 도우미 ──────────────────────────────────────────────
const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
         + "-" + String(d.getDate()).padStart(2, "0");
};
const monthPrefix = () => todayISO().slice(0, 7);          // 'YYYY-MM'
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
         + "-" + String(d.getDate()).padStart(2, "0");
};

// 못 읽으면 null. 빈 배열([])과 못 읽음(null)은 다른 뜻이다.
async function mjDoc(kind) {
  try {
    const s = await getDoc(doc(db, "mjApp", kind));
    if (!s.exists()) return null;
    const j = s.data().json;
    if (!j) return null;
    return JSON.parse(j);
  } catch (e) { return null; }
}

function lsJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

// ── A. Firestore ─────────────────────────────────────────────

/** 예약 이벤트 전체. 관리자 캘린더가 쓰는 mj_cal/events 를 «읽기만» 한다. */
export async function calEvents() {
  try {
    const s = await getDoc(doc(db, "mj_cal", "events"));
    if (!s.exists()) return null;
    const b = s.data().blob;
    if (!b) return null;
    const j = JSON.parse(b);
    const list = j.events || j;
    return Array.isArray(list) ? list : null;
  } catch (e) { return null; }
}

/** 오늘 예약 — 취소·노쇼 제외. {list, count} 또는 null */
export async function todayShoots() {
  const evs = await calEvents();
  if (!evs) return null;
  const t = todayISO();
  const list = evs
    .filter(e => e && e.date === t && e.status !== "cancel" && e.status !== "nosh")
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  return { list, count: list.length };
}

/** 앞으로 n일 예약(오늘 제외) */
export async function upcomingShoots(days = 14) {
  const evs = await calEvents();
  if (!evs) return null;
  const from = addDays(todayISO(), 1), to = addDays(todayISO(), days);
  const list = evs.filter(e => e && e.date >= from && e.date <= to
                            && e.status !== "cancel" && e.status !== "nosh");
  return { list, count: list.length };
}

/** 할 일 — 미완 / 오늘 마감 / 기한 지남 */
export async function todos() {
  const arr = await mjDoc("todos");
  if (!Array.isArray(arr)) return null;
  const t = todayISO();
  const open = arr.filter(x => x && !x.done);
  return {
    total: arr.length,
    open: open.length,
    dueToday: open.filter(x => x.due === t).length,
    overdue:  open.filter(x => x.due && x.due < t).length
  };
}

/** 이번달 가계부 — 수입/지출/미분류 건수 */
export async function ledgerThisMonth() {
  const arr = await mjDoc("ledger");
  if (!Array.isArray(arr)) return null;
  const m = monthPrefix();
  const cur = arr.filter(x => x && typeof x.date === "string" && x.date.slice(0, 7) === m);
  const sum = (t) => cur.filter(x => x.type === t)
                        .reduce((a, x) => a + (Number(x.amt) || 0), 0);
  // '미분류', '미분류·지출', '미분류·입금' 전부 포함
  const unclassified = arr.filter(x => x && String(x.cat || "").indexOf("미분류") === 0).length;
  return { income: sum("in"), expense: sum("out"), count: cur.length, unclassified };
}

/** 구매 대기 — buys 는 배열이거나 {items, del} 형태 */
export async function buys() {
  const raw = await mjDoc("buys");
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : null);
  if (!arr) return null;
  return { count: arr.length, list: arr.slice(0, 5) };
}

/** 보유 장비 개수 */
export async function owns() {
  const arr = await mjDoc("owns");
  if (!Array.isArray(arr)) return null;
  return { count: arr.length };
}

/** 갖고 싶은 것 */
export async function wishes() {
  const arr = await mjDoc("wishes");
  if (!Array.isArray(arr)) return null;
  return { count: arr.length };
}

/** 촬영 기록 */
export async function shootRecords() {
  const arr = await mjDoc("shoots");
  if (!Array.isArray(arr)) return null;
  return { count: arr.length, list: arr.slice(-5).reverse() };
}

/**
 * 시안 문의 — 서랍 두 개를 합쳐서 본다.
 * (설문데이터 페이지와 같은 기준: maydly_inquiries_test + maydly_inquiries)
 * 하나라도 못 읽으면 null. 일부만 읽고 숫자를 내면 실제보다 적게 보인다.
 */
export async function inquiries() {
  const COLS = ["maydly_inquiries_test", "maydly_inquiries"];
  const all = [];
  for (const c of COLS) {
    try {
      const snap = await getDocs(query(collection(db, c), orderBy("ts", "desc"), limit(200)));
      snap.forEach(d => {
        const x = d.data() || {};
        let ms = 0;
        try { ms = x.ts && x.ts.toDate ? x.ts.toDate().getTime() : new Date(x.ts).getTime(); } catch (e) {}
        all.push({ id: d.id, col: c, name: x.name || "", keep: x.keep || "",
                   insta: x.insta || "", status: x.status || "신규", ms: ms || 0 });
      });
    } catch (e) { return null; }   // 한 서랍이라도 실패하면 숫자를 내지 않는다
  }
  all.sort((a, b) => b.ms - a.ms);
  const fresh = all.filter(x => x.status === "신규");
  return { total: all.length, fresh: fresh.length, list: all.slice(0, 5) };
}

// ── B. localStorage (같은 출처라 로그인 없이 읽힌다) ──────────

/** 필름 재고 */
export function film() {
  const d = lsJSON("maydly-film-v1");
  if (!d || !Array.isArray(d.stock)) return null;   // 빈티지필름 앱: {stock:[{id,name,iso,qty}], deals, plan, seq}
  const rolls = d.stock.reduce((a, x) => a + (Number(x.qty) || 0), 0);
  return { kinds: d.stock.length, rolls };
}

/** 여행지도 — 내가 저장한 장소 */
export function travelPlaces() {
  const arr = lsJSON("maydly_travel_places");   // 여행지도 앱: 순수 배열로 저장
  if (!Array.isArray(arr)) return null;
  return { count: arr.length };
}

/** 조명 셋업 — 13개 결정 중 고른 수 */
export function lightSetup() {
  const d = lsJSON("s007setup");
  if (!d || typeof d !== "object") return null;
  // sel[결정id] = 고른 선택지 id 배열. 빈 배열은 «아직 안 고른 것»이므로 세지 않는다
  const picked = Object.keys(d).filter(k => {
    const v = d[k];
    return Array.isArray(v) ? v.length > 0 : (v !== null && v !== undefined && v !== "");
  }).length;
  return { picked, total: 13 };
}

// ── C. 정적 JSON ─────────────────────────────────────────────

/** 거버넌스 감사 로그 (로그인 불필요) */
export async function governance() {
  try {
    const r = await fetch("../governance/data.json", { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const log = Array.isArray(j.log) ? j.log : [];
    return { updated: j.updated || null, log: log.slice(0, 5) };
  } catch (e) { return null; }
}

// ── 화면 표시 도우미 ─────────────────────────────────────────
/** 못 읽은 값은 0이 아니라 '—' 로 보여준다. */
export const show = (v, unit = "") =>
  (v === null || v === undefined || Number.isNaN(v)) ? "—" : (v.toLocaleString ? v.toLocaleString() : String(v)) + unit;

export const won = (v) =>
  (v === null || v === undefined) ? "—" : Number(v).toLocaleString() + "원";

export { todayISO, monthPrefix };
