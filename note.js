/* ==========================================================================
   Maydly Study Archive — 노트 공용 스크립트
   탭(교육 모듈) 전환. 의존성 없음. 한 페이지에 여러 .tabs 가 있어도 각각 독립.
   ========================================================================== */
(function () {
  function initTabs(tabs) {
    var labels = tabs.querySelectorAll(".tab-label");
    var panels = tabs.querySelectorAll(".tab-panel");
    for (var i = 0; i < labels.length; i++) {
      (function (idx) {
        labels[idx].addEventListener("click", function () {
          for (var j = 0; j < labels.length; j++) {
            labels[j].classList.remove("is-active");
            if (panels[j]) panels[j].classList.remove("is-active");
          }
          labels[idx].classList.add("is-active");
          if (panels[idx]) panels[idx].classList.add("is-active");
        });
      })(i);
    }
    // 시작 시 활성 탭이 없으면 첫 탭을 연다
    if (!tabs.querySelector(".tab-label.is-active") && labels.length) {
      labels[0].classList.add("is-active");
      if (panels[0]) panels[0].classList.add("is-active");
    }
  }

  function boot() {
    var all = document.querySelectorAll(".tabs");
    for (var i = 0; i < all.length; i++) initTabs(all[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
