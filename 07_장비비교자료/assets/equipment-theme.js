(function(){
  const addHomeLink=()=>{
    if(document.querySelector(".note-home-link")) return;
    const link=document.createElement("a");
    link.className="note-home-link";
    link.href="../index.html";
    link.textContent="← 이전 / note 홈";
    link.setAttribute("aria-label","이전 페이지 또는 note 홈으로 이동");
    link.addEventListener("click",(event)=>{
      try{
        const referrer=new URL(document.referrer);
        const sameNoteSite=referrer.host===location.host && referrer.pathname.startsWith("/note/");
        if(sameNoteSite && history.length>1){
          event.preventDefault();
          history.back();
        }
      }catch(error){}
    });
    document.body.appendChild(link);
  };

  addHomeLink();

  // 목차의 가이드·보유현황·구매계획을 모든 페이지 상단 내비에 자동 추가
  const navBar=document.querySelector(".top-nav");
  if(navBar){
    [["08_일본빈티지렌즈_쇼핑가이드_latest.html","빈티지쇼핑"],
     ["09_보유장비현황_latest.html","보유현황"],
     ["10_구매계획리스트_latest.html","구매계획"]].forEach(function(item){
      if(!navBar.querySelector('a[href="'+item[0]+'"]')){
        const a=document.createElement("a");
        a.href=item[0];
        a.textContent=item[1];
        navBar.appendChild(a);
      }
    });
  }

  const current=(location.pathname.split("/").pop()||"index.html");
  const aliases={
    "index.html":"00_장비비교_목차_latest.html",
    "01_조명_비교표_latest.html":"04_조명_비교표_latest.html",
    "02_카메라_바디_비교표_latest.html":"01_카메라_비교표_latest.html",
    "03_렌즈_필터_비교표_latest.html":"00_장비비교_목차_latest.html"
  };
  const active=aliases[current]||current;
  document.querySelectorAll(".top-nav a").forEach((link)=>{
    const target=link.getAttribute("href") || "";
    const file=target.split("/").pop();
    if(file===active) link.classList.add("is-active");
  });
})();

/* maydly 허브 복귀 버튼 (자동 주입) */
(function(){
  function add(){
    if(document.getElementById('maydlyHubBtn'))return;
    var a=document.createElement('a');
    a.id='maydlyHubBtn';a.href='https://maydly-hub.netlify.app/';a.setAttribute('aria-label','maydly 허브로');
    a.style.cssText="position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:2147483647;display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,.94);color:#2e2a26;text-decoration:none;font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;font-size:13px;line-height:1;padding:9px 15px;border-radius:22px;box-shadow:0 3px 14px rgba(0,0,0,.22);border:1px solid rgba(0,0,0,.06)";
    a.innerHTML='<span style="font-weight:800">\u2190 \uD5C8\uBE0C</span><span style="width:1px;height:12px;background:rgba(0,0,0,.16)"></span><span style="font-weight:600;color:#8a8178">장비 비교자료</span>';
    (document.body||document.documentElement).appendChild(a);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();
})();
