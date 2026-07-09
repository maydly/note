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
