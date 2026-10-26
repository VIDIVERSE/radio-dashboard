/* Radio-Dashboard – Studio: Moderationsfutter, Hörerverlauf, Werbe-Marker-Timer, Dunkelmodus & Schriftgröße.
   Wird vom Server (server.py) nach der Anmeldung geladen. */
(async function(){
"use strict";
if(!location.protocol.startsWith("http")) return;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pad=n=>String(n).padStart(2,"0");
const hm=ts=>{ const d=new Date(ts*1000); return pad(d.getHours())+":"+pad(d.getMinutes()); };
const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
const getJSON=async p=>{ const r=await fetch(p); if(r.status===401){ location.href="/login"; throw new Error("401"); } if(!r.ok) throw new Error(p+" "+r.status); return r.json(); };

/* ---------- Styles ---------- */
const css=document.createElement("style");
css.textContent=`
:root{--me:#dcebfa}
html[data-theme=dark]{--bg:#0f1115;--card:#181b22;--line:#2a2f3a;--txt:#eef0f4;--mut:#9aa3b5;--me:#1d3a5c;color-scheme:dark}
html[data-theme=dark] header,html[data-theme=dark] .tabs,html[data-theme=dark] .tab{background:var(--card)}
html[data-theme=dark] .tabs .tab.on{background:var(--acc)}
html[data-theme=dark] .logo img{background:#fff;border-radius:10px;padding:4px 8px}
html[data-theme=dark] #burger.unread::after{border-color:var(--card)}
html[data-theme=dark] .msg.me{background:var(--me)}
html[data-theme=dark] .fav{background:rgba(27,111,192,.28)}
#tools{display:flex;gap:6px;justify-content:flex-end;margin:4px 0}#tools button{padding:3px 9px}
#fodder{display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center;padding:8px 24px;background:var(--card);border-bottom:1px solid var(--line);font-size:14px}
#fodder .f{white-space:nowrap}#fodder button{padding:2px 10px;font-size:12px}#fodder .np{margin-left:auto;font-weight:700}
#adTimer{font-size:12px;color:var(--mut);margin-top:2px;white-space:nowrap}#adTimer b{color:var(--txt);font-variant-numeric:tabular-nums}#adTimer a{color:var(--mut);margin-left:6px}
#adBanner{position:fixed;top:0;left:0;right:0;z-index:90;padding:16px 20px;display:none;align-items:center;justify-content:center;gap:16px;font-size:24px;font-weight:800;color:#fff}
#adBanner.flash{display:flex;animation:adflash .8s infinite}#adBanner.ok{display:flex;background:#1b8a4b}#adBanner.miss{display:flex;background:#b45309}
#adBanner button{font-size:15px;padding:6px 14px}
@keyframes adflash{0%,100%{background:#e8312f}50%{background:#ffc107;color:#222}}
body.adflash::after{content:"";position:fixed;inset:0;border:12px solid #ffc107;pointer-events:none;z-index:85;animation:adborder .8s infinite}
@keyframes adborder{0%,100%{opacity:1}50%{opacity:.2}}
.hstats{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.hs{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:12px;color:var(--mut)}.hs b{display:block;font-size:22px;color:var(--txt)}
.up{color:#1b8a4b}.down{color:#c0392b}
#hChart svg{width:100%;height:auto;display:block}
`;
document.head.appendChild(css);

/* ---------- Dunkelmodus, Schriftgröße, Ton ---------- */
const ZOOMS=[0.8,0.9,1,1.1,1.25,1.5,1.75,2];
let zi=ZOOMS.indexOf(parseFloat(ls.get("rd_zoom"))); if(zi<0) zi=2;
let dark=ls.get("rd_theme")?ls.get("rd_theme")==="dark":!!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
$("upd").insertAdjacentHTML("afterend",'<div id="tools"><button id="tSound"></button><button id="tTheme"></button><button id="tMinus" title="Schrift kleiner">A−</button><button id="tPlus" title="Schrift größer">A+</button></div>');
const applyTheme=()=>{ document.documentElement.dataset.theme=dark?"dark":"light"; ls.set("rd_theme",dark?"dark":"light"); $("tTheme").textContent=dark?"☀️":"🌙"; $("tTheme").title=dark?"Zum hellen Modus wechseln":"Zum dunklen Modus wechseln"; };
const applyZoom=()=>{ document.body.style.zoom=ZOOMS[zi]; ls.set("rd_zoom",ZOOMS[zi]); $("tMinus").disabled=zi===0; $("tPlus").disabled=zi===ZOOMS.length-1; $("tMinus").title="Schrift kleiner (jetzt "+Math.round(ZOOMS[zi]*100)+" %)"; $("tPlus").title="Schrift größer (jetzt "+Math.round(ZOOMS[zi]*100)+" %)"; };
const soundOn=()=>ls.get("rd_sound")!=="0";
const applySound=()=>{ $("tSound").textContent=soundOn()?"🔔":"🔕"; $("tSound").title=soundOn()?"Signaltöne sind an – zum Ausschalten klicken":"Signaltöne sind aus – zum Einschalten klicken"; };
$("tTheme").onclick=()=>{ dark=!dark; applyTheme(); };
$("tMinus").onclick=()=>{ if(zi>0){ zi--; applyZoom(); } };
$("tPlus").onclick=()=>{ if(zi<ZOOMS.length-1){ zi++; applyZoom(); } };
$("tSound").onclick=()=>{ ls.set("rd_sound",soundOn()?"0":"1"); applySound(); if(soundOn()) tone([880,1175]); };
applyTheme(); applyZoom(); applySound();

/* ---------- Moderationsfutter: Feiertage, besondere Tage, Mond, Sonne, Namenstag ---------- */
// Hier kannst du eigene besondere Tage ergänzen: ["TT.MM.","Name"]
const SPECIAL=[["01.10.","Tag des Kaffees"],["04.10.","Welttag der Tiere"],["14.02.","Valentinstag"],["08.03.","Weltfrauentag"],["01.04.","Aprilscherz"],["23.04.","Welttag des Buches"],
  ["30.04.","Tanz in den Mai"],["04.05.","Star-Wars-Tag"],["05.06.","Weltumwelttag"],["08.08.","Weltkatzentag"],["31.10.","Halloween"],["11.11.","Martinstag"],["06.12.","Nikolaus"],["24.12.","Heiligabend"],["31.12.","Silvester"]];
function easter(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
const addDays=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const sameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const lastSunday=(y,m)=>{ const d=new Date(y,m+1,0); d.setDate(d.getDate()-d.getDay()); return d; };
const nthSunday=(y,m,n)=>{ const d=new Date(y,m,1); d.setDate(1+((7-d.getDay())%7)+(n-1)*7); return d; };
function dayInfo(dt){
  const y=dt.getFullYear(), E=easter(y), hol=[], spec=[], dm=pad(dt.getDate())+"."+pad(dt.getMonth()+1)+".";
  const st=CFG.location.state, inSt=list=>list.split(" ").includes(st);   // Feiertage je nach Bundesland
  [["01.01.","Neujahr"],["01.05.","Tag der Arbeit"],["03.10.","Tag der Deutschen Einheit"],["25.12.","1. Weihnachtstag"],["26.12.","2. Weihnachtstag"],
   ["06.01.","Heilige Drei Könige","BW BY ST"],["08.03.","Internationaler Frauentag","BE MV"],["15.08.","Mariä Himmelfahrt","SL"],["20.09.","Weltkindertag","TH"],
   ["31.10.","Reformationstag","BB HB HH MV NI SN ST SH TH"],["01.11.","Allerheiligen","BW BY NW RP SL"]].forEach(([d,n,s])=>{ if(d===dm&&(!s||inSt(s))) hol.push(n); });
  [[-2,"Karfreitag"],[0,"Ostersonntag"],[1,"Ostermontag"],[39,"Christi Himmelfahrt (Vatertag)"],[49,"Pfingstsonntag"],[50,"Pfingstmontag"],[60,"Fronleichnam","BW BY HE NW RP SL"]]
    .forEach(([n,name,s])=>{ if(sameDay(dt,addDays(E,n))&&(!s||inSt(s))) hol.push(name); });
  SPECIAL.forEach(([d,n])=>{ if(d===dm&&!hol.some(h=>h.includes(n.split(" ").pop()))) spec.push(n); });
  const adv4=new Date(y,11,24); adv4.setDate(24-adv4.getDay());
  if(sameDay(dt,addDays(adv4,-32))) (inSt("SN")?hol:spec).push("Buß- und Bettag");
  [[-21,"1. Advent"],[-14,"2. Advent"],[-7,"3. Advent"],[0,"4. Advent"],[-28,"Totensonntag"],[-35,"Volkstrauertag"]].forEach(([n,name])=>{ if(sameDay(dt,addDays(adv4,n))) spec.push(name); });
  if(sameDay(dt,nthSunday(y,4,2))) spec.push("Muttertag");
  if(sameDay(dt,nthSunday(y,9,1))) spec.push("Erntedankfest");
  if(sameDay(dt,lastSunday(y,2))) spec.push("Beginn der Sommerzeit – Uhren eine Stunde vor");
  if(sameDay(dt,lastSunday(y,9))) spec.push("Ende der Sommerzeit – Uhren eine Stunde zurück");
  return {hol,spec};
}
function moon(dt){
  const syn=29.530588853, ref=Date.UTC(2000,0,6,18,14)/864e5, age=(((dt.getTime()/864e5-ref)%syn)+syn)%syn, f=age/syn;
  const ill=Math.round((1-Math.cos(2*Math.PI*f))/2*100);
  const T=[[0.0338,"Neumond","🌑"],[0.2162,"zunehmende Sichel","🌒"],[0.2838,"erstes Viertel","🌓"],[0.4662,"zunehmender Mond","🌔"],[0.5338,"Vollmond","🌕"],[0.7162,"abnehmender Mond","🌖"],[0.7838,"letztes Viertel","🌗"],[0.9662,"abnehmende Sichel","🌘"],[1.01,"Neumond","🌑"]];
  const [,name,em]=T.find(([lim])=>f<lim);
  return {name,em,ill,toFull:Math.round(((0.5-f+1)%1)*syn)};
}
window.__rdFodder={dayInfo,moon,easter,updateFodder};
let NAMEDAY="";
const findDe=(o,dep=0)=>{ if(!o||typeof o!=="object"||dep>6) return ""; for(const k of ["de","name_de"]) if(typeof o[k]==="string"&&o[k].trim()) return o[k].trim(); for(const v of Object.values(o)){ const r=findDe(v,dep+1); if(r) return r; } return ""; };
async function loadNameday(){
  const d=new Date(), k=d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  try{ const o=JSON.parse(ls.get("rd_nd")||"null"); if(o&&o.k===k){ NAMEDAY=o.v; return; } }catch(e){}
  for(const u of ["https://nameday.abalin.net/api/V2/today?country=de&timezone=Europe/Berlin","https://nameday.abalin.net/api/v2/today?country=de","https://nameday.abalin.net/api/V1/today?country=de&timezone=Europe/Berlin"]){
    try{ const v=findDe(await jget(u)); if(v){ NAMEDAY=v; ls.set("rd_nd",JSON.stringify({k,v})); updateFodder(); return; } }catch(e){}
  }
}
document.querySelector("header").insertAdjacentHTML("afterend",'<div id="fodder"></div>');
async function copyText(t,btn){ try{ await navigator.clipboard.writeText(t); btn.textContent="✔ Kopiert"; }catch(e){ window.prompt("Text markieren und mit Strg+C kopieren:",t); } setTimeout(()=>{ btn.textContent="🗣️ Sprechtext"; },1800); }
function updateFodder(){
  const box=$("fodder"); if(!box) return;
  const now=new Date(), td=dayInfo(now), tm=dayInfo(addDays(now,1)), mo=moon(new Date(now.getFullYear(),now.getMonth(),now.getDate(),12)), nowHM=pad(now.getHours())+":"+pad(now.getMinutes());
  const parts=[], say=[];
  const wd=now.toLocaleDateString("de-DE",{weekday:"long"}), dm=now.toLocaleDateString("de-DE",{day:"numeric",month:"long"});
  parts.push("📅 "+wd+", "+dm); say.push("Heute ist "+wd+", der "+dm+".");
  if(td.hol.length){ parts.push("🎉 Feiertag: "+td.hol.join(", ")); say.push("Heute ist Feiertag: "+td.hol.join(" und ")+"."); }
  if(td.spec.length){ parts.push("✨ "+td.spec.join(", ")); say.push("Heute ist "+td.spec.join(" und ")+"."); }
  if(tm.hol.length){ parts.push("➡️ Morgen: "+tm.hol.join(", ")+" (Feiertag)"); say.push("Morgen ist Feiertag: "+tm.hol.join(" und ")+"."); }
  else if(tm.spec.length){ parts.push("➡️ Morgen: "+tm.spec.join(", ")); say.push("Morgen ist "+tm.spec.join(" und ")+"."); }
  if(typeof WXD!=="undefined"&&WXD&&WXD.d){
    const sr=WXD.d.sunrise[0].slice(11,16), ss=WXD.d.sunset[0].slice(11,16);
    parts.push("🌅 "+sr+"  🌇 "+ss);
    say.push("Die Sonne "+(sr<=nowHM?"ging":"geht")+" um "+uhr(sr)+" auf und "+(ss<=nowHM?"ging":"geht")+" um "+uhr(ss)+" unter.");
  }
  parts.push(mo.em+" "+mo.name+" ("+mo.ill+" %)"+(mo.toFull>0&&mo.toFull<=6?" · Vollmond in "+mo.toFull+(mo.toFull===1?" Tag":" Tagen"):""));
  say.push("Mondphase heute: "+mo.name+", etwa "+mo.ill+" Prozent beleuchtet."+(mo.toFull>0&&mo.toFull<=6?" Vollmond ist in "+mo.toFull+(mo.toFull===1?" Tag.":" Tagen."):""));
  if(NAMEDAY){ parts.push("🎂 Namenstag: "+NAMEDAY); say.push("Namenstag haben heute: "+NAMEDAY+"."); }
  box.innerHTML="";
  parts.forEach(t=>{ const s=document.createElement("span"); s.className="f"; s.textContent=t; box.appendChild(s); });
  const b=document.createElement("button"); b.textContent="🗣️ Sprechtext"; b.title="Alles als fertigen Satz zum Vorlesen kopieren"; b.onclick=()=>copyText(say.join(" "),b); box.appendChild(b);
  const np=document.createElement("span"); np.className="f np"; np.id="npSong"; np.textContent=NP&&NP.ok&&NP.song?"🎵 "+NP.song:""; box.appendChild(np);
}

/* ---------- Werbe-Marker-Timer (START_AD_BREAK) + Jetzt läuft ---------- */
let NP={configured:false,ok:false,song:"",events:[],off:0,interval:15,lead:0,markerName:"START_AD_BREAK"};
$("listeners").insertAdjacentHTML("afterend",'<div id="adTimer"></div>');
document.body.insertAdjacentHTML("beforeend",'<div id="adBanner"></div>');
let dismissed=0, okUntil=0, seenLast=null, lastBeep=0, testUntil=0, npReady=false;
async function pollNP(){
  try{ const j=await getJSON("/api/nowplaying"); NP=Object.assign(NP,j,{off:j.now-Date.now()/1000});
    if(seenLast===null) seenLast=NP.events.length?NP.events[NP.events.length-1]:0;   // Ausgangslage, kein Alarm für alte Ereignisse
    const s=$("npSong"); if(s) s.textContent=NP.ok&&NP.song?"🎵 "+NP.song:""; }catch(e){}
  npReady=true;
}
function adTick(){
  if(!(NP.configured&&NP.interval>0)&&!(testUntil>Date.now()/1000+NP.off)){   // Werbe-Marker nicht eingerichtet
    $("adTimer").hidden=true; const bn=$("adBanner"); bn.className=""; bn.dataset.k=""; document.body.classList.remove("adflash"); return;
  }
  $("adTimer").hidden=false;
  const now=Date.now()/1000+NP.off, iv=NP.interval*60, lead=NP.lead*60, GRACE=NP.grace||300;
  const nextB=Math.floor(now/iv)*iv+iv, prevB=nextB-iv;
  let B=0; if(now>=nextB-lead) B=nextB; else if(now<prevB+GRACE+600) B=prevB;   // danach noch 10 Min. lang die Warnung „nicht erkannt“ zeigen
  if(B&&NP.started&&B<NP.started) B=0;   // vor dem Serverstart kann kein Marker erkannt worden sein
  const conf=b=>NP.events.some(t=>t>=b-120&&t<=b+GRACE+30);
  const last=NP.events.length?NP.events[NP.events.length-1]:0;
  if(seenLast!==null&&last!==seenLast){ seenLast=last; okUntil=now+10; }
  const rem=Math.max(0,Math.round(nextB-now));
  const t=$("adTimer"); if(t) t.innerHTML='⏱ Werbe-Marker in <b>'+pad(Math.floor(rem/60))+':'+pad(rem%60)+'</b>'
    +(last?' · zuletzt '+hm(last):'')+(NP.ok?'':' · ⚠ NowPlaying-Datei nicht lesbar')+' <a href="#" id="adTest">Test</a>';
  let mode="", since=0;
  if(testUntil>now) mode="flash";
  else if(okUntil>now) mode="ok";
  else if(npReady&&B&&!conf(B)&&dismissed!==B){
    if(now<B+GRACE){ if(NP.ok||now<B+60) mode="flash"; }
    else if(NP.ok) mode="miss";
    since=now-B;
  }
  const bn=$("adBanner"); const key=mode+"|"+(mode==="ok"?hm(last):mode==="miss"?hm(B):"");
  if(bn.dataset.k!==key){
    bn.dataset.k=key; bn.className=mode;
    if(mode==="flash"){ bn.innerHTML=""; const s=document.createElement("span"); s.id="adTxt"; bn.appendChild(s);
      const b=document.createElement("button"); b.textContent="Erledigt"; b.onclick=()=>{ testUntil=0; dismissed=B; adTick(); }; bn.appendChild(b); }
    else if(mode==="ok"){ bn.textContent="✓ "+NP.markerName+" um "+hm(last)+" erkannt – Werbung läuft"; }
    else if(mode==="miss"){ bn.innerHTML=""; const s=document.createElement("span"); s.textContent="⚠ "+NP.markerName+" um "+hm(B)+" wurde nicht erkannt!"; bn.appendChild(s);
      const b=document.createElement("button"); b.textContent="OK"; b.onclick=()=>{ dismissed=B; adTick(); }; bn.appendChild(b); }
  }
  if(mode==="flash"){ const tx=$("adTxt"); if(tx) tx.textContent="⏰ "+NP.markerName+" jetzt abspielen!"+(since>2?" (fällig seit "+Math.floor(since/60)+":"+pad(Math.floor(since%60))+")":now<B?" (in "+Math.ceil(B-now)+" s)":""); }
  document.body.classList.toggle("adflash",mode==="flash");
  if(mode==="flash"&&now-lastBeep>=30){ lastBeep=now; tone([1046,1318,1046,1318],.18,.14); }
  if(mode!=="flash") lastBeep=0;
}
document.addEventListener("click",e=>{ if(e.target&&e.target.id==="adTest"){ e.preventDefault(); testUntil=Date.now()/1000+NP.off+8; adTick(); } });

/* ---------- Start (Moderationsfutter und Timer laufen sofort) ---------- */
updateFodder(); loadNameday(); pollNP(); adTick();
setInterval(updateFodder,30000); setInterval(adTick,1000); setInterval(pollNP,3000);

/* ---------- Hörerverlauf ---------- */
for(let k=0;k<60&&!$("tabChat");k++) await sleep(100);
const tb=document.createElement("button"); tb.className="tab"; tb.id="tabHoerer"; tb.textContent="📈 Hörer"; $("tabLink").before(tb);
tb.hidden=CFG.radio.listeners.type==="none";   // ohne Hörerzahl-Quelle kein Verlauf
$("linkView").insertAdjacentHTML("beforebegin",`
<section id="hoererView" hidden>
  <div class="panel"><h2>Hörerverlauf</h2><div class="hstats" id="hStats"></div><div id="hChart"></div>
  <p style="font-size:12px;color:var(--mut)">Der Dashboard-Server speichert die Hörerzahl jede Minute – nur solange er läuft. Farbig = heute, grau gestrichelt = gestern.</p></div>
</section>`);
VIEWS.hoerer=["hoererView","tabHoerer","#hoerer"]; tb.onclick=()=>show("hoerer");
const _show=show; show=function(v){ _show(v); if(v==="hoerer") loadHist(); };
if(location.hash==="#hoerer") show("hoerer");
$("listeners").style.cursor="pointer"; $("listeners").addEventListener("click",()=>show("hoerer"));
function stat(label,val,cls){ return '<div class="hs">'+label+'<b'+(cls?' class="'+cls+'"':'')+'>'+val+'</b></div>'; }
async function loadHist(){
  let j; try{ j=await getJSON("/api/listeners"); }catch(e){ $("hChart").textContent="Verlauf gerade nicht abrufbar."; return; }
  const P=j.points, t0=new Date(); t0.setHours(0,0,0,0); const T0=t0/1000, y0=new Date(t0); y0.setDate(y0.getDate()-1); const Y0=y0/1000;
  const today=P.filter(p=>p[0]>=T0), yest=P.filter(p=>p[0]>=Y0&&p[0]<T0);
  if(!today.length&&!yest.length){ $("hStats").innerHTML=""; $("hChart").textContent="Noch keine Daten – der Server speichert ab jetzt jede Minute die Hörerzahl."; return; }
  const peak=a=>a.reduce((m,p)=>p[1]>m[1]?p:m,[0,0]), pt=peak(today), py=peak(yest);
  const cur=today.length?today[today.length-1]:null, avg=today.length?today.reduce((s,p)=>s+p[1],0)/today.length:null;
  let ref=null; if(cur){ const tn=cur[0]-86400; yest.forEach(p=>{ if(Math.abs(p[0]-tn)<=180&&(ref===null||Math.abs(p[0]-tn)<Math.abs(ref[0]-tn))) ref=p; }); }
  const diff=cur&&ref?cur[1]-ref[1]:null;
  $("hStats").innerHTML=stat("Aktuell",cur?cur[1]:"–")+stat("Spitze heute",today.length?pt[1]+" <span style='font-size:12px;font-weight:400'>("+hm(pt[0])+")</span>":"–")
    +stat("Ø heute",avg===null?"–":avg.toFixed(1).replace(".",","))+stat("Spitze gestern",yest.length?py[1]+" <span style='font-size:12px;font-weight:400'>("+hm(py[0])+")</span>":"–")
    +stat("Zur selben Uhrzeit gestern",diff===null?"–":(diff>0?"▲ +"+diff:diff<0?"▼ −"+(-diff):"± 0"),diff>0?"up":diff<0?"down":"");
  const W=900,H=300,L=44,R=14,Tp=16,Bt=28,iw=W-L-R,ih=H-Tp-Bt, maxV=Math.max(5,pt[1],py[1]);
  const step=maxV<=10?2:maxV<=30?5:maxV<=100?10:Math.ceil(maxV/5/10)*10, top=Math.ceil(maxV/step)*step;
  const X=(ts,s)=>L+(ts-s)/86400*iw, Y=v=>Tp+ih-(v/top)*ih;
  const path=(a,s)=>a.map((p,k)=>(k?"L":"M")+X(p[0],s).toFixed(1)+","+Y(p[1]).toFixed(1)).join(" ");
  let g=""; for(let v=0;v<=top;v+=step) g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" style="stroke:var(--line)"/><text x="'+(L-6)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="11" style="fill:var(--mut)">'+v+'</text>';
  for(let h=0;h<=24;h+=3) g+='<text x="'+(L+h/24*iw)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" style="fill:var(--mut)">'+h+':00</text>';
  let s=g;
  if(yest.length) s+='<path d="'+path(yest,Y0)+'" fill="none" stroke-width="2" stroke-dasharray="5 4" style="stroke:var(--mut)"/>';
  if(today.length){ s+='<path d="'+path(today,T0)+' L'+X(cur[0],T0).toFixed(1)+','+Y(0)+' L'+X(today[0][0],T0).toFixed(1)+','+Y(0)+' Z" style="fill:var(--acc);opacity:.15"/>'
    +'<path d="'+path(today,T0)+'" fill="none" stroke-width="2.5" style="stroke:var(--acc)"/>'
    +'<circle cx="'+X(cur[0],T0)+'" cy="'+Y(cur[1])+'" r="4.5" style="fill:var(--acc)"/>'
    +'<circle cx="'+X(pt[0],T0)+'" cy="'+Y(pt[1])+'" r="4" style="fill:var(--card);stroke:var(--acc);stroke-width:2"/><text x="'+X(pt[0],T0)+'" y="'+(Y(pt[1])-9)+'" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--txt)">Spitze '+pt[1]+'</text>'; }
  $("hChart").innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Hörerverlauf">'+s+'</svg>';
}
setInterval(()=>{ if(!$("hoererView").hidden) loadHist(); },60000);

})();
