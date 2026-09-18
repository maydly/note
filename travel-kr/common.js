/* 공유 로직 — 좌표 + 카드/상세 렌더 (실지도·그림지도 공용)
   데이터: window.TVIMG(이미지), CITY(도시), ORDER(순서) 는 data/*.js 에서 로드됨 */

// 20개 도시 좌표 [위도, 경도]
/* ⚠️ 260918 — 여기 있던 일본 도시 좌표 20곳을 지웠다.
   이 파일은 일본 지도의 common.js를 복사해 온 것이라 `var COORDS = {tokyo:…}`가 남아 있었는데,
   index.html이 data/city_kr.js(국내 162곳) **다음에** 이 파일을 부르므로 국내 좌표를 통째로 덮어썼다.
   → 마커 loop의 `COORDS[k]`가 전부 undefined가 되어 **국내 전용 페이지에 도시 마커가 하나도 안 보였다.**
   통합본 travel/index.html은 두 스크립트 사이에서 COORDS를 COORDS_KR로 먼저 담아 두기 때문에 멀쩡하다.
   국내 전용 페이지에 일본 좌표는 필요 없으므로 블록째 제거한다. */

function img(key){ if(key && /^https?:\/\//.test(key)) return key; return (window.TVIMG && window.TVIMG[key]) || (window.CITYIMG && window.CITYIMG[key]) || ''; }
function hasImg(key){ return !!img(key); }
// 이미지 있으면 배경사진, 없으면 브랜드 그라데이션 플레이스홀더
function bg(key){ var u=img(key); return u ? 'background-image:url('+u+')' : 'background:linear-gradient(135deg,#dfeee1,#c6ddce)'; }
function noImgTag(key){ return hasImg(key) ? '' : '<span class="noimg">📷 사진 준비중</span>'; }
// 도시 대표사진: 위키(CITYPHOTO, 고유 URL) 있으면 쓰고, 아니면 base64(명진 실사진), 없으면 플레이스홀더
function cityPhoto(k, c){
  if(window.CITYPHOTO && window.CITYPHOTO[k]) return window.CITYPHOTO[k];
  var u = img(c.hero); if(u) return u;
  var sp = c.spots||[];
  for(var i=0;i<sp.length;i++){ if(sp[i].imgs && sp[i].imgs.length) return sp[i].imgs[0]; }
  if(c.days){ for(var d=0;d<c.days.length;d++){ var ds=c.days[d].spots||[]; for(var j=0;j<ds.length;j++){ if(ds[j].imgs && ds[j].imgs.length) return ds[j].imgs[0]; } } }
  return '';
}
function heroStyle(k,c){ var u=cityPhoto(k,c); return u ? 'background-image:url('+u+')' : 'background:linear-gradient(135deg,#dfeee1,#c6ddce)'; }
function heroNoImg(k,c){ return cityPhoto(k,c) ? '' : '<span class="noimg">📷 사진 준비중</span>'; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
// prep: 배열[[라벨,내용]] 또는 문자열 모두 지원
function prepHTML(prep){
  if(!prep) return '';
  var inner;
  if(Array.isArray(prep)){
    inner = '<div class="prep-grid">'+prep.map(function(p){
      return '<div class="prep-row"><span class="prep-k">'+esc(p[0])+'</span><span class="prep-v">'+esc(p[1])+'</span></div>';
    }).join('')+'</div>';
  } else {
    inner = esc(prep);
  }
  return '<div class="d-prep"><div class="prep-title">🎒 준비물 · 팁</div>'+inner+'</div>';
}

/* ── 미리보기 카드 ("오 여기?") ── */
function showPreview(k){
  var c = CITY[k]; if(!c) return;
  var el = document.getElementById('preview');
  el.innerHTML =
    '<div class="pv-img">'
    + (cityPhoto(k,c)?'<img class="pv-photo" src="'+cityPhoto(k,c)+'" alt="">':'')
    + '<span class="reg">'+esc(c.region||'')+'</span>'+heroNoImg(k,c)
    + '<button class="pv-x" onclick="hidePreview()">×</button></div>'
    + '<div class="pv-body">'
    + '<div class="pv-title">'+esc(c.nm||c.title)+(c.ap?'<small>'+esc(c.ap)+'</small>':'')+'</div>'
    + '<div class="pv-mood">'+esc(c.mood||c.title)+'</div>'
    + (c.see?'<div class="pv-see">👀 '+esc(c.see)+'</div>':'')
    + '<button class="pv-btn" onclick="openDetail(\''+k+'\')">상세 비용·가이드 보기 →</button>'
    + '</div>';
  el.classList.add('on');
}
function hidePreview(){ document.getElementById('preview').classList.remove('on'); }

/* ── 상세 패널 ── */
function metaChips(m){ return (m&&m.length)? '<div class="sp-meta">'+m.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>':''; }
function spotHTML(s){
  var h = '<div class="d-spot">';
  if(s.imgs && s.imgs.length){
    h += '<div class="sp-gallery">'+s.imgs.slice(0,3).map(function(u){return '<div class="sp-gimg" style="background-image:url('+u+')"></div>';}).join('')+'</div>';
  } else if(s.img && img(s.img)){
    h += '<div class="sp-img" style="background-image:url('+img(s.img)+')"></div>';
  }
  h += '<div class="sp-in"><div class="sp-name">'+esc(s.name)+'</div>';
  if(s.rom) h += '<div class="sp-rom">'+esc(s.rom)+'</div>';
  h += metaChips(s.meta);
  if(s.desc) h += '<div class="sp-desc">'+esc(s.desc)+'</div>';
  if(s.todo && s.todo.length) h += '<ul class="sp-todo">'+s.todo.map(function(t){return '<li>'+esc(t)+'</li>';}).join('')+'</ul>';
  if(s.eat) h += '<div class="sp-line eat">🍽 '+esc(s.eat)+'</div>';
  if(s.tip) h += '<div class="sp-line tip">💡 '+esc(s.tip)+'</div>';
  h += '</div></div>';
  return h;
}
function openDetail(k){
  var c = CITY[k]; if(!c) return;
  var d = document.getElementById('detail');
  var h = '<div class="d-hero">'+(cityPhoto(k,c)?'<img class="d-photo" src="'+cityPhoto(k,c)+'" alt="">':'')+heroNoImg(k,c)+'<div class="d-scrim"></div>'
    + '<div class="d-hcap"><div class="d-eyebrow">'+esc(c.region||'일본')+'</div>'
    + '<div class="d-title">'+esc(c.title||c.nm)+'</div>'
    + (c.route?'<div class="d-route">'+esc(c.route)+'</div>':'')+'</div></div>';
  h += '<div class="d-wrap"><div class="d-summary">';
  if(c.cost) h += '<div class="d-sumrow"><span>💴</span><b>'+esc(c.cost)+'</b></div>';
  if(c.fare) h += '<div class="d-sumrow"><span>✈️</span>'+esc(c.fare)+'</div>';
  if(c.sep)  h += '<div class="d-sumrow"><span>🗓</span>'+esc(c.sep)+'</div>';
  if(c.mood) h += '<div class="d-sumrow"><span>✨</span>'+esc(c.mood)+'</div>';
  h += '</div>';
  // DAY 헤더 없이 스팟을 쭉 나열(순서·동선은 여행자가 자유롭게). days(기존딥)/spots(신규) 모두 지원
  var _spots = (c.days && c.days.length) ? Array.prototype.concat.apply([], c.days.map(function(d){return d.spots||[];})) : (c.spots||[]);
  if(_spots.length){
    h += '<div class="d-dayhead"><span class="d-daybadge">볼거리</span><span class="d-daytitle">가볼 만한 곳<small>순서·동선은 자유롭게 짜세요</small></span></div>';
    _spots.forEach(function(s){ h += spotHTML(s); });
  }
  // 라이트 티어(아직 미보강): 명소·시즌·촬영만
  if(!_spots.length && c._light){
    h += '<div class="d-dayhead"><span class="d-daybadge">가이드</span><span class="d-daytitle">가볼 만한 곳<small>가볍게 둘러보기 좋은 곳</small></span></div>';
    h += '<div class="d-spot"><div class="sp-in">';
    if((c._light.s||[]).length) h += '<div class="sp-name">📍 이런 걸 봐요</div><ul class="sp-todo">'+(c._light.s||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';
    if(c._light.bs) h += '<div class="sp-line tip">🗓 베스트 시즌 · '+esc(c._light.bs)+'</div>';
    if(c._light.ph) h += '<div class="sp-line eat">📷 촬영 스팟 · '+esc(c._light.ph)+'</div>';
    h += '<div class="sp-line" style="color:var(--ink-soft);margin-top:10px">🍀 간단 가이드예요. 상세 일정은 추후 추가됩니다.</div>';
    h += '</div></div>';
  }
  h += prepHTML(c.prep);
  h += '</div>';
  d.innerHTML = h;
  d.classList.add('on'); d.scrollTop = 0;
  var fb=document.getElementById('fixedBack'); if(fb) fb.classList.add('on');
}
function closeDetail(){ document.getElementById('detail').classList.remove('on'); var fb=document.getElementById('fixedBack'); if(fb) fb.classList.remove('on'); }

// ESC 로 닫기
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ closeDetail(); hidePreview(); document.getElementById('searchResults').style.display='none'; } });

// ── 도시 검색 ──
function setupSearch(map){
  var input=document.getElementById('citySearch'), box=document.getElementById('searchResults');
  if(!input) return;
  var keys=(window.ORDER||Object.keys(CITY)).filter(function(k){return CITY[k]&&CITY[k].nm;});
  function render(list){
    if(!list.length){ box.innerHTML='<div class="sr-none">검색 결과가 없어요</div>'; box.style.display='block'; return; }
    box.innerHTML=list.map(function(k){var c=CITY[k];var reg=(c.region||'').replace(/^[^\s]+\s*/,'');
      var rich=(c.spots&&c.spots.length)||(c.days&&c.days.length);
      return '<div class="sr-item" data-k="'+k+'"><b>'+esc(c.nm)+'</b>'+(rich?' <span class="sr-tag">가이드</span>':'')+'<span class="sr-reg">'+esc(reg)+'</span></div>';
    }).join('');
    box.style.display='block';
    box.querySelectorAll('.sr-item').forEach(function(el){
      el.addEventListener('click',function(){
        var k=el.getAttribute('data-k'), co=COORDS[k];
        box.style.display='none'; input.value=CITY[k].nm;
        if(co && map){ map.flyTo(co, 10, {duration:.7}); setTimeout(function(){ showPreview(k); }, 750); }
        else { showPreview(k); }
      });
    });
  }
  input.addEventListener('input',function(){
    var q=this.value.trim();
    if(!q){ box.style.display='none'; return; }
    // 앞에서부터 일치 우선, 그다음 포함
    var starts=[], has=[];
    keys.forEach(function(k){var nm=CITY[k].nm; if(nm.indexOf(q)===0)starts.push(k); else if(nm.indexOf(q)>0)has.push(k);});
    render(starts.concat(has).slice(0,10));
  });
  input.addEventListener('focus',function(){ if(this.value.trim()) box.style.display='block'; });
  document.addEventListener('click',function(e){ if(!e.target.closest('.search-box')) box.style.display='none'; });
}
