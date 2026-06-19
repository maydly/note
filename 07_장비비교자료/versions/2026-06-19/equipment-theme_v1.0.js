(function(){
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
