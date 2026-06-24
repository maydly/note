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
