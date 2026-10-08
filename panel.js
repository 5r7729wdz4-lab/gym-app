'use strict';
/* ============================================================
   ПАНЕЛЬ ЗАЛА — логика
   ============================================================ */

var $ = function(s){ return document.querySelector(s) };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)) };
var DAYS_ID = ['A','B','C'];
var DAYNAME = {A:'Верх', B:'Спина и руки', C:'Ноги и грудь'};

/* ---------- хранилище ---------- */
/* дата в локальном времени: toISOString даёт UTC и сдвигает сутки после полуночи */
function ldate(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function today(){ return ldate(new Date()) }
function dkey(d){ return 'gym_done_'+d+'_'+today() }
function wkey(id){ return 'gym_w_'+id+'_'+today() }
function load(k,dflt){ var v=localStorage.getItem(k); return v===null?dflt:v }
function save(k,v){ localStorage.setItem(k,v) }

var state = { day: load('gym_day','A'), page:'today', done:{}, sheet:-1 };

var SS = JSON.parse(load('gym_sessions','[]'));
function saveSS(){ save('gym_sessions', JSON.stringify(SS)) }

function fmt(s){ return Math.floor(s/60)+':'+String(s%60).padStart(2,'0') }
function plural(n){ var m=n%10, h=n%100; if(h>=11&&h<=14)return 'подходов'; if(m===1)return 'подход'; if(m>=2&&m<=4)return 'подхода'; return 'подходов' }
function buzz(p){ if(navigator.vibrate) navigator.vibrate(p||[80,50,80]) }
var toastT=null;
function toast(m){
  var t=$('#toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('on') },2400);
}

/* ---------- календарь недель ---------- */
function shiftDays(iso,n){
  var d=new Date(iso+'T12:00'); d.setDate(d.getDate()+n);
  return ldate(d);
}
function wkFromDate(iso){
  var a=new Date(cycleStart()+'T12:00'), b=new Date(iso+'T12:00');
  return Math.max(1,Math.floor((b-a)/86400000/7)+1);
}
/* Один раз приводим старые записи к календарю: неделя считается от даты,
   а не от счётчика нажатий. Старт цикла выводим из самой ранней тренировки. */
function migrate(){
  if(load('gym_v16','0')==='1') return;
  var dates=SS.map(function(x){ return x.d }).filter(Boolean).sort();
  save('gym_start',dates.length?dates[0]:today());
  SS.forEach(function(x){ if(x.d) x.wk=wkFromDate(x.d) });
  saveSS();
  save('gym_v16','1');
}
function cycleStart(){
  var s=load('gym_start',null);
  if(!s){ s=today(); save('gym_start',s) }
  return s;
}
function curWeek(){
  var a=new Date(cycleStart()+'T12:00'), b=new Date();
  return Math.max(1, Math.floor((b-a)/86400000/7)+1);
}
function setWeekNow(n){
  n=Math.max(1,Math.min(60,n|0));
  save('gym_start',shiftDays(today(),-(n-1)*7));
  SS.forEach(function(x){ if(x.d) x.wk=wkFromDate(x.d) });
  saveSS();
  renderDay(); runPaints(); renderStats();
  toast('Неделя '+n);
}
function weekRange(wk){
  var s=new Date(cycleStart()+'T12:00'); s.setDate(s.getDate()+(wk-1)*7);
  var e=new Date(s); e.setDate(e.getDate()+6);
  var f=function(d){ return d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0') };
  return f(s)+' – '+f(e);
}
function weekDone(wk){
  var n=0;
  DAYS_ID.forEach(function(d){
    if(SS.some(function(x){ return +x.wk===wk && x.day===d && x.ex && Object.keys(x.ex).length })) n++;
  });
  return n;
}
function weekSets(wk){
  var n=0;
  SS.forEach(function(x){
    if(+x.wk!==wk) return;
    Object.keys(x.ex||{}).forEach(function(k){ n+=x.ex[k][1] });
  });
  return n;
}

/* ---------- медиа упражнения ---------- */
function media(id){
  var e=EX[id];
  return '<div class="media">'+(SVG[e.svg]||'')+'</div>';
}
/* видео показываем только в шторке — там светлая подложка, клип выглядит родным */
function clip(id){
  var e=EX[id];
  if(!IMG[e.svg]) return '';
  return '<div class="clip"><video muted loop playsinline autoplay preload="auto" data-vid="'+e.svg+'"></video></div>';
}
var vidObs=null;
function hydrate(){
  if(vidObs) vidObs.disconnect();
  vidObs=new IntersectionObserver(function(es){
    es.forEach(function(en){
      var v=en.target;
      if(en.isIntersecting){
        if(!v.src&&v.dataset.b64) v.src=v.dataset.b64;
        var p=v.play(); if(p&&p.catch) p.catch(function(){});
      }else v.pause();
    });
  },{threshold:.2});
  $$('video[data-vid]').forEach(function(v){
    var b64=IMG[v.dataset.vid];
    if(b64){
      var bin=atob(b64.split(',')[1]), arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      v.dataset.b64=URL.createObjectURL(new Blob([arr],{type:'video/mp4'}));
      v.addEventListener('loadeddata',function(){ v.classList.add('ready') },{once:true});
      v.addEventListener('error',function(){ v.remove() },{once:true});
    }
    vidObs.observe(v);
  });
}

/* ---------- оценка длительности ---------- */
function estMin(d){
  var sec=0;
  DAYS[d].list.forEach(function(id){
    var e=EX[id], r=e.reps, work;
    if(r.indexOf('сек')>-1) work=parseInt(r)||40;
    else work=(parseInt(r)||10)*4;
    sec+=e.sets*(work+e.rest+20);
  });
  return Math.max(35,Math.min(110,Math.round(sec/60/5)*5));
}

/* ---------- шапка ---------- */
function renderHead(){
  var h=new Date().getHours();
  var g = h<5?'Доброй ночи': h<12?'Доброе утро': h<18?'Добрый день':'Добрый вечер';
  $('#greet').textContent=g;
  var d=new Date();
  var wd=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][d.getDay()];
  var dd=String(d.getDate()).padStart(2,'0'), mm=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][d.getMonth()];
  var wk=curWeek(), n=weekDone(wk);

  $('#dline').innerHTML='версия 16 · '+wd+', '+dd+' '+mm+' · <b>неделя '+wk+' из 8</b>';
  $('#orbNum').textContent=wk;
  $('#orbLbl').textContent='неделя';
  var C=2*Math.PI*46;
  $('#orbArc').setAttribute('stroke-dasharray',C.toFixed(1));
  $('#orbArc').setAttribute('stroke-dashoffset',(C*(1-n/3)).toFixed(1));
}

/* ---------- день ---------- */
function renderDay(){
  var d=DAYS[state.day];

  $$('#daysel button').forEach(function(b){ b.classList.toggle('on',b.dataset.day===state.day) });

  $('#dTag').textContent='День '+state.day+' · '+weekRange(curWeek());
  $('#dTitle').textContent=DAYS[state.day].title.split('—')[1].trim();
  $('#dDesc').textContent=d.desc;
  $('#dMets').innerHTML=
    '<div class="met"><b class="num">'+d.list.length+'</b><span>упражнений</span></div>'+
    '<div class="met"><b class="num">'+estMin(state.day)+'</b><span>минут</span></div>'+
    '<div class="met"><b class="num">'+KCAL[state.day]+'</b><span>ккал</span></div>';
  $('#ctaMin').textContent=estMin(state.day)+' мин';
  $('#exCount').textContent=d.list.length+' упражнений';

  $('#exlist').innerHTML=d.list.map(function(id){ return exCard(id) }).join('');

  var ns=daySets();
  var btn=$('#doneBtn');
  if(ns>0){ btn.className='cta hit'; btn.textContent='Закрыто: '+ns+' '+plural(ns)+' · нажми для отмены' }
  else { btn.className='cta alt'; btn.textContent='Отметить выполненной' }
  $('#ctaTxt').textContent=ns>0?('Продолжить тренировку'):'Начать тренировку';

  state.done=JSON.parse(load(dkey(state.day),'{}'));
  paintSets();
  hydrate();
}

function exCard(id){
  var e=EX[id];
  var dots='';
  for(var i=1;i<=e.sets;i++) dots+='<button class="sdot" data-ex="'+id+'" data-s="'+i+'" onclick="tap(this)">'+i+'</button>';
  var w=e.noW?'':
    '<div class="wrow"><label>Вес</label>'+
    '<input type="number" inputmode="decimal" step="2.5" data-w="'+id+'" value="'+load(wkey(id),'')+'" oninput="saveW(this)" placeholder="—">'+
    '<span class="pv">'+prevW(id)+'</span></div>';
  return '<div class="ex" id="ex_'+id+'">'+
    '<div class="ex-top">'+
      '<div class="thumb">'+media(id)+'</div>'+
      '<div class="ex-b"><span class="tag">'+e.tag+'</span><h3>'+e.name+'</h3>'+
      '<div class="sub">'+e.sub+'</div><div class="mus">'+e.mus+'</div></div>'+
    '</div>'+
    '<div class="ex-row">'+
      '<span class="pill num">'+e.sets+' × '+e.reps+'</span>'+
      '<button class="pill rest" onclick="tStart('+e.rest+')"><svg class="ic s14" style="display:inline-block;vertical-align:-2px;margin-right:4px"><use href="#i-clock"/></svg>'+e.rest+' сек</button>'+
    '</div>'+
    '<div class="sets"><span class="lb">Сеты</span>'+dots+'</div>'+w+
    '<div class="ex-foot"><button class="more-btn" onclick="openSheet(\''+id+'\')"><svg class="ic s16"><use href="#i-book"/></svg>Подробнее о технике</button></div>'+
  '</div>';
}
function prevW(id){
  for(var i=1;i<60;i++){
    var d=new Date(); d.setDate(d.getDate()-i);
    var v=localStorage.getItem('gym_w_'+id+'_'+ldate(d));
    if(v) return 'прошлый '+v;
  }
  return '';
}
function paintSets(){
  $$('.sdot').forEach(function(el){
    el.classList.toggle('on',!!state.done[el.dataset.ex+'_'+el.dataset.s]);
  });
}
function tap(el){
  var k=el.dataset.ex+'_'+el.dataset.s;
  if(state.done[k]) delete state.done[k];
  else { state.done[k]=1; tStart(EX[el.dataset.ex].rest) }
  save(dkey(state.day), JSON.stringify(state.done));
  paintSets(); syncSession(); runPaints();
  if(state.done[k]) buzz(30);
}
function saveW(el){ save(wkey(el.dataset.w), el.value) }
function daySets(){
  var n=0;
  DAYS[state.day].list.forEach(function(id){
    for(var i=1;i<=EX[id].sets;i++) if(state.done[id+'_'+i]) n++;
  });
  return n;
}

/* ---------- прогресс сессии ---------- */
function runT0(){ return +load('gym_run_t',0)||Date.now() }
function recObj(){
  var t=today();
  var rec={d:t, day:state.day, wk:curWeek(), kcal:KCAL[state.day],
           min:Math.max(1,Math.round((Date.now()-runT0())/60000)), ex:{}};
  DAYS[state.day].list.forEach(function(id){
    var w=load(wkey(id),''), sd=0;
    for(var i=1;i<=EX[id].sets;i++) if(state.done[id+'_'+i]) sd++;
    if(w||sd) rec.ex[id]=[+w||0, sd, EX[id].sets];
  });
  return rec;
}
function syncSession(){
  var t=today(), k='gym_session_'+t+'_'+state.day, ns=daySets();
  if(ns>0){
    var isNew=load(k,'')!=='1';
    SS=SS.filter(function(s){ return !(s.d===t&&s.day===state.day) });
    SS.push(recObj()); saveSS(); save(k,'1');
    if(isNew) toast('Записал: '+ns+' '+plural(ns));
  }else if(load(k,'')==='1'){
    SS=SS.filter(function(s){ return !(s.d===t&&s.day===state.day) });
    saveSS(); localStorage.removeItem(k);
  }
  runPaints();
}
function runPaints(){
  var ns=daySets(), btn=$('#doneBtn');
  if(ns>0){ btn.className='cta hit'; btn.textContent='Закрыто: '+ns+' '+plural(ns)+' · нажми для отмены' }
  else { btn.className='cta alt'; btn.textContent='Отметить выполненной' }
  $('#ctaTxt').textContent=ns>0?'Продолжить тренировку':'Начать тренировку';
  renderHead(); renderWeek();
}
function markDone(){
  var t=today(), k='gym_session_'+t+'_'+state.day;
  if(daySets()>0){
    state.done={}; save(dkey(state.day),'{}');
    SS=SS.filter(function(s){ return !(s.d===t&&s.day===state.day) });
    saveSS(); localStorage.removeItem(k);
    localStorage.removeItem('gym_run_t');
    toast('Отметка дня '+state.day+' снята');
    renderDay(); runPaints();
    return;
  }
  SS=SS.filter(function(s){ return !(s.d===t&&s.day===state.day) });
  SS.push(recObj()); saveSS(); save(k,'1'); save('gym_run_t',Date.now());
  toast('День '+state.day+' засчитан');
  renderDay(); runPaints();
}

/* ---------- неделя ---------- */
function renderWeek(){
  var wk=curWeek(), n=weekDone(wk), sets=weekSets(wk);
  var rows='';
  DAYS_ID.forEach(function(d){
    var line='<span class="rl">'+d+'</span>';
    for(var w=1;w<=8;w++){
      var has=SS.some(function(x){ return +x.wk===w && x.day===d && x.ex && Object.keys(x.ex).length });
      line+='<i class="'+(has?'full':'')+(w===wk?' now':'')+'" title="неделя '+w+', день '+d+'"></i>';
    }
    rows+=line;
  });
  $('#wkDots').innerHTML=rows+
    '<div class="wklegend" style="grid-column:2 / span 8"><span>неделя 1</span><span>'+wk+' сейчас</span><span>неделя 8</span></div>';

  var planned=0, doneTotal=0;
  for(var w=1;w<=wk;w++){ planned+=3; doneTotal+=weekDone(w) }
  $('#wkBar').style.width=Math.min(100,(doneTotal/planned)*100)+'%';
  $('#wkMsg').textContent = n>=3
    ? 'Неделя закрыта: '+sets+' подходов за 7 дней.'
    : weekRange(wk)+' · тренировок закрыто '+n+' из 3 · подходов '+sets;
  $('#wkSets').textContent=sets;
  $('#wkIdx').textContent=wk;
  $('#wkPct').textContent=cyclePct()+'%';
}
function shiftWeek(d){ setWeekNow(curWeek()+d) }
function cyclePct(){
  var wk=curWeek(), planned=0, done=0;
  for(var w=1;w<=wk;w++){ planned+=3; done+=weekDone(w) }
  return Math.round(Math.min(100,(done/planned)*100));
}
function resetCycle(){
  if(!confirm('Начать цикл заново сегодня? История сохранится, но неделя 1 начнётся с этого дня.')) return;
  save('gym_start',today()); save('gym_week','1');
  for(var i=localStorage.length-1;i>=0;i--){
    var k=localStorage.key(i);
    if(k.indexOf('gym_session_')===0) localStorage.removeItem(k);
  }
  renderDay(); runPaints(); renderStats();
  toast('Цикл с нуля — неделя 1');
}

/* ---------- шторка техники ---------- */
function openSheet(id){
  var e=EX[id];
  state.sheet=id;
  $('#shThumb').innerHTML=media(id);
  $('#shName').textContent=e.name;
  $('#shMus').textContent=e.mus+' · '+e.sets+' × '+e.reps+' · отдых '+e.rest+' сек';
  var h=clip(id);
  h+='<div class="grp"><div class="lb">Как выполнять</div><ol class="steps">'+
     e.how.map(function(x){ return '<li>'+x+'</li>' }).join('')+'</ol></div>';
  if(e.err&&e.err.length){
    h+='<div class="grp"><div class="lb">Частые ошибки</div><ul class="mist">'+
       e.err.map(function(x){ return '<li>'+x+'</li>' }).join('')+'</ul></div>';
  }
  if(e.alt&&e.alt.length){
    h+='<div class="grp"><div class="lb">Замена, если тренажёр занят</div><div class="swaps">'+
       e.alt.map(function(a){ return '<div><b>'+a[0]+'</b><span>'+a[1]+'</span></div>' }).join('')+'</div></div>';
  }
  h+='<div class="grp"><div class="lb">Прогрессия</div><p style="font-size:14px;color:var(--fg2);line-height:1.55">Дошёл до верхней границы повторов во всех подходах — добавь вес: 2.5 кг для верхних групп, 5 кг для ног. Останавливайся за 1–2 повтора до отказа. Опускай вес за 2–3 секунды.</p></div>';
  $('#shBody').innerHTML=h;
  $('#sheet').classList.add('on'); $('#scrim').classList.add('on');
  document.body.classList.add('lock');
  hydrate();
}
function closeSheet(){
  $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on');
  document.body.classList.remove('lock');
}
function shPrev(){
  var L=DAYS[state.day].list, i=L.indexOf(state.sheet);
  openSheet(L[(i-1+L.length)%L.length]);
}

/* ---------- таймер отдыха ---------- */
var T={end:0,int:null,sec:0,onEnd:null};
function tStart(sec,onEnd){
  T.end=Date.now()+sec*1000; T.sec=sec; T.onEnd=onEnd||T.onEnd;
  clearInterval(T.int); T.int=setInterval(tick,250);
  $('#timer').classList.add('on'); tick();
}
function tick(){
  var left=T.end?Math.max(0,Math.round((T.end-Date.now())/1000)):0;
  $('#tNum').textContent=fmt(left||T.sec);
  $('#fcRestN').textContent=fmt(left||T.sec);
  $('#timer').classList.toggle('run',left>0);
  $('#fcRest').classList.toggle('on',left>0&&run.on);
  if(left>0&&left<=3) buzz(25);
  if(T.end&&left<=0){
    clearInterval(T.int); T.int=null; T.end=0;
    $('#timer').classList.remove('on','run');
    $('#fcRest').classList.remove('on');
    buzz([90,60,90]);
    var cb=T.onEnd; T.onEnd=null;
    if(cb) cb();
    else toast('Отдых окончен');
  }
}
function tAdd(n){
  if(!T.end){ T.end=Date.now(); }
  T.end+=n*1000; T.sec+=n; tick();
}
function tStop(){
  clearInterval(T.int); T.int=null; T.end=0;
  $('#timer').classList.remove('on','run');
  $('#fcRest').classList.remove('on');
}
document.addEventListener('visibilitychange',function(){ if(!document.hidden&&T.end) tick() });

/* ---------- режим тренировки ---------- */
var run={on:false,i:0,t0:0,tick:null,auto:false};
function runStart(){
  var d=DAYS[state.day];
  run.on=true; run.i=0; run.auto=false;
  save('gym_run_t',Date.now());
  document.body.classList.add('lock');
  $('#focus').classList.add('on');
  $('#fcName').textContent=DAYNAME[state.day];
  $('#fcTrack').innerHTML=d.list.map(fcard).join('');
  clearInterval(run.tick); run.tick=setInterval(runClock,250);
  runGo(0); runClock(); hydrate();
}
function fcard(id){
  var e=EX[id], dots='';
  for(var i=1;i<=e.sets;i++) dots+='<button class="sdot" data-ex="'+id+'" data-s="'+i+'" onclick="runTap(this)">'+i+'</button>';
  var w=e.noW?'':'<div class="wrow"><label>Вес</label><input type="number" inputmode="decimal" step="2.5" data-w="'+id+'" value="'+load(wkey(id),'')+'" oninput="saveW(this)" placeholder="—"><span class="pv">'+prevW(id)+'</span></div>';
  return '<div class="fcard">'+
    '<div class="vh">'+media(id)+'</div>'+
    '<div class="vb"><span class="tg">'+e.tag+'</span><h2>'+e.name+'</h2>'+
    '<div class="sb">'+e.sub+'</div><div class="ms">'+e.mus+'</div>'+
    '<div class="pr"><b class="num">'+e.sets+' × '+e.reps+'</b><span>отдых '+e.rest+' сек</span></div>'+
    '<div class="sets">'+dots+'</div>'+w+
    '<div class="fbtns">'+
      '<button class="btn" style="flex:1" onclick="openSheet(\''+id+'\')"><svg class="ic s16" style="display:inline-block;vertical-align:-3px;margin-right:5px"><use href="#i-book"/></svg>Техника</button>'+
      '<button class="btn" style="flex:1" onclick="tStart('+e.rest+')"><svg class="ic s16" style="display:inline-block;vertical-align:-3px;margin-right:5px"><use href="#i-clock"/></svg>Отдых</button>'+
    '</div></div></div>';
}
function runGo(i){
  var L=DAYS[state.day].list.length;
  run.i=Math.max(0,Math.min(i,L-1));
  var el=$('#fcTrack .fcard:nth-child('+(run.i+1)+')');
  var tr=$('#fcTrack');
  if(el&&tr) tr.scrollTo({left:el.offsetLeft-tr.offsetLeft-18,behavior:'smooth'});
  var st='';
  DAYS[state.day].list.forEach(function(id,idx){
    var n=0; for(var i2=1;i2<=EX[id].sets;i2++) if(state.done[id+'_'+i2]) n++;
    var c=idx===run.i?'cur':'';
    st+='<i class="'+c+(n===EX[id].sets?' on':n?' part':'')+'"></i>';
  });
  $('#fcSteps').innerHTML=st;
  $('#fcMain').textContent = run.i>=L-1 ? 'Завершить тренировку' : 'Дальше';
  $$('#fcTrack .sdot').forEach(function(el){
    el.classList.toggle('on',!!state.done[el.dataset.ex+'_'+el.dataset.s]);
  });
}
function runNav(k){ runGo(run.i+k) }
function runSkip(){ runGo(run.i+1); toast('Пропущено') }
function runNext(){
  if(run.i>=DAYS[state.day].list.length-1){ runStop(true); return }
  runGo(run.i+1);
}
function runTap(el){
  var id=el.dataset.ex, s=+el.dataset.s, k=id+'_'+s;
  if(state.done[k]) delete state.done[k];
  else{
    state.done[k]=1;
    var last=(s===EX[id].sets);
    if(last){
      syncSession();
      var all=true; for(var i=1;i<=EX[id].sets;i++) if(!state.done[id+'_'+i]) all=false;
      if(all){
        run.auto=true;
        toast('Упражнение закрыто');
        tStart(EX[id].rest, function(){
          run.auto=false;
          if(run.i<DAYS[state.day].list.length-1){ runGo(run.i+1); tStart(90) }
        });
        buzz([70,40,70]);
        runGo(run.i); return;
      }
    }
    tStart(EX[id].rest);
    buzz(30);
  }
  save(dkey(state.day), JSON.stringify(state.done));
  runGo(run.i); runPaints();
}
function runClock(){
  if(!run.on) return;
  var el=Math.floor((Date.now()-run.t0)/1000);
  if(el<0||el>35999) el=0;
  $('#fcTime').textContent=fmt(el);
  if(T.end) tick();
}
function runStop(finish){
  clearInterval(run.tick); run.tick=null;
  run.on=false; run.auto=false;
  document.body.classList.remove('lock');
  $('#focus').classList.remove('on');
  tStop();
  if(finish){ syncSession(); toast('Тренировка закрыта'); buzz([90,60,90]) }
  renderDay();
}

/* ---------- прогресс ---------- */
function addWeight(){
  var v=parseFloat($('#wIn').value);
  if(!v||v<35||v>200){ toast('Введи вес от 35 до 200 кг'); return }
  var w=JSON.parse(load('gym_weights','[]'));
  var t=today();
  w=w.filter(function(e){ return e.d!==t });
  w.push({d:t,v:v});
  w.sort(function(a,b){ return a.d<b.d?-1:1 });
  save('gym_weights',JSON.stringify(w));
  $('#wIn').value='';
  renderStats(); toast('Вес записан');
}
function renderStats(){
  var w=JSON.parse(load('gym_weights','[]'));
  $('#mTrain').textContent=SS.length;
  var n=0, now=new Date();
  SS.forEach(function(s){ var d=new Date(s.d+'T12:00'); if((now-d)/86400000<7) n++ });
  $('#mWeek').textContent=n;
  var mins=SS.filter(function(s){ return s.min }).map(function(s){ return s.min });
  $('#mAvg').textContent=mins.length?Math.round(mins.reduce(function(a,b){return a+b},0)/mins.length)+'′':'—';

  $('#wDelta').textContent = w.length>=2
    ? ((w[w.length-1].v-w[0].v>0?'+':'')+(w[w.length-1].v-w[0].v).toFixed(1)+' кг')
    : '—';
  $('#wlist').innerHTML = w.slice(-8).reverse().map(function(e){
    return '<div class="row"><div class="k">'+fdate(e.d)+'</div><div class="v num" style="color:var(--fg)">'+e.v.toFixed(1)+' кг</div></div>';
  }).join('');
  drawChart(w);
  dataStatus();
}
function fdate(iso){
  var d=new Date(iso+'T12:00');
  return d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0');
}
function drawChart(w){
  var svg=$('#chart');
  if(w.length<2){
    svg.style.height='46px';
    svg.innerHTML='<text x="150" y="20" text-anchor="middle" fill="#54545E" font-size="12.5" font-family="Outfit,sans-serif">График появится после двух записей</text>';
    return;
  }
  svg.style.height='';
  var vs=w.slice(-30).map(function(e){ return e.v });
  var mn=Math.min.apply(null,vs)-.6, mx=Math.max.apply(null,vs)+.6;
  var pts=vs.map(function(v,i){ return [12+i*(276/(vs.length-1)), 132-(v-mn)/(mx-mn)*118] });
  var path=pts.map(function(p,i){ return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1) }).join(' ');
  svg.innerHTML='<defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">'+
    '<stop offset="0" stop-color="#7C5CFF" stop-opacity=".30"/><stop offset="1" stop-color="#7C5CFF" stop-opacity="0"/></linearGradient></defs>'+
    '<path d="'+path+' L '+pts[pts.length-1][0].toFixed(1)+' 138 L '+pts[0][0].toFixed(1)+' 138 Z" fill="url(#gr)"/>'+
    '<path d="'+path+'" fill="none" stroke="#F4F4F6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+
    pts.map(function(p){ return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.6" fill="#7C5CFF"/>' }).join('');
}
function dataStatus(){
  var nw=0;
  for(var i=0;i<localStorage.length;i++) if(localStorage.key(i).indexOf('gym_w_')===0) nw++;
  $('#dataStatus').textContent='Тренировок: '+SS.length+' · взвешиваний: '+JSON.parse(load('gym_weights','[]')).length+' · записей весов: '+nw;
}

/* ---------- бэкап ---------- */
function buildBackup(){
  var kv={};
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(k.indexOf('gym_')===0) kv[k]=localStorage.getItem(k);
  }
  return {app:'gym',v:2,made:new Date().toISOString(),sessions:SS,weights:JSON.parse(load('gym_weights','[]')),kv:kv};
}
function applyBackup(o){
  if(!o||o.app!=='gym'||!Array.isArray(o.sessions)) throw new Error('bad');
  o.sessions.forEach(function(s){ if(!SS.some(function(x){ return x.d===s.d&&x.day===s.day })) SS.push(s) });
  SS.sort(function(a,b){ return a.d<b.d?-1:1 }); saveSS();
  var w=JSON.parse(load('gym_weights','[]'));
  (o.weights||[]).forEach(function(x){ if(!w.some(function(y){ return y.d===x.d })) w.push(x) });
  w.sort(function(a,b){ return a.d<b.d?-1:1 });
  save('gym_weights',JSON.stringify(w));
  Object.keys(o.kv||{}).forEach(function(k){ save(k,o.kv[k]) });
}
function exportData(){
  try{
    var b=new Blob([JSON.stringify(buildBackup())],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download='zal-'+today()+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Копия сохранена');
  }catch(e){ toast('Не получилось сохранить') }
}
function importData(inp){
  var f=inp.files&&inp.files[0]; if(!f) return;
  var r=new FileReader();
  r.onload=function(){
    try{ applyBackup(JSON.parse(r.result)); renderDay(); renderStats(); toast('Данные восстановлены') }
    catch(e){ toast('Файл не подошёл') }
  };
  r.readAsText(f); inp.value='';
}
function clearToday(){
  var t=today();
  DAYS_ID.forEach(function(d){ localStorage.removeItem('gym_session_'+t+'_'+d) });
  localStorage.removeItem(dkey(state.day));
  localStorage.removeItem('gym_run_t');
  SS=SS.filter(function(s){ return s.d!==t }); saveSS();
  state.done={}; save(dkey(state.day),'{}');
  renderDay(); runPaints(); renderStats();
  toast('Отметки за сегодня очищены');
}
function wipe(){
  if(!confirm('Удалить всю историю: веса, отметки, график?')) return;
  localStorage.clear(); SS=[]; state.done={};
  state.day='A'; save('gym_day','A');
  cycleStart();
  renderDay(); runPaints(); renderStats();
  toast('Прогресс сброшен');
}

/* ---------- правила и история ---------- */
function renderRules(){
  $('#rules').innerHTML=RULES.map(function(r,i){
    return '<div class="tile"><div style="display:flex;gap:12px;align-items:flex-start">'+
      '<span class="num" style="font-size:13px;color:var(--fg3);font-weight:700;flex-shrink:0;padding-top:2px">'+String(i+1).padStart(2,'0')+'</span>'+
      '<div style="min-width:0"><h3>'+r[0]+'</h3><p>'+r[1]+'</p></div></div></div>';
  }).join('');
}
function renderHistory(){
  if(!SS.length){
    $('#histSum').textContent='Пока пусто';
    $('#histSub').textContent='Закрой хотя бы один подход — и тренировка появится здесь.';
    $('#prList').innerHTML='<p style="font-size:13px;color:var(--fg3)">Записывай веса в упражнениях — тут появится рост.</p>';
    $('#histList').innerHTML='';
    return;
  }
  var kcal=SS.reduce(function(a,s){ return a+(s.kcal||0) },0);
  var mins=SS.filter(function(s){ return s.min });
  var sets=0;
  SS.forEach(function(s){ Object.keys(s.ex||{}).forEach(function(k){ sets+=s.ex[k][1] }) });
  $('#histSum').textContent=SS.length+' '+plural(SS.length);
  $('#histSub').textContent='Подходов: '+sets+' · сожжено около '+kcal+' ккал'+
    (mins.length?' · в среднем '+Math.round(mins.reduce(function(a,s){return a+s.min},0)/mins.length)+' мин':'');

  var rows='';
  Object.keys(EX).forEach(function(id){
    var pts=SS.filter(function(s){ return s.ex&&s.ex[id]&&s.ex[id][0]>0 });
    if(pts.length<1) return;
    var last=pts[pts.length-1].ex[id][0];
    var best=pts.reduce(function(m,p){ return Math.max(m,p.ex[id][0]) },0);
    var prev=pts.length>1?pts[pts.length-2].ex[id][0]:last;
    var ar=last>prev?'вверх':last<prev?'вниз':'—';
    rows+='<div class="row"><div class="k" style="width:auto;flex:1">'+EX[id].name+'</div>'+
      '<div class="v num" style="text-align:right;flex-shrink:0;color:var(--fg)">'+last+' кг<small style="color:var(--fg3)">рекорд '+best+' · '+ar+'</small></div></div>';
  });
  $('#prList').innerHTML='<div class="tl">'+rows+'</div>';

  $('#histList').innerHTML='<div class="tl">'+SS.slice().sort(function(a,b){ return a.d<b.d?1:-1 }).slice(0,20).map(function(s){
    var st=0; Object.keys(s.ex||{}).forEach(function(k){ st+=s.ex[k][1] });
    return '<div class="row"><div class="k" style="width:auto;flex:1">'+fdate(s.d)+' · '+DAYNAME[s.day]+
      '<small style="color:var(--fg3);display:block;margin-top:3px">неделя '+s.wk+(s.min?' · '+s.min+' мин':'')+'</small></div>'+
      '<div class="v num" style="text-align:right;flex-shrink:0;color:var(--fg)">'+st+' подх.</div></div>';
  }).join('')+'</div>';
}

/* ---------- навигация ---------- */
function go(page){
  state.page=page;
  $$('#nb button').forEach(function(b){ b.classList.toggle('on',b.dataset.page===page) });
  $$('.page').forEach(function(p){ p.classList.remove('on') });
  $('#p-'+page).classList.add('on');
  window.scrollTo(0,0);
  if(page==='progress') renderStats();
  if(page==='history') renderHistory();
}
$$('#nb button').forEach(function(b){
  b.addEventListener('click',function(){ go(b.dataset.page) });
});
$$('#daysel button').forEach(function(b){
  b.addEventListener('click',function(){
    state.day=b.dataset.day; save('gym_day',state.day);
    state.done=JSON.parse(load(dkey(state.day),'{}'));
    renderDay(); runPaints();
  });
});
$('#scrim').addEventListener('click',closeSheet);
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if($('#sheet').classList.contains('on')) closeSheet();
    else if(run.on) runStop(false);
  }
});

/* ---------- старт ---------- */
migrate();
state.done=JSON.parse(load(dkey(state.day),'{}'));
renderHead();
renderDay();
renderWeek();
renderRules();
renderStats();
window.addEventListener('resize',function(){ if(!run.on) return; runGo(run.i) });