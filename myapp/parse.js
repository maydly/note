/* 명진앱 가계부 — 은행 엑셀 파서 + 자동 분류 (브라우저/node 공용)
   지원: 하나은행 · 카카오뱅크 · 카카오페이 (.xlsx) — SheetJS(XLSX) 필요
   사용(앱): MJParse.parseWorkbook(XLSX.read(buf)) → [{date,desc,cat,type,amt,memo}]
*/
(function (root) {
  var num = function (s) { return Number(String(s == null ? "" : s).replace(/[,\s₩]/g, "")) || 0; };
  var clean = function (s) { return String(s == null ? "" : s).trim(); };

  // ---- 분류 규칙 (엔진 v2와 동기화) ----
  var OVERRIDES = [
    { re: /하나머니충전|네이버페이충전/, cat: "간편결제·페이" }, // 외부지갑 충전=실제 지출(그 안에서 소비)
    { re: /^2605(?![가-힣])|^25\.06|^\d{1,2}[.\/]\d{1,2}\s*-\s*\d{1,2}/, cat: "수입·급여/사업", type: "in" },
    { re: /박성준/, cat: "수입·급여/사업", type: "in" },
    { re: /일급.*하나\d|일급\(|하나1907|\(하나\d/, cat: "이체·본인계좌" }, // 하나은행→카페이/카뱅 계좌이동(가짜 급여 방지)
    { re: /김하람/, cat: "이체·입금(인명·확인)", type: "in" },
    { re: /아정당/, cat: "수입·기타", type: "in" },
    { re: /^이승($|\s|\()/, cat: "이체·차입(대출받음)", type: "in" },
    { re: /이준걸/, cat: "수입·중고판매", type: "in" },
    { re: /박상은/, cat: "장비·카메라" },
    { re: /ATM입금/, cat: "이체·본인계좌" },
    { re: /세무서/, cat: "세금·공과" },
    { re: /카카오.?택시|카카오T|후불교통대금/, cat: "교통" },
    { re: /김영숙/, cat: "생활지출", type: "out" },
    { re: /통신요금|유무선\s*통신|통신비/, cat: "통신" },
    { re: /현석/, cat: "차량·주유", type: "out" },
    { re: /망한몸/, cat: "대출상환" },
    { re: /이보토/, cat: "구독·디지털" },
    { re: /일급/, cat: "이체·본인계좌", type: "out" },
    { re: /임성진|이희열|김호준|박경림|박소희|직원\s*인건비|직원인건비|스튜디오\s*오입금|EVOTO|엘리필름/i, cat: "사업지출" },
    { re: /이준걸/, cat: "사업지출", type: "out" },
    { re: /윤세연|극우지윤|혜진누나|김인겸|유이버/, cat: "경조·지인", type: "out" },
    { re: /최범진|계양산해장국|마시안홍도조개구|남춘네숯불닭갈/, cat: "식비·편의점·마트" },
    { re: /무신사|현대백중동점|현대백화점|29CM|ALIEXPRESS|Temu|테무|이랜드|KCP|Npay/i, cat: "쇼핑·생활" },
    { re: /트래블월렛|airbnb|하이PC플스|뉴코뮤직타운/i, cat: "여가·문화·여행" },
    { re: /에스엠하이플러스|KH에너지|현대시흥남부|하이머니충전|하이패스/i, cat: "차량·주유" },
    { re: /윰\(Yum\)|^윰/i, cat: "장비·카메라" }
  ];
  var INTERNAL = [
    ["이체·본인계좌", function (t) { return /김명진|김성규/.test(t.desc) && !/SKT|\bKT\b|LGU|유플|한전|삼천리|도시가스|전기|가스|오일뱅크|칼텍스|주유|보험|통신|한국전력/.test(t.desc); }],
    ["지인·가족송금", function (t) { return /고수빈/.test(t.desc); }],  // 명진 확정: 지출
    ["간편결제충전·계좌이동", function (t) { return /부족분충전|카카오페이|카카오뱅크|내계좌로|전체금액\s*전달|ATM출금|수협ATM|VAN출금|내보내기|내계좌/.test(t.desc + t.sub); }]
  ];
  var INCOME = [
    ["수입·촬영/사업", function (t) { return t.acct === "카카오뱅크" && /일반입금/.test(t.sub) && /^[가-힣]{2,4}(\(|$| )/.test(t.desc.trim()); }],
    ["수입·촬영/사업", function (t) { return /촬영|대관|워터마크|보정|스튜디오|예약금|계약금/.test(t.desc); }],
    ["수입·급여/사업", function (t) { return /급여|일급|월급|주급|PA\d|위버스|드림월드|제일자동차|국세청|장려금/.test(t.desc); }],
    ["수입·이자/환급", function (t) { return /이자|예탁금|환급|환출|하나체크환급/.test(t.desc); }],
    ["수입·중고판매", function (t) { return /번개장터|당근|중고나라|무신사/.test(t.desc); }]
  ];
  var EXPENSE = [
    ["차량·주유", function (t) { return /주유|오일뱅크|칼텍스|에스오일|S-OIL|SK에너지|GS칼텍스|삼천리|자동차공|현석차|정비|카센|자연에너지|신진에너지|공업사/.test(t.desc); }],
    ["통신", function (t) { return /SKT|\bKT\b|LGU|엘지유플|유플러스|알뜰폰|스터디맥스|SK브로드밴드|브로드밴드/.test(t.desc); }],
    ["구독·디지털", function (t) { return /테무|어도비|adobe|넷플|netflix|유튜브|youtube|구글|google|애플|apple|사쿠라재팬|스팀|steam|정기결제|_KCP|wavve|웨이브|디즈니|왓챠/i.test(t.desc); }],
    ["여가·문화·여행", function (t) { return /롯데컬처|CGV|메가박스|영화|아고다|agoda|야놀자|여기어때|호텔|항공|여행|리조트|펜션|입장/i.test(t.desc); }],
    ["미용", function (t) { return /헤어|미용|네일|왁싱|바버|barber|살롱|이발/i.test(t.desc); }],
    ["공과금", function (t) { return /한전|전기|도시가스|수도|가스공사|관리비/.test(t.desc); }],
    ["의료·약국", function (t) { return /약국|병원|의원|치과|한의원|메디|의학과|가정의학/.test(t.desc); }],
    ["기호품", function (t) { return /베이프|vape|담배|전자담배|연초/i.test(t.desc); }],
    ["오락·게임", function (t) { return /오락실|캐치팡|블링팝|피씨방|PC방|노래|코인/.test(t.desc); }],
    ["교통", function (t) { return /택시|티머니|이동의즐거움|버스|지하철|철도|코레일|고속도로|하이패스|주차/.test(t.desc); }],
    ["식비·편의점·마트", function (t) { return /씨유|CU|지에스25|GS25|세븐일레븐|이마트|트레이더스|홈플러스|롯데마트|노브랜드|해당화|식당|김밥|분식|치킨|피자|카페|스타벅스|배달|요기요|배민|맥도날드|롯데리아|버거|맘스터치|훠궈|마라|국밥|고기|베이커리|bakery|coffee|커피|도넛|dough|떡볶|초밥|스시|홍식당/i.test(t.desc); }],
    ["쇼핑·생활", function (t) { return /백화점|다이소|올리브영|쿠팡|11번가|지마켓|옥션|스토어|마켓|아울렛|사이먼|AK&|무인양품|이케아/.test(t.desc); }],
    ["장비·카메라", function (t) { return /카메라|a7m4|렌즈|삼각대|조명|스트로보|짐벌/i.test(t.desc); }]
  ];
  function classify(t) {
    var dir = t.isIn ? "in" : "out";
    for (var i = 0; i < OVERRIDES.length; i++) { var o = OVERRIDES[i]; if (o.type && o.type !== dir) continue; if (o.re.test(t.desc)) return o.cat; }
    for (var j = 0; j < INTERNAL.length; j++) if (INTERNAL[j][1](t)) return INTERNAL[j][0];
    var list = t.isIn ? INCOME : EXPENSE;
    for (var k = 0; k < list.length; k++) if (list[k][1](t)) return list[k][0];
    var isName = /^[가-힣]{2,4}(\(|$| )/.test(t.desc.trim()) || /^[a-z]{3,}$/i.test(t.desc.trim());
    if (isName) return t.isIn ? "수입·촬영/사업" : "지인·가족송금";  // 명진 확정: 사람송금(환불·당근 등)=지출
    return t.isIn ? "미분류·입금" : "미분류·지출";
  }

  // ---- 포맷 감지 + 행 파싱 ----
  function colIdx(header, re) { for (var i = 0; i < header.length; i++) if (re.test(header[i])) return i; return -1; }
  function detectFormat(header) {
    var has = function (re) { return colIdx(header, re) >= 0; };
    if (has(/입금액/) && has(/출금액/)) return "hana";
    if (has(/내용/) && has(/거래금액/)) return "kbank";                                  // 카뱅: '내용' 열 존재(카페이엔 없음)
    if (has(/거래구분/) && (has(/은행/) || has(/계좌\s*정보|결제\s*정보/))) return "kpay";
    return null;
  }
  function parseSheet(rows) {
    // 헤더행 = '거래일시' 포함 행
    var hi = -1;
    for (var i = 0; i < rows.length; i++) { if (rows[i].some(function (c) { return /거래일시/.test(clean(c)); })) { hi = i; break; } }
    if (hi < 0) return [];
    var header = rows[hi].map(clean);
    var fmt = detectFormat(header);
    if (!fmt) return [];
    var out = [];
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      var t = null;
      if (fmt === "hana") {
        var d = clean(row[colIdx(header, /거래일시/)]);
        if (!/^\d{4}-\d{2}-\d{2}/.test(d)) continue;
        var inV = num(row[colIdx(header, /입금액/)]), outV = num(row[colIdx(header, /출금액/)]);
        t = { acct: "하나은행", date: d.slice(0, 10), time: d.slice(11, 19), desc: clean(row[colIdx(header, /적요/)]) || clean(row[colIdx(header, /의뢰인|수취인/)]), sub: clean(row[colIdx(header, /^구분$/)]), isIn: inV > 0, amt: inV || outV };
      } else if (fmt === "kbank") {
        var d2 = clean(row[colIdx(header, /거래일시/)]);
        if (!/^\d{4}\.\d{2}\.\d{2}/.test(d2)) continue;
        var gubun = clean(row[colIdx(header, /^구분$/)]);
        t = { acct: "카카오뱅크", date: d2.slice(0, 10).replace(/\./g, "-"), time: d2.slice(11, 19), desc: clean(row[colIdx(header, /내용/)]) || clean(row[colIdx(header, /거래구분/)]), sub: clean(row[colIdx(header, /거래구분/)]), isIn: /입금/.test(gubun), amt: Math.abs(num(row[colIdx(header, /거래금액/)])) };
      } else if (fmt === "kpay") {
        var d3 = clean(row[colIdx(header, /거래일시/)]);
        if (!/^\d{4}-\d{2}-\d{2}/.test(d3)) continue;
        var g = clean(row[colIdx(header, /거래구분/)]);
        var info = clean(row[colIdx(header, /계좌\s*정보|결제\s*정보/)]);
        t = { acct: "카카오페이", date: d3.slice(0, 10), time: d3.slice(11, 19), desc: info || g.replace(/\[.\]/, "").trim(), sub: g.replace(/\[.\]/, "").trim(), isIn: /\[\+\]/.test(g), amt: Math.abs(num(row[colIdx(header, /거래금액/)])) };
      }
      if (t && t.date && t.amt) out.push(t);
    }
    return out;
  }
  function parseWorkbook(wb) {
    var raw = [];
    wb.SheetNames.forEach(function (sn) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: "" });
      raw = raw.concat(parseSheet(rows));
    });
    return raw.map(function (t) {
      return { date: t.date, time: t.time || "", desc: t.desc, cat: classify(t), type: t.isIn ? "in" : "out", amt: t.amt, acct: t.acct, memo: "" };
    });
  }

  var api = { parseWorkbook: parseWorkbook, parseSheet: parseSheet, classify: classify, detectFormat: detectFormat };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MJParse = api;
})(typeof window !== "undefined" ? window : this);
