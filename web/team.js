/* Radio-Dashboard – Team: Vorlese-Fenster, Benutzer, Team-Nachrichten.
   Wird vom Server (server.py) nach der Anmeldung geladen. */
(async function(){
"use strict";
if(!location.protocol.startsWith("http")) return;        // nur über den Server verfügbar

/* ---------- Styles ---------- */
const css=document.createElement("style");
css.textContent=`
dialog.wide{width:min(720px,94vw)}dialog.wide.bigmode{width:96vw;max-height:94vh}
#ndText{width:100%;box-sizing:border-box;font:inherit;font-size:20px;line-height:1.55;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--txt);resize:vertical;min-height:140px}
#ndText.big{font-size:40px;line-height:1.45;min-height:50vh}
select{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:7px 10px}
.badge{background:var(--acc);color:#fff;border-radius:10px;padding:0 7px;font-size:11px;font-weight:800;margin-left:6px}
.chat{display:grid;grid-template-columns:240px 1fr;gap:14px;padding:14px 24px 30px}
@media(max-width:760px){.chat{grid-template-columns:1fr}}
.chatside{display:grid;gap:6px;align-content:start}.chatside button{text-align:left}
.chatmain{background:var(--card);border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;height:calc(100vh - 250px);min-height:380px}
.chathead{padding:10px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:8px}
.chatlist{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.msg{max-width:78%;padding:8px 12px;border-radius:12px;background:var(--bg);align-self:flex-start;position:relative}
.msg.me{align-self:flex-end;background:#dcebfa}
.msg small{color:var(--mut);display:block;font-size:11px;margin-bottom:2px}
.msg .t{white-space:pre-wrap;word-break:break-word}
.msg .del{border:none;background:transparent;padding:0 4px;font-size:11px;opacity:.35;cursor:pointer;margin-left:6px}.msg:hover .del{opacity:.9}
.chatform{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
.chatform textarea{flex:1;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--txt);resize:none}
.empty{color:var(--mut);padding:20px;text-align:center}
#whoami{font-weight:700;font-size:13px;color:var(--txt)}
.role{font-size:11px;font-weight:800;border-radius:4px;padding:1px 6px;color:#fff;background:#6b7385}.role.admin{background:var(--acc)}
.uact button{margin:2px 3px 2px 0;padding:3px 8px;font-size:12px}
.members{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line);font-size:12px;color:var(--mut)}
.mem{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:1px 9px;color:var(--txt)}.mlab{font-weight:700}
.chatside .sec{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.6px;margin-top:6px}
`;
document.head.appendChild(css);

/* ---------- Fenster einfügen ---------- */
document.body.insertAdjacentHTML("afterbegin",`
<dialog id="newsDlg" class="wide">
  <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--mut)"><b class="src" id="ndSrc"></b><span id="ndTime"></span></div>
  <h3 id="ndTitle" style="margin:6px 0 10px;line-height:1.3"></h3>
  <div id="ndMeta" style="font-size:13px;color:var(--mut);margin:-4px 0 8px" hidden></div>
  <div id="ndBody" style="white-space:pre-line;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:10px;max-height:160px;overflow-y:auto;font-size:14px" hidden></div>
  <div id="ndSources" style="font-size:13px;margin:0 0 8px" hidden></div>
  <div class="bar" id="ndModes" style="padding:0 0 8px"></div>
  <textarea id="ndText" rows="6"></textarea>
  <div class="sayfoot" style="margin-top:8px"><span id="ndInfo"></span><button id="ndCopy">📋 Kopieren</button><button id="ndBig">🔍 Großanzeige</button><a id="ndOpen" class="lk" target="_blank" rel="noopener">↗ Artikel öffnen</a></div>
  <div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px"><span><button id="ndPrev">◀</button> <button id="ndNext">▶</button> <button id="ndHide">🚫 Ausblenden</button></span><button id="ndClose">Schließen</button></div>
</dialog>
<dialog id="pwDlg">
  <h3 style="margin:0 0 10px">Passwort ändern</h3>
  <div class="mine">
    <input id="pwOld" type="password" placeholder="Aktuelles Passwort" style="margin:0;width:100%;box-sizing:border-box">
    <input id="pwNew" type="password" placeholder="Neues Passwort (mind. 6 Zeichen)" style="margin:0;width:100%;box-sizing:border-box">
    <input id="pwNew2" type="password" placeholder="Neues Passwort wiederholen" style="margin:0;width:100%;box-sizing:border-box">
  </div>
  <div class="err" id="pwMsg" style="padding:8px 0 0"></div>
  <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="pwSave">Speichern</button><button id="pwCancel">Abbrechen</button></div>
</dialog>`);

/* ---------- Nachricht öffnen: Fenster mit Vorlesetext ---------- */
const ND_MODES={kurz:"Kurz",quelle:"Mit Quelle",anmod:"Mit Anmoderation",teaser:"Mit Teaser"};
const BAU_MODES={kurz:"Kurz",detail:"Mit Details",quelle:"Mit Quelle"};
function bauText(i,m){
  const kind=i.svc==="closure"?(i.blocked?"Vollsperrung":"Sperrung"):i.svc==="roadworks"?"Baustelle":"Verkehrsmeldung";
  const L=[kind+" auf der "+i.road+"."]; if(!i.noTitle) L.push(sent(i.title.replace(/\s+/g," ").trim()));
  if(m!=="kurz"){
    if(i.sub&&i.sub!==i.title) L.push(sent(i.sub.trim()));
    String(i.text||"").split(" · ").map(x=>x.trim()).filter(Boolean).forEach(x=>L.push(sent(x)));
    if(i.date){ const dt=new Date(i.date).toLocaleDateString("de-DE",{day:"numeric",month:"long"}); L.push(i.future?"Geplant ab dem "+dt+".":"Seit dem "+dt+"."); }
    if(i.d!=null) L.push("Das ist rund "+Math.max(1,Math.round(i.d))+" Kilometer von "+TOWN+" entfernt.");
  }
  if(m==="quelle") L.push("Das meldet die Autobahn GmbH.");
  return L.join("\n");
}
let ND={list:[],idx:0,mode:"quelle",big:false};
const srcSay=n=>String(n||"").replace(/\(.*?\)/g,"").replace(/\.(de|com|net)\b/ig,"").trim();
const sent=t=>/[.!?:]$/.test(t)?t:t+".";
function teaserOf(i){
  const t=(i.text||"").trim(); if(!t) return "";
  const n=x=>x.toLowerCase().replace(/[^a-zäöüß0-9]/g,"").slice(0,25);
  if(n(i.title)===n(t)) return "";                                   // Google liefert hier nur die Überschrift
  if(/[.!?]$/.test(t)) return t;
  const k=Math.max(t.lastIndexOf(". "),t.lastIndexOf("! "),t.lastIndexOf("? ")); return k>0?t.slice(0,k+1):"";   // nur vollständige Sätze
}
function ndBuild(i,m){
  if(i.kind==="bau") return bauText(i,m);
  const q="Das meldet "+srcSay(i.from)+".", t=sent(i.title);
  if(m==="kurz") return t;
  if(m==="anmod") return "Neues aus der Region.\n"+t+"\n"+q;
  if(m==="teaser") return t+"\n"+teaserOf(i)+"\n"+q;
  return t+"\n"+q;
}
function ndInfo(){ const w=$("ndText").value.split(/\s+/).filter(Boolean).length; $("ndInfo").textContent="≈ "+Math.max(3,Math.round(w/2.4))+" Sek. Sprechzeit"; }
function renderND(){
  const i=ND.list[ND.idx]; if(!i){ $("newsDlg").close(); return; }
  const bau=i.kind==="bau";
  $("ndSrc").textContent=i.from; $("ndTime").textContent=(bau?(i.whenText||""):ago(i.date))+" · "+(ND.idx+1)+" / "+ND.list.length;
  $("ndTitle").textContent=i.title; $("ndOpen").href=i.link; $("ndOpen").textContent=bau?"↗ autobahn.de":"↗ Artikel öffnen"; $("ndHide").hidden=bau;
  $("ndMeta").hidden=!bau; $("ndBody").hidden=!bau;
  const so=$("ndSources"), srcs=(!bau&&i.sources&&i.sources.length>1)?i.sources:[]; so.hidden=!srcs.length; so.innerHTML="";
  if(srcs.length){ const h=document.createElement("b"); h.textContent="📰 "+srcs.length+" Quellen berichten: "; so.appendChild(h);
    srcs.forEach(s=>{ const a=document.createElement("a"); a.href=s.link; a.target="_blank"; a.rel="noopener"; a.textContent=s.from; a.title=s.title; a.style.marginRight="12px"; so.appendChild(a); }); }
  if(bau){
    $("ndMeta").textContent=[i.d!=null?"📍 ca. "+Math.round(i.d)+" km von "+TOWN+"":"", "Autobahn "+i.road, i.blocked?"gesperrt":"", i.future?"geplant":""].filter(Boolean).join(" · ");
    $("ndBody").textContent=[i.sub&&i.sub!==i.title?i.sub:"", ...String(i.text||"").split(" · ")].map(x=>x.trim()).filter(Boolean).join("\n")||"Keine weiteren Angaben.";
  }
  const modes=Object.entries(bau?BAU_MODES:ND_MODES).filter(([k])=>k!=="teaser"||teaserOf(i));
  if(!modes.some(([k])=>k===ND.mode)) ND.mode=bau?"detail":"quelle";
  const bx=$("ndModes"); bx.innerHTML="";
  modes.forEach(([k,n])=>{ const b=document.createElement("button"); b.className="chip"+(k===ND.mode?" on":""); b.textContent=n; b.onclick=()=>{ND.mode=k;renderND();}; bx.appendChild(b); });
  $("ndText").value=ndBuild(i,ND.mode); ndInfo();
  $("ndPrev").disabled=ND.idx<=0; $("ndNext").disabled=ND.idx>=ND.list.length-1;
  $("ndText").classList.toggle("big",ND.big); $("newsDlg").classList.toggle("bigmode",ND.big); $("ndBig").textContent=ND.big?"🔍 Normal":"🔍 Großanzeige";
}
function openNews(list,idx){ ND.list=list.slice(); ND.idx=Math.max(0,idx); renderND(); if(!$("newsDlg").open) $("newsDlg").showModal(); }
window.openNews=openNews;
$("ndText").addEventListener("input",ndInfo);
$("ndPrev").onclick=()=>{ if(ND.idx>0){ ND.idx--; renderND(); } };
$("ndNext").onclick=()=>{ if(ND.idx<ND.list.length-1){ ND.idx++; renderND(); } };
$("ndClose").onclick=()=>$("newsDlg").close();
$("ndBig").onclick=()=>{ ND.big=!ND.big; renderND(); };
$("ndCopy").onclick=async()=>{ const b=$("ndCopy"); try{ await navigator.clipboard.writeText($("ndText").value); b.textContent="✔ Kopiert"; }catch(e){ $("ndText").select(); b.textContent="Strg+C drücken"; } setTimeout(()=>{ b.textContent="📋 Kopieren"; },1800); };
$("ndHide").onclick=()=>{ const i=ND.list[ND.idx]; if(!i) return; hideItem(i);
  document.querySelectorAll(".item").forEach(el=>{ if(el.__it===i) el.remove(); });
  ND.list.splice(ND.idx,1); if(ND.idx>=ND.list.length) ND.idx=ND.list.length-1; renderND(); };
$("newsDlg").addEventListener("keydown",e=>{ if(e.target.tagName==="TEXTAREA") return; if(e.key==="ArrowRight") $("ndNext").click(); if(e.key==="ArrowLeft") $("ndPrev").click(); });

/* ---------- Angemeldeter Benutzer ---------- */
async function api(path,body){
  const r=await fetch(path,body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  let j={}; try{ j=await r.json(); }catch(e){}
  if(r.status===401){ location.href="/login"; throw new Error("Bitte anmelden"); }
  if(!r.ok) throw new Error(j.error||("Fehler "+r.status));
  return j;
}
let ME; try{ ME=await api("/api/me"); }catch(e){ return; }
const isAdmin=ME.role==="admin";

// Kopfbereich: Name + Passwort ändern
$("refresh").insertAdjacentHTML("beforebegin",'<div id="whoami"></div>');
const setWho=()=>{ $("whoami").textContent="👤 "+ME.name+(ME.dept?" · "+ME.dept:"")+(ME.role==="admin"?" (Admin)":""); }; setWho();
$("refresh").insertAdjacentHTML("afterend",' <button id="pwBtn" title="Passwort ändern">🔑 Passwort</button>'+(isAdmin?' <a class="lk" href="/einstellungen" title="Sender, Ort, Quellen und Technik einstellen">⚙️ Einstellungen</a>':''));
$("pwBtn").onclick=()=>{ ["pwOld","pwNew","pwNew2"].forEach(i=>$(i).value=""); $("pwMsg").textContent=""; $("pwDlg").showModal(); $("pwOld").focus(); };
$("pwCancel").onclick=()=>$("pwDlg").close();
$("pwSave").onclick=async()=>{
  if($("pwNew").value!==$("pwNew2").value){ $("pwMsg").textContent="Die beiden neuen Passwörter stimmen nicht überein."; return; }
  try{ await api("/api/password",{old:$("pwOld").value,new:$("pwNew").value}); $("pwDlg").close(); alert("Passwort geändert."); }
  catch(e){ $("pwMsg").textContent=e.message; }
};

/* ---------- Reiter einfügen (Links bleibt der letzte) ---------- */
const mkTab=(id,label)=>{ const b=document.createElement("button"); b.className="tab"; b.id=id; b.textContent=label; $("tabLink").before(b); return b; };
mkTab("tabChat","💬 Nachrichten");
document.getElementById("linkView").insertAdjacentHTML("beforebegin",`
<section id="chatView" hidden>
  <div class="chat">
    <div class="chatside" id="chatSide"></div>
    <div class="chatmain">
      <div class="chathead" id="chatHead"></div>
      <div class="members" id="chatMembers"></div>
      <div class="chatlist" id="chatList"></div>
      <div class="chatform"><textarea id="chatInput" rows="2" placeholder="Nachricht schreiben … (Enter = senden, Umschalt+Enter = neue Zeile)" maxlength="2000"></textarea><button id="chatSend">Senden</button></div>
    </div>
  </div>
</section>`);
VIEWS.chat=["chatView","tabChat","#nachrichten"];
if(isAdmin){
  mkTab("tabUsers","👥 Benutzer");
  document.getElementById("linkView").insertAdjacentHTML("beforebegin",`
<section id="usersView" hidden>
  <div class="panel">
    <h2>Neuen Benutzer anlegen</h2>
    <div class="addrow"><input id="nuName" placeholder="Vollständiger Name"><input id="nuUser" placeholder="Benutzername, z. B. max" autocapitalize="none"><input id="nuPw" placeholder="Start-Passwort (mind. 6 Zeichen)"><input id="nuDept" list="deptList" placeholder="Abteilung (optional)" maxlength="40"><datalist id="deptList"></datalist><select id="nuRole"><option value="user">Benutzer</option><option value="admin">Admin</option></select><button id="nuAdd">Anlegen</button></div>
    <div class="err" id="nuMsg" style="padding:0"></div>
  </div>
  <div class="panel" style="margin-top:14px;margin-bottom:30px"><h2>Alle Benutzer</h2><div class="tw"><table class="tbl" id="uTable"></table></div></div>
</section>`);
  VIEWS.users=["usersView","tabUsers","#benutzer"];
}
for(const k of ["chat","users"]) if(VIEWS[k]){ $(VIEWS[k][1]).onclick=()=>show(k); }
const _show=show;
show=function(v){ _show(v); if(v==="chat"){ pollMsgs(); setTimeout(()=>$("chatInput").focus(),60); } if(v==="users") loadUsers(); };
for(const k of ["chat","users"]) if(VIEWS[k]&&VIEWS[k][2]===location.hash) show(k);

/* ---------- Team-Nachrichten ---------- */
const BASE_TITLE=document.title;
let PEOPLE=[], MS=[], conv="all", firstPoll=true, lastUnread=0, lastKey="", showMembers=true;
let soundOn=true; try{ soundOn=localStorage.getItem("rd_sound")!=="0"; }catch(e){}
function beep(){ try{ const c=new (window.AudioContext||window.webkitAudioContext)(), o=c.createOscillator(), g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=880; g.gain.value=.08; o.start(); setTimeout(()=>{ o.stop(); c.close(); },180); }catch(e){} }
const nameOf=u=>u===ME.u?ME.name:((PEOPLE.find(x=>x.u===u)||{}).name||u);
function fmtTime(ts){ const d=new Date(ts*1000), n=new Date(), t=d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
  return d.toDateString()===n.toDateString()?t:d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})+" "+t; }
const convOf=m=>(m.to==="all"||m.to.startsWith("dept:"))?m.to:(m.from===ME.u?m.to:m.from);
const dkey=d=>String(d||"").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
const myDept=()=>ME.dept?"dept:"+dkey(ME.dept):"";
const deptOf=u=>(PEOPLE.find(x=>x.u===u)||{}).dept||"";
function unreadBy(){ const o={}; MS.forEach(m=>{ if(m.unread){ const k=convOf(m); o[k]=(o[k]||0)+1; } }); return o; }
async function pollMsgs(){
  try{ const [pj,mj,me]=await Promise.all([api("/api/users"),api("/api/messages"),api("/api/me")]); PEOPLE=pj.users.filter(x=>x.active!==false); MS=mj.messages; ME=me; setWho(); }catch(e){ return; }
  if(conv.startsWith("dept:")?conv!==myDept():(conv!=="all"&&!PEOPLE.some(p=>p.u===conv))) conv="all";
  if(!$("chatView").hidden && document.visibilityState==="visible" && unreadBy()[conv]){
    try{ await api("/api/messages/read",{with:conv}); MS.forEach(m=>{ if(m.unread&&convOf(m)===conv) m.unread=false; }); }catch(e){}
  }
  const total=MS.filter(m=>m.unread).length;
  if(!firstPoll && total>lastUnread && soundOn) beep();
  firstPoll=false; lastUnread=total;
  $("tabChat").textContent="💬 Nachrichten"+(total?" ("+total+")":""); if(window.burgerRefresh) burgerRefresh(); const bb=$("burger"); if(bb) bb.classList.toggle("unread",total>0);
  document.title=(total?"("+total+") ":"")+BASE_TITLE;
  renderChat();
}
function renderChat(){
  const ub=unreadBy(), side=$("chatSide"); side.innerHTML="";
  const mk=(key,label)=>{ const b=document.createElement("button"); b.className="chip"+(key===conv?" on":""); b.textContent=label;
    if(ub[key]){ const s=document.createElement("span"); s.className="badge"; s.textContent=ub[key]; b.appendChild(s); }
    b.onclick=()=>{ conv=key; renderChat(); pollMsgs(); }; side.appendChild(b); };
  const sec=t=>{ const h=document.createElement("small"); h.className="sec"; h.textContent=t; side.appendChild(h); };
  sec("Gruppen"); mk("all","📢 Alle (Team)"); if(myDept()) mk(myDept(),"🏢 "+ME.dept);
  sec("Personen"); PEOPLE.filter(p=>p.u!==ME.u).forEach(p=>mk(p.u,"👤 "+p.name+(p.dept?" · "+p.dept:"")));
  const hd=$("chatHead"); hd.innerHTML=""; const t=document.createElement("b"); const isGroup=conv==="all"||conv.startsWith("dept:");
  t.textContent=conv==="all"?"📢 Nachrichten an alle":conv.startsWith("dept:")?"🏢 Abteilung "+ME.dept:"💬 "+nameOf(conv)+(deptOf(conv)?" · "+deptOf(conv):""); hd.appendChild(t);
  const mb=$("chatMembers"); mb.innerHTML=""; mb.hidden=!isGroup||!showMembers;
  if(isGroup){
    const mem=PEOPLE.filter(p=>conv==="all"||(p.dept&&"dept:"+dkey(p.dept)===conv));
    const lab=document.createElement("span"); lab.className="mlab"; lab.textContent="👥 "+mem.length+(mem.length===1?" Mitglied:":" Mitglieder:"); mb.appendChild(lab);
    mem.forEach(p=>{ const c=document.createElement("span"); c.className="mem"; c.textContent=(p.u===ME.u?"Du":p.name)+(conv==="all"&&p.dept?" · "+p.dept:""); mb.appendChild(c); });
    const tb=document.createElement("button"); tb.textContent=showMembers?"👥 Mitglieder ausblenden":"👥 Mitglieder anzeigen";
    tb.onclick=()=>{ showMembers=!showMembers; renderChat(); }; hd.appendChild(tb);
  }
  const sb=document.createElement("button"); sb.textContent=soundOn?"🔔 Ton an":"🔕 Ton aus"; sb.title="Signalton bei neuen Nachrichten";
  sb.onclick=()=>{ soundOn=!soundOn; try{ localStorage.setItem("rd_sound",soundOn?"1":"0"); }catch(e){} renderChat(); }; hd.appendChild(sb);
  const list=$("chatList"), mine=MS.filter(m=>convOf(m)===conv), nearEnd=list.scrollHeight-list.scrollTop-list.clientHeight<80, key=conv+":"+mine.length+":"+(mine.length?mine[mine.length-1].id:0);
  list.innerHTML="";
  if(!mine.length){ const e=document.createElement("div"); e.className="empty"; e.textContent="Noch keine Nachrichten. Schreib die erste! 👋"; list.appendChild(e); }
  mine.forEach(m=>{
    const d=document.createElement("div"); d.className="msg"+(m.from===ME.u?" me":"");
    const s=document.createElement("small"); s.textContent=(m.from===ME.u?"Du":m.fromName+(m.fromDept?" ("+m.fromDept+")":""))+" · "+fmtTime(m.ts);
    if(m.from===ME.u||isAdmin){ const x=document.createElement("button"); x.className="del"; x.textContent="✕"; x.title="Nachricht löschen";
      x.onclick=async()=>{ if(confirm("Diese Nachricht löschen?")){ try{ await api("/api/messages/delete",{id:m.id}); pollMsgs(); }catch(e){ alert(e.message); } } }; s.appendChild(x); }
    const tx=document.createElement("div"); tx.className="t"; tx.textContent=m.text; d.appendChild(s); d.appendChild(tx); list.appendChild(d);
  });
  if(key!==lastKey||nearEnd){ list.scrollTop=list.scrollHeight; } lastKey=key;
}
async function sendMsg(){
  const t=$("chatInput").value.trim(); if(!t) return; $("chatSend").disabled=true;
  try{ await api("/api/messages",{to:conv,text:t}); $("chatInput").value=""; await pollMsgs(); }catch(e){ alert(e.message); }
  $("chatSend").disabled=false; $("chatInput").focus();
}
$("chatSend").onclick=sendMsg;
$("chatInput").addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMsg(); } });
pollMsgs(); setInterval(pollMsgs,6000);

