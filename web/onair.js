/* Radio-Dashboard – Sender & Sendeverlauf: Sendeverlauf (gespielte Titel aus NowPlaying.txt) und Warnung bei Stille / Stream-Problemen.
   Wird vom Server (server.py) nach der Anmeldung geladen. */
(async function(){
"use strict";
if(!location.protocol.startsWith("http")) return;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pad=n=>String(n).padStart(2,"0");
const hm=ts=>{ const d=new Date(ts*1000); return pad(d.getHours())+":"+pad(d.getMinutes()); };
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
const getJSON=async p=>{ const r=await fetch(p); if(r.status===401){ location.href="/login"; throw new Error("401"); } if(!r.ok) throw new Error(p+" "+r.status); return r.json(); };

/* ---------- Styles ---------- */
const css=document.createElement("style");
css.textContent=`
#airBanner{position:fixed;left:0;right:0;bottom:0;z-index:88;padding:14px 20px;display:none;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px 16px;font-size:20px;font-weight:800;color:#fff;background:#c0392b;animation:airpulse 1.6s infinite}
#airBanner.on{display:flex}#airBanner button{font-size:14px;padding:6px 12px}#airBanner small{display:block;font-size:13px;font-weight:400;opacity:.9}
@keyframes airpulse{0%,100%{background:#c0392b}50%{background:#8e1f14}}
.plbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.plbar input[type=search]{flex:1;min-width:160px}
.pl td{vertical-align:top}.pl .tm{text-align:left;font-variant-numeric:tabular-nums;color:var(--mut)}
.pl .tn{white-space:normal}.pl .hint{text-align:left;color:var(--mut);white-space:normal}
.pl tr.rep .hint{color:#b45309;font-weight:700}.pl tr.ad td{color:var(--mut);font-style:italic}
.pl tr.cur .tn{font-weight:800}.pl .live{display:inline-block;background:var(--acc);color:#fff;border-radius:6px;padding:0 6px;font-size:11px;font-weight:700;margin-left:6px;font-style:normal}
`;
document.head.appendChild(css);

/* ---------- Warnung: Stille in der Sendesoftware / Stream-Probleme ---------- */
const MAX_AGE=2*3600;   // länger als 2 Std. ohne Titelwechsel = Sendung beendet, keine Warnung mehr
document.body.insertAdjacentHTML("beforeend",'<div id="airBanner" role="alert"></div>');
let ST=null, off=0, snooze=0, lastBeep=0;
async function pollAir(){
  try{ ST=await getJSON("/api/nowplaying"); off=ST.now-Date.now()/1000; }catch(e){}
  airTick();
}
function airProblems(){
  if(!ST) return [];
  const now=Date.now()/1000+off, out=[];
  const quiet=now-(ST.changed||0);
  if(ST.ok&&ST.deadair>0&&ST.changed>=ST.started&&quiet>ST.deadair*60&&quiet<MAX_AGE&&ls.get("rd_air_ok")!==String(ST.changed))
    out.push({k:"dead",t:"🔇 Seit "+Math.floor(quiet/60)+" Min. kein Titelwechsel in der Sendesoftware – läuft der Sender noch?",s:"Letzter Titel: "+(ST.song||"–")+" (seit "+hm(ST.changed)+" Uhr)"});
  const s=ST.stream||{};
  if(s.type==="none") return out;
  if(s.fails>=3) out.push({k:"net",t:"📡 Stream-Status seit ca. "+s.fails+" Min. nicht abrufbar",s:"Internetverbindung oder die Stream-Adresse in den Einstellungen prüfen"});
  else if(s.ok&&s.online===false&&now-s.checked<180)
    out.push({k:"stream",t:"📡 Stream offline – am Streaming-Server kommt kein Signal an!",s:"Encoder bzw. Sendesoftware prüfen"});
  else if(s.ok&&s.ends&&now-s.checked<180&&now-s.ends>180)
    out.push({k:"stream",t:"📡 laut.fm meldet seit "+Math.floor((now-s.ends)/60)+" Min. keinen neuen Titel – Stream prüfen!",s:"Zuletzt bei laut.fm: "+(s.title||"–")});
  return out;
}
function airTick(){
  const now=Date.now()/1000, list=snooze>now?[]:airProblems(), bn=$("airBanner");
  const key=list.map(p=>p.t+"|"+p.s).join("§");
  if(bn.dataset.k!==key){
    bn.dataset.k=key; bn.classList.toggle("on",list.length>0); bn.innerHTML="";
    list.forEach(p=>{ const d=document.createElement("div"); d.textContent=p.t; const sm=document.createElement("small"); sm.textContent=p.s; d.appendChild(sm); bn.appendChild(d); });
    if(list.some(p=>p.k==="dead")){ const b=document.createElement("button"); b.textContent="Sendung beendet"; b.title="Keine Warnung mehr bis zum nächsten Titelwechsel";
      b.onclick=()=>{ ls.set("rd_air_ok",String(ST.changed)); airTick(); }; bn.appendChild(b); }
    if(list.length){ const b=document.createElement("button"); b.textContent="10 Min. Ruhe"; b.onclick=()=>{ snooze=Date.now()/1000+600; airTick(); }; bn.appendChild(b); }
  }
  if(list.length&&now-lastBeep>=60){ lastBeep=now; tone([660,440,660,440],.25,.14); }
  if(!list.length) lastBeep=0;
}
pollAir(); setInterval(pollAir,5000);

/* ---------- Sendeverlauf ---------- */
if(!CFG.radio.nowplaying) return;   // ohne NowPlaying-Datei gibt es keinen Sendeverlauf
for(let k=0;k<100&&!$("tabHoerer");k++) await sleep(100);
const tb=document.createElement("button"); tb.className="tab"; tb.id="tabPlay"; tb.textContent="🎵 Sendeverlauf"; $("tabLink").before(tb);
$("linkView").insertAdjacentHTML("beforebegin",`
<section id="playView" hidden>
  <div class="panel"><h2>Sendeverlauf</h2>
    <div class="plbar"><button id="plPrev" title="Tag zurück">◀</button><input type="date" id="plDate"><button id="plNext" title="Tag vor">▶</button><button id="plToday">Heute</button>
      <input type="search" id="plSearch" placeholder="Titel oder Interpret suchen …"><button id="plCsv" title="Titelliste dieses Tages als Tabelle für Excel herunterladen">⬇ CSV-Export</button></div>
    <div class="hstats" id="plStats"></div>
    <div class="tw"><table class="tbl pl" id="plTable"></table></div>
    <p style="font-size:12px;color:var(--mut)" id="plNote"></p></div>
</section>`);
VIEWS.play=["playView","tabPlay","#sendeverlauf"]; tb.onclick=()=>show("play");
const _show=show; show=function(v){ _show(v); if(v==="play") loadPlay(); };
if(window.burgerRefresh) burgerRefresh();
let PL={date:ymd(new Date()),items:[],marker:"START_AD_BREAK"};
const norm=t=>t.toLowerCase().replace(/\s+/g," ").trim();
const shift=n=>{ const d=new Date($("plDate").value+"T12:00"); d.setDate(d.getDate()+n); $("plDate").value=ymd(d); loadPlay(); };
$("plDate").value=PL.date; $("plDate").max=ymd(new Date());
$("plDate").onchange=()=>loadPlay(); $("plPrev").onclick=()=>shift(-1); $("plNext").onclick=()=>shift(1);
$("plToday").onclick=()=>{ $("plDate").value=ymd(new Date()); loadPlay(); };
$("plSearch").oninput=()=>renderPlay();
$("plCsv").onclick=()=>{ location.href="/api/playlog.csv?date="+encodeURIComponent($("plDate").value); };
async function loadPlay(){
  try{ PL=await getJSON("/api/playlog?date="+encodeURIComponent($("plDate").value||ymd(new Date()))); }
  catch(e){ $("plTable").innerHTML=""; $("plNote").textContent="Sendeverlauf gerade nicht abrufbar."; return; }
  $("plNext").disabled=PL.date>=ymd(new Date());
  renderPlay();
}
function renderPlay(){
  const mk=PL.marker.toLowerCase(), seen={}, rows=[];
  PL.items.forEach(([ts,song])=>{   // Wiederholungen am selben Tag zählen
    const ad=song.toLowerCase().includes(mk), k=norm(song), prev=seen[k];
    const r={ts,song,ad,n:ad?0:(prev?prev.n+1:1),gap:prev?ts-prev.ts:0,prevTs:prev?prev.ts:0};
    if(!ad) seen[k]={n:r.n,ts}; rows.push(r);
  });
  const songs=rows.filter(r=>!r.ad), reps=songs.filter(r=>r.n>1&&r.gap<3*3600).length;
  const st=(l,v)=>'<div class="hs">'+l+'<b>'+v+'</b></div>';
  $("plStats").innerHTML=st("Titel",songs.length)+st("Verschiedene",Object.keys(seen).length)+st("Wiederholt (unter 3 Std.)",reps)+st("Werbe-Marker",rows.length-songs.length);
  const q=norm($("plSearch").value), today=PL.date===ymd(new Date()), T=$("plTable");
  const list=rows.map((r,i)=>Object.assign(r,{last:i===rows.length-1})).filter(r=>!q||norm(r.song).includes(q)).reverse();
  T.innerHTML="";
  if(!list.length){ T.innerHTML='<tr><td class="tn">'+(PL.items.length?"Keine Treffer.":"An diesem Tag wurden keine Titel aufgezeichnet.")+'</td></tr>'; }
  else T.innerHTML='<tr><th class="tm">Uhrzeit</th><th class="tn">Titel</th><th class="hint">Hinweis</th></tr>';
  list.forEach(r=>{
    const tr=document.createElement("tr"); if(r.ad) tr.className="ad"; else if(r.n>1&&r.gap<3*3600) tr.className="rep";
    if(today&&r.last) tr.classList.add("cur");
    const a=document.createElement("td"); a.className="tm"; a.textContent=hm(r.ts);
    const b=document.createElement("td"); b.className="tn"; b.textContent=r.ad?"📢 Werbe-Marker":r.song;
    if(today&&r.last){ const l=document.createElement("span"); l.className="live"; l.textContent="läuft"; b.appendChild(l); }
    const c=document.createElement("td"); c.className="hint"; c.textContent=r.n>1?r.n+". Mal heute · zuletzt "+hm(r.prevTs)+" Uhr"+(r.gap<3*3600?" (vor "+Math.round(r.gap/60)+" Min.)":""):"";
    tr.append(a,b,c); T.appendChild(tr);
  });
  $("plNote").textContent="Aufgezeichnet wird jeder Titelwechsel in der NowPlaying-Datei der Sendesoftware – nur solange der Dashboard-Server läuft. Gespeichert werden die letzten "+PL.days+" Tage"
    +(PL.first?" (ältester Eintrag: "+new Date(PL.first*1000).toLocaleDateString("de-DE")+")":"")+". Orange = derselbe Titel lief heute schon vor weniger als 3 Stunden.";
}
if(location.hash==="#sendeverlauf") show("play");
setInterval(()=>{ if(!$("playView").hidden&&PL.date===ymd(new Date())) loadPlay(); },15000);

})();
