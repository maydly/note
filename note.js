/* ==========================================================================
   maydly Study Archive — 공부 노트 공용 스크립트 v3.0 (261024 · 애플형)
   - 탭 전환 + 미끄러지는 밑줄 · 읽은 만큼 차는 막대 · 지금 읽는 목차 강조(지나온 목차 점 채우기)
   - 보이면 부드럽게 떠오르기 · 단계 선/흐름 화살표 그리기 · 체크 채우기 · 코드 복사 버튼
   - 로고 옆 클로버 + 여백의 은은한 클로버
   - 분야 표시(body[data-cat]) · 제목 앞 번호(01 —)를 따로 떼어 꾸밈 · 노트마다 다른 빛 번짐
   의존성 없음. 움직임 줄이기 설정이면 움직임 없이 바로 보인다. 본문 HTML 은 바꾸지 않는다.
   ========================================================================== */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;
  var LEAF = "M12 12C9 9 7.6 5.6 9.8 4.4c1.2-.6 2.2.2 2.2 1.2 0-1 1-1.8 2.2-1.2C16.4 5.6 15 9 12 12z";
  function cloverSVG(cls) {
    var g = "";
    for (var r = 0; r < 360; r += 90) g += '<path d="' + LEAF + '" transform="rotate(' + r + ' 12 12)"/>';
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor">' + g +
      '</g><path d="M12 12c.6 3 1.8 5.6 3.6 7.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  }

  /* ---- 탭 ---- */
  function initTabs(tabs) {
    var labels = tabs.querySelectorAll(".tab-label");
    var panels = tabs.querySelectorAll(".tab-panel");
    var bar = tabs.querySelector(".tab-labels");
    var ink = document.createElement("span");
    ink.className = "tab-ink";
    if (bar) bar.appendChild(ink);
    function moveInk(el) {
      if (!el || !bar) return;
      ink.style.width = el.offsetWidth + "px";
      ink.style.transform = "translateX(" + (el.offsetLeft) + "px)";
    }
    function activate(idx) {
      for (var j = 0; j < labels.length; j++) {
        labels[j].classList.toggle("is-active", j === idx);
        labels[j].setAttribute("aria-selected", j === idx ? "true" : "false");
        if (panels[j]) panels[j].classList.toggle("is-active", j === idx);
      }
      moveInk(labels[idx]);
    }
    for (var i = 0; i < labels.length; i++) {
      (function (idx) { labels[idx].addEventListener("click", function () { activate(idx); }); })(i);
    }
    var start = 0;
    for (var k = 0; k < labels.length; k++) if (labels[k].classList.contains("is-active")) start = k;
    if (labels.length) activate(start);
    tabs.classList.add("js-ready");
    window.addEventListener("resize", function () { moveInk(tabs.querySelector(".tab-label.is-active")); });
  }

  /* ---- 읽은 만큼 차는 막대 ---- */
  function initProgress() {
    if (reduce) return;
    var bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty("--read", h > 0 ? Math.min(1, window.scrollY / h).toFixed(4) : 0);
      ticking = false;
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---- 지금 읽는 목차 강조 ---- */
  function initNav() {
    var links = document.querySelectorAll(".nav-links a[href^='#']");
    if (!links.length || !hasIO) return;
    var map = {};
    for (var i = 0; i < links.length; i++) map[links[i].getAttribute("href").slice(1)] = links[i];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || !map[e.target.id]) return;
        for (var id in map) map[id].classList.remove("is-current");
        var a = map[e.target.id];
        a.classList.add("is-current");
        if (a.scrollIntoView && a.parentNode.scrollWidth > a.parentNode.clientWidth) {
          a.parentNode.scrollTo({ left: a.offsetLeft - 40, behavior: reduce ? "auto" : "smooth" });
        }
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    document.querySelectorAll("section[id]").forEach(function (s) { io.observe(s); });
  }

  /* ---- 보이면 나타나기 · 선 그리기 · 체크 채우기 ---- */
  function initReveal() {
    var sel = ".section-head, .card, .step, .flow-item, .compare, .callout, pre, .checklist li, .tabs, .bullets";
    var els = document.querySelectorAll(sel);
    var draws = document.querySelectorAll(".timeline, .flow-item");
    if (reduce || !hasIO) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    draws.forEach(function (d) { d.style.setProperty("--draw", 0); });
    els.forEach(function (el) {
      el.classList.add("reveal");
      var sib = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.style.transitionDelay = Math.min(sib, 5) * 70 + "ms";
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        if (e.target.classList.contains("flow-item")) e.target.style.setProperty("--draw", 1);
        var tl = e.target.closest && e.target.closest(".timeline");
        if (tl) tl.style.setProperty("--draw", 1);
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---- 코드 복사 ---- */
  function initCopy() {
    if (!navigator.clipboard) return;
    document.querySelectorAll("pre").forEach(function (pre) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "copy-btn"; b.textContent = "복사";
      b.addEventListener("click", function () {
        var txt = (pre.querySelector("code") || pre).innerText.replace(/복사(됨)?$/, "").trim();
        navigator.clipboard.writeText(txt).then(function () {
          b.textContent = "복사됨"; b.classList.add("is-done");
          setTimeout(function () { b.textContent = "복사"; b.classList.remove("is-done"); }, 1600);
        });
      });
      pre.appendChild(b);
    });
  }

  /* ---- 클로버: 로고 옆 1개 + 여백에 은은하게 5개(maydly 기준) ---- */
  function initClover() {
    var brand = document.querySelector(".brand");
    if (brand && !brand.querySelector(".brand-clover")) brand.insertAdjacentHTML("beforeend", cloverSVG("brand-clover"));
    if (document.querySelector(".clover-field")) return;
    var spots = [
      { t: "9%", l: "3%", s: 34, r: -14 }, { t: "38%", r2: "2.5%", s: 26, r: 18 },
      { t: "64%", l: "4%", s: 22, r: 32 }, { t: "86%", r2: "5%", s: 30, r: -8 }, { t: "22%", r2: "8%", s: 16, r: 50 }
    ];
    var html = "";
    spots.forEach(function (p) {
      var pos = "top:" + p.t + ";" + (p.l ? "left:" + p.l : "right:" + p.r2) + ";width:" + p.s + "px;height:" + p.s + "px;transform:rotate(" + p.r + "deg)";
      html += cloverSVG().replace("<svg ", '<svg style="' + pos + '" ');
    });
    var f = document.createElement("div");
    f.className = "clover-field"; f.setAttribute("aria-hidden", "true"); f.innerHTML = html;
    document.body.insertBefore(f, document.body.firstChild);
  }

  /* ---- 제목에 이미 번호(예: '05 —')를 붙인 노트는 자동 번호를 숨긴다 ---- */
  function initNumbers() {
    var hs = document.querySelectorAll("section h2"), own = 0;
    for (var i = 0; i < hs.length; i++) if (/^\s*\d{1,2}\s*[—–\-.:]/.test(hs[i].textContent)) own++;
    if (own && own >= hs.length / 2) document.body.classList.add("own-numbers");
  }

  function boot() {
    initNumbers();
    document.querySelectorAll(".tabs").forEach(initTabs);
    initClover();
    initProgress();
    initNav();
    initReveal();
    initCopy();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
/* 문서형: 지나온 목차에 점 채우기 */
(function(){ if(!("IntersectionObserver" in window)) return; var links=[].slice.call(document.querySelectorAll(".nav-links a[href^='#']"));
  window.addEventListener("scroll",function(){ var cur=document.querySelector(".nav-links a.is-current"); var idx=links.indexOf(cur); links.forEach(function(a,i){a.classList.toggle("is-done", idx>=0 && i<idx);}); },{passive:true}); })();

/* ── 고급 시안 공통: 분야 표시 · 노트별 씨앗값 · 제목 앞 번호를 따로 떼어 꾸밀 수 있게 ── */
(function(){ var e=document.querySelector(".eyebrow"), t=(e&&e.textContent||"").toLowerCase(), c="dev";
  if(t.indexOf("workflow")>=0) c="wf"; else if(/\bai\b/.test(t)) c="ai"; else if(t.indexOf("design")>=0) c="design";
  document.body.setAttribute("data-cat",c);
  var h1=document.querySelector("h1"), s=0, title=(h1&&h1.textContent||document.title).trim();
  for(var i=0;i<title.length;i++) s=(s*31+title.charCodeAt(i))>>>0;
  window.__noteSeed=s||7; window.__noteTitle=title;
  window.__rnd=function(){ var x=window.__noteSeed; return function(){ x=(x*1103515245+12345)>>>0; return ((x>>>8)%1000)/1000; }; };
  document.querySelectorAll("section h2").forEach(function(h){ var n=h.firstChild; if(!n||n.nodeType!==3) return;
    var m=n.nodeValue.match(/^\s*(\d{1,2})\s*[—–\-.:]\s*/); if(!m) return; n.nodeValue=n.nodeValue.slice(m[0].length);
    var sp=document.createElement("span"); sp.className="h-num"; sp.setAttribute("data-n",m[1]); sp.textContent=m[1]; h.insertBefore(sp,h.firstChild); });
})();
/* 고급 시안 2: 노트마다 다른 빛 번짐(분야 색 3가지 · 씨앗값으로 위치·크기·기울기 결정) */
(function(){ var hd=document.querySelector("header"); if(!hd) return; var r=window.__rnd(), html="";
  ["--g1","--g2","--g3"].forEach(function(v,i){ var w=34+r()*30, x=r()*(100-w), y=r()*40;
    html+='<i style="left:'+x.toFixed(1)+'%;top:'+y.toFixed(1)+'%;width:'+w.toFixed(1)+'%;height:'+(w*1.25).toFixed(1)+'%;background:var('+v+');animation-delay:-'+(r()*14).toFixed(1)+'s"></i>'; });
  var a=document.createElement("div"); a.className="aurora"; a.setAttribute("aria-hidden","true"); a.innerHTML=html;
  a.style.transform="rotate("+Math.round(r()*60-30)+"deg)"; hd.insertBefore(a,hd.firstChild); })();