/* ---------- Benutzerverwaltung (nur Admin) ---------- */
let USERLIST=[];
async function loadUsers(){ try{ USERLIST=(await api("/api/users")).users; renderUsers(); const dl=$("deptList"); if(dl){ dl.innerHTML=""; [...new Set(USERLIST.map(x=>x.dept).filter(Boolean))].forEach(d=>{ const o=document.createElement("option"); o.value=d; dl.appendChild(o); }); } }catch(e){} }
async function userAction(u,action,value){ try{ await api("/api/users/update",{u,action,value}); loadUsers(); }catch(e){ alert(e.message); } }
function renderUsers(){
  const t=$("uTable"); t.innerHTML='<tr><th class="tn">Name</th><th class="tn">Benutzername</th><th class="tn">Abteilung</th><th>Rolle</th><th>Status</th><th class="tn">Aktionen</th></tr>';
  USERLIST.forEach(u=>{
    const tr=document.createElement("tr"), td=(txt,cls)=>{ const c=document.createElement("td"); if(cls) c.className=cls; c.textContent=txt; tr.appendChild(c); return c; };
    td(u.name,"tn"); td(u.u,"tn"); td(u.dept||"–","tn");
    const r=td("",""); const rs=document.createElement("span"); rs.className="role"+(u.role==="admin"?" admin":""); rs.textContent=u.role==="admin"?"Admin":"Benutzer"; r.appendChild(rs);
    td(u.active?"aktiv":"gesperrt","");
    const a=td("","tn uact"); a.style.textAlign="left";
    const btn=(label,fn)=>{ const b=document.createElement("button"); b.textContent=label; b.onclick=fn; a.appendChild(b); };
    btn("🔑 Passwort",()=>{ const pw=prompt("Neues Passwort für "+u.name+" (mindestens 6 Zeichen):"); if(pw) userAction(u.u,"password",pw); });
    btn("🏢 Abteilung",()=>{ const d=prompt("Abteilung für "+u.name+" (leer lassen = keine):",u.dept||""); if(d!==null) userAction(u.u,"dept",d); });
    if(!u.main&&u.u!==ME.u){
      btn(u.role==="admin"?"Zu Benutzer":"Zu Admin",()=>userAction(u.u,"role",u.role==="admin"?"user":"admin"));
      btn(u.active?"Sperren":"Entsperren",()=>userAction(u.u,"active",!u.active));
      btn("🗑 Löschen",()=>{ if(confirm(u.name+" wirklich löschen?")) userAction(u.u,"delete"); });
    }
    t.appendChild(tr);
  });
}
if(isAdmin){
  $("nuAdd").onclick=async()=>{
    $("nuMsg").style.color="#c0392b"; $("nuMsg").textContent="";
    try{ await api("/api/users",{name:$("nuName").value,u:$("nuUser").value,password:$("nuPw").value,dept:$("nuDept").value,role:$("nuRole").value});
      $("nuMsg").style.color="#1b8a4b"; $("nuMsg").textContent="✔ Benutzer "+$("nuName").value+" angelegt. Das Start-Passwort bitte persönlich weitergeben.";
      ["nuName","nuUser","nuPw","nuDept"].forEach(i=>$(i).value=""); loadUsers(); }
    catch(e){ $("nuMsg").textContent=e.message; }
  };
}
})();
