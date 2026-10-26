#!/usr/bin/env python3
"""Radio-Dashboard – Info- und Studio-Dashboard für Radiosender (lokaler Server).

Start:                    python server.py          (Windows: Doppelklick auf start.bat)
Passwort vergessen:       python server.py --passwort

Beim ersten Start öffnet sich im Browser ein Einrichtungsassistent: Sendername, Logo,
Ort, Nachrichtenquellen, Hörerzahl usw. Alles lässt sich später unter "Einstellungen"
ändern. Gespeichert wird im Unterordner "data". Nur Python 3.8+ nötig, keine Pakete."""
import http.server, urllib.request, urllib.parse, time, os, json, re, sys, base64
import hashlib, hmac, secrets, getpass, html, webbrowser, threading, concurrent.futures, datetime

VERSION = "1.0.0"           # damit ein alter, noch laufender Server erkannt wird
APP_ID = "radio-dashboard"  # Kennung auf der Login-Seite (für die Erkennung eines laufenden Servers)
DEFAULT_PORT = 8765         # frei von XAMPP (80, 443, 3306, 8080, ...) – bei Bedarf wird der nächste freie Port genommen
SESSION_STUNDEN = 12        # so lange bleibt man nach der Anmeldung eingeloggt
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
DATA = os.environ.get("RADIO_DASHBOARD_DATA") or os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)
CONFIG_FILE = os.path.join(DATA, "config.json")
USERS_FILE = os.path.join(DATA, "users.json")
MSG_FILE = os.path.join(DATA, "messages.json")
LINKS_FILE = os.path.join(DATA, "links.json")
LISTEN_FILE = os.path.join(DATA, "listeners.csv")      # Hörerzahl, jede Minute
ADBREAK_FILE = os.path.join(DATA, "adbreaks.csv")      # Zeitpunkte, zu denen der Werbe-Marker lief
PLAYLOG_FILE = os.path.join(DATA, "sendeverlauf.tsv")  # gespielte Titel: Zeitstempel <TAB> Titel
FIXED_HOSTS = {"news.google.com", "verkehr.autobahn.de", "api.openligadb.de", "nameday.abalin.net"}
CACHE, TTL = {}, 120        # Feeds werden 2 Minuten zwischengespeichert
SESSIONS = {}               # Token -> {"u": Benutzer, "exp": Ablaufzeit}
FAILS = {}                  # "IP|Benutzer" -> (Fehlversuche, gesperrt bis)
LOCK = threading.RLock()
LISTEN = []                 # [(Zeitstempel, Hörer)]
ADEVENTS = []               # Zeitstempel des Werbe-Markers
PLAYLOG = []                # [(Zeitstempel, Titel)]
NOWPLAYING = {"ok": False, "song": "", "marker": False, "changed": 0}
STREAM = {"ok": None, "checked": 0, "fails": 0, "ends": 0, "title": "", "online": None, "listeners": None}
STARTED = int(time.time())   # Start des Servers (davor kann kein Marker erkannt worden sein)

# ---------------------------------------------------------------- Konfiguration
STATES = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"]
LEAGUES = ["bl1", "bl2", "bl3"]
LISTENER_TYPES = ["none", "lautfm", "icecast", "shoutcast"]
DEFAULT_CONFIG = {
    "owner": "",            # Benutzername des Haupt-Administrators (kann nicht gelöscht werden)
    "station": {"name": "", "tagline": "Info-Dashboard", "color": "#e8312f", "website": ""},
    "logo": "",             # Logo als data:-URL
    "location": {"name": "", "lat": 51.163, "lon": 10.448, "state": "", "region": "", "places": [], "keywords": []},
    "news": [],             # [{"name", "q" (Google-News-Suche) oder "url" (RSS), "filter"}]
    "blitz": {"feeds": [], "links": []},
    "traffic": {"roads": [], "alert": [], "radius": 35, "links": []},
    "sport": {"leagues": ["bl1", "bl2", "bl3"], "favs": [], "feeds": []},
    "links": [],            # Start-Auswahl für den Reiter "Links"
    "radio": {"listeners": {"type": "none", "url": ""}, "nowplaying": "", "marker": "START_AD_BREAK",
              "interval": 15, "lead": 0, "grace": 300, "deadair": 10, "playlog_days": 30},
    "network": False,       # auch von anderen Rechnern im Netzwerk erreichbar?
    "port": DEFAULT_PORT,
}
CONFIG = json.loads(json.dumps(DEFAULT_CONFIG))

def text(v, n):
    return " ".join(str(v if v is not None else "").split())[:n]

def number(v, lo, hi, default, cast=int):
    try:
        return min(hi, max(lo, cast(v)))
    except (TypeError, ValueError):
        return default

def text_list(v, items=40, n=60):
    if isinstance(v, str):
        v = re.split(r"[,\n;]", v)
    if not isinstance(v, list):
        return []
    out = []
    for x in v:
        x = text(x, n)
        if x and x not in out:
            out.append(x)
    return out[:items]

def web_url(v):
    u = str(v or "").strip()[:500]
    p = urllib.parse.urlparse(u)
    return u if p.scheme in ("http", "https") and p.hostname and "." in p.hostname else ""

def feed_list(v, items=20):
    out = []
    for x in v if isinstance(v, list) else []:
        if not isinstance(x, dict):
            continue
        f = {"name": text(x.get("name"), 60), "q": text(x.get("q"), 400), "url": web_url(x.get("url")), "filter": bool(x.get("filter"))}
        if f["name"] and (f["q"] or f["url"]):
            out.append(f)
    return out[:items]

def link_list(v, items=60):
    out = []
    for x in v if isinstance(v, list) else []:
        if isinstance(x, dict) and web_url(x.get("u")):
            out.append({"n": text(x.get("n"), 80) or urllib.parse.urlparse(x["u"]).hostname, "u": web_url(x["u"])})
    return out[:items]

def clean_config(d, old):
    """Eingaben aus dem Einrichtungsassistenten prüfen -> vollständige, saubere Konfiguration."""
    g = lambda *k: _dig(d, k)
    c = json.loads(json.dumps(DEFAULT_CONFIG))
    c["owner"] = old.get("owner", "")
    c["station"] = {"name": text(g("station", "name"), 60), "tagline": text(g("station", "tagline"), 80),
                    "color": g("station", "color") if re.fullmatch(r"#[0-9a-fA-F]{6}", str(g("station", "color"))) else "#e8312f",
                    "website": web_url(g("station", "website"))}
    logo = str(g("logo") or "")
    c["logo"] = logo if re.fullmatch(r"data:image/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+", logo) and len(logo) < 900_000 else ""
    c["location"] = {"name": text(g("location", "name"), 60), "lat": number(g("location", "lat"), -90, 90, 51.163, float),
                     "lon": number(g("location", "lon"), -180, 180, 10.448, float),
                     "state": g("location", "state") if g("location", "state") in STATES else "",
                     "region": text(g("location", "region"), 60), "places": text_list(g("location", "places")),
                     "keywords": text_list(g("location", "keywords"))}
    c["news"] = feed_list(g("news"))
    c["blitz"] = {"feeds": feed_list(g("blitz", "feeds"), 8), "links": link_list(g("blitz", "links"), 12)}
    roads = lambda v: [r.upper().replace(" ", "") for r in text_list(v, 15, 6) if re.fullmatch(r"A ?\d{1,3}", r.upper())]
    c["traffic"] = {"roads": roads(g("traffic", "roads")), "alert": roads(g("traffic", "alert")),
                    "radius": number(g("traffic", "radius"), 5, 200, 35), "links": link_list(g("traffic", "links"), 12)}
    lg = g("sport", "leagues")
    c["sport"] = {"leagues": [x for x in LEAGUES if isinstance(lg, list) and x in lg], "favs": text_list(g("sport", "favs")),
                  "feeds": feed_list(g("sport", "feeds"), 10)}
    c["links"] = link_list(g("links"))
    lt = g("radio", "listeners", "type")
    lt = lt if lt in LISTENER_TYPES else "none"
    lu = str(g("radio", "listeners", "url") or "").strip()
    if lt == "lautfm":   # Stationsname, z. B. "meinradio" (auch aus einer laut.fm-Adresse)
        m = re.search(r"laut\.fm/(?:station/)?([a-z0-9_-]+)", lu.lower())
        lu = m.group(1) if m else re.sub(r"[^a-z0-9_-]", "", lu.lower())[:60]
    elif lt != "none":
        lu = web_url(lu)
    c["radio"] = {"listeners": {"type": lt if lu or lt == "none" else "none", "url": lu if lt != "none" else ""},
                  "nowplaying": str(g("radio", "nowplaying") or "").strip().strip('"')[:300],
                  "marker": text(g("radio", "marker"), 60) or "START_AD_BREAK",
                  "interval": number(g("radio", "interval"), 0, 120, 15), "lead": number(g("radio", "lead"), 0, 30, 0),
                  "grace": number(g("radio", "grace"), 30, 1800, 300), "deadair": number(g("radio", "deadair"), 0, 120, 10),
                  "playlog_days": number(g("radio", "playlog_days"), 1, 366, 30)}
    c["network"] = bool(g("network"))
    c["port"] = number(g("port"), 1024, 65000, DEFAULT_PORT)
    return c

def _dig(d, keys):
    for k in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d

def merge_defaults(d, base=DEFAULT_CONFIG):
    """Gespeicherte Konfiguration um neue Felder ergänzen."""
    out = json.loads(json.dumps(base))
    for k, v in (d or {}).items():
        out[k] = merge_defaults(v, base[k]) if isinstance(base.get(k), dict) and isinstance(v, dict) else v
    return out

def public_config():
    """Was das Dashboard im Browser braucht (ohne Logo-Daten)."""
    c = {k: v for k, v in CONFIG.items() if k not in ("logo",)}
    c["hasLogo"] = bool(CONFIG["logo"])
    return c

def configured():
    return bool(CONFIG.get("owner")) and CONFIG["owner"] in USERS

def allowed_hosts():
    hosts = set(FIXED_HOSTS)
    for f in CONFIG["news"] + CONFIG["blitz"]["feeds"] + CONFIG["sport"]["feeds"]:
        if f.get("url"):
            hosts.add(urllib.parse.urlparse(f["url"]).hostname or "")
    return hosts

# ---------------------------------------------------------------- Dateien / Passwörter
def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default

def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)

def hash_pw(pw, salt=None):
    salt = salt or secrets.token_bytes(16)
    return salt.hex(), hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, 200_000).hex()

def pw_ok(rec, pw):
    _, h = hash_pw(pw, bytes.fromhex(rec["salt"]))
    return hmac.compare_digest(h, rec["hash"])

def ask_new_pw(wer):
    print(f"=== Neues Passwort für {wer} ===")
    print("(Bei der Eingabe werden aus Sicherheitsgründen keine Zeichen angezeigt.)\n")
    while True:
        a = getpass.getpass("Neues Passwort (mind. 6 Zeichen): ")
        if len(a) < 6:
            print("Zu kurz, bitte mindestens 6 Zeichen.\n"); continue
        if a != getpass.getpass("Passwort wiederholen: "):
            print("Die beiden Eingaben stimmen nicht überein.\n"); continue
        return a

USERS = {}
MSGS = []

def load_all():
    global USERS, MSGS, CONFIG
    USERS = load_json(USERS_FILE, {})
    MSGS = load_json(MSG_FILE, [])
    CONFIG = merge_defaults(load_json(CONFIG_FILE, {}))

def owner():
    return CONFIG.get("owner", "")

def find_user(login):
    l = login.strip().lower()
    if l in USERS:
        return l
    for k, v in USERS.items():
        if v["name"].strip().lower() == l:
            return k
    return None

def dkey(d):
    """Abteilung als Vergleichsschlüssel (Groß-/Kleinschreibung und Leerzeichen egal)."""
    return " ".join(str(d or "").split()).lower()[:40]

def clean_dept(d):
    return " ".join(str(d or "").split())

def can_see(m, me):
    """Darf Benutzer 'me' die Nachricht sehen? Abteilungs-Chats nur für Mitglieder der Abteilung."""
    to = m["to"]
    if to.startswith("dept:"):
        mine = dkey(USERS.get(me, {}).get("dept", ""))
        return bool(mine) and to == "dept:" + mine
    return to == "all" or to == me or m["from"] == me

def kill_sessions(user, keep=None):
    for t, s in list(SESSIONS.items()):
        if s["u"] == user and t != keep:
            del SESSIONS[t]

def check_new_user(u, name, pw):
    if not re.fullmatch(r"[a-z0-9._-]{2,30}", u):
        return "Benutzername: 2–30 Zeichen, nur Kleinbuchstaben, Zahlen, . _ -"
    if not 2 <= len(name) <= 60:
        return "Bitte einen Namen eingeben (2–60 Zeichen)."
    if len(pw) < 6:
        return "Das Passwort ist zu kurz (mindestens 6 Zeichen)."
    if u in USERS or any(v["name"].lower() == name.lower() for v in USERS.values()):
        return "Benutzername oder Name ist schon vergeben."
    return ""

# ---------------------------------------------------------------- Hörerzahl, Stream, Sendeverlauf, Werbe-Marker
def load_series():
    cut = time.time() - 14 * 86400
    for path, target in ((LISTEN_FILE, LISTEN), (ADBREAK_FILE, ADEVENTS)):
        keep = []
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    p = line.strip().split(",")
                    if p and p[0].isdigit() and int(p[0]) >= cut:
                        keep.append((int(p[0]), int(p[1])) if target is LISTEN else int(p[0]))
        except (OSError, IndexError, ValueError):
            pass
        target.extend(keep)
        try:   # Dateien auf die letzten 14 Tage kürzen
            with open(path, "w", encoding="utf-8") as f:
                for x in keep:
                    f.write((f"{x[0]},{x[1]}" if target is LISTEN else str(x)) + "\n")
        except OSError:
            pass

def load_playlog():
    cut = time.time() - CONFIG["radio"]["playlog_days"] * 86400
    keep = []
    try:
        with open(PLAYLOG_FILE, encoding="utf-8") as f:
            for line in f:
                ts, _, song = line.rstrip("\n").partition("\t")
                if ts.isdigit() and song and int(ts) >= cut:
                    keep.append((int(ts), song))
    except OSError:
        pass
    PLAYLOG.extend(keep)
    try:   # Datei auf die eingestellten Tage kürzen
        with open(PLAYLOG_FILE, "w", encoding="utf-8") as f:
            f.writelines(f"{t}\t{s}\n" for t, s in keep)
    except OSError:
        pass

def log_song(song):
    ts = int(time.time())
    with LOCK:
        if PLAYLOG and PLAYLOG[-1][1] == song:   # z. B. nach einem Neustart des Servers: nicht doppelt eintragen
            return
        PLAYLOG.append((ts, song))
        del PLAYLOG[:-50000]
    try:
        with open(PLAYLOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"{ts}\t{song}\n")
    except OSError:
        pass

def fetch(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": f"Mozilla/5.0 ({APP_ID}/{VERSION})"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def poll_stream(kind, src):
    """-> (Hörer, online True/False/None, laufender Titel, Titelende oder 0)"""
    if kind == "lautfm":
        base = f"https://api.laut.fm/station/{src}"
        n = int(json.loads(fetch(base + "/listeners")))
        j = json.loads(fetch(base + "/current_song"))
        title = " - ".join(x for x in ((j.get("artist") or {}).get("name", ""), j.get("title", "")) if x)
        try:   # z. B. "2026-10-25 18:40:05 +0100"
            ends = int(datetime.datetime.strptime(j["ends_at"], "%Y-%m-%d %H:%M:%S %z").timestamp()) if j.get("type") == "song" else 0
        except (KeyError, TypeError, ValueError):
            ends = 0
        return n, None, title, ends
    j = json.loads(fetch(src))
    if kind == "icecast":
        s = j["icestats"].get("source") or []
        s = s if isinstance(s, list) else [s]
        return sum(int(x.get("listeners") or 0) for x in s), len(s) > 0, (s[0].get("title") or "") if s else "", 0
    if kind == "shoutcast":
        return int(j.get("currentlisteners") or 0), j.get("streamstatus") == 1, j.get("songtitle") or "", 0
    raise ValueError(kind)

def record_listeners():
    while True:
        L = CONFIG["radio"]["listeners"]
        if L["type"] == "none" or not L["url"]:
            STREAM.update(ok=None, fails=0, online=None, listeners=None, ends=0, title="")
            time.sleep(10)
            continue
        try:
            n, online, title, ends = poll_stream(L["type"], L["url"])
            ts = int(time.time())
            STREAM.update(ok=True, checked=ts, fails=0, online=online, title=title, ends=ends, listeners=n)
            with LOCK:
                LISTEN.append((ts, n))
                del LISTEN[:-30000]
            with open(LISTEN_FILE, "a", encoding="utf-8") as f:
                f.write(f"{ts},{n}\n")
        except Exception:
            STREAM.update(ok=False, checked=int(time.time()), fails=STREAM["fails"] + 1)
        time.sleep(60)

def read_nowplaying(path):
    with open(path, "rb") as f:
        raw = f.read(4096)
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return " ".join(raw.decode(enc).split())[:300]
        except UnicodeDecodeError:
            continue
    return ""

def watch_nowplaying():
    last = None
    prev = None   # zuletzt gelesener Titel (None = noch nie gelesen)
    while True:
        R = CONFIG["radio"]
        if not R["nowplaying"]:
            NOWPLAYING.update(ok=False, song="", marker=False)
            last = prev = None
            time.sleep(2)
            continue
        try:
            song = read_nowplaying(R["nowplaying"])
            if prev is None:   # erster Lesevorgang: Zeit der letzten Änderung aus der Datei übernehmen
                NOWPLAYING["changed"] = int(os.path.getmtime(R["nowplaying"]))
            elif song != prev:
                NOWPLAYING["changed"] = int(time.time())
            if song and song != prev:
                log_song(song)
            prev = song
            has = R["marker"].lower() in song.lower()
            if last is not None and has and not last:   # Marker ist neu aufgetaucht
                ts = int(time.time())
                with LOCK:
                    ADEVENTS.append(ts)
                    del ADEVENTS[:-500]
                with open(ADBREAK_FILE, "a", encoding="utf-8") as f:
                    f.write(f"{ts}\n")
            last = has
            NOWPLAYING.update(ok=True, song=song, marker=has)
        except Exception:
            NOWPLAYING.update(ok=False, song="", marker=False)
            last = None
        time.sleep(0.5)

# ---------------------------------------------------------------- Seiten
def logo_bytes():
    m = re.fullmatch(r"data:(image/[a-z+]+);base64,(.+)", CONFIG["logo"] or "")
    return (m.group(1), base64.b64decode(m.group(2))) if m else (None, None)

def login_page(error="", user=""):
    st = CONFIG["station"]
    name = html.escape(st["name"] or "Radio-Dashboard")
    head = f'<img alt="{name}" src="/logo" style="max-height:72px;max-width:100%">' if CONFIG["logo"] else f"<h1>{name}</h1>"
    err = f'<p class="e">{html.escape(error)}</p>' if error else ""
    acc = st["color"]
    return f"""<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="generator" content="{APP_ID}">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{name} – Anmeldung</title>{'<link rel="icon" href="/logo">' if CONFIG["logo"] else ""}
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef1f6;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#282828}}
.c{{background:#fff;border-top:5px solid {acc};border-radius:14px;box-shadow:0 4px 24px rgba(20,30,50,.12);padding:28px;width:min(360px,92vw);text-align:center}}
input,button{{font:inherit;width:100%;box-sizing:border-box;padding:11px 12px;border-radius:8px;margin-top:12px}}
input{{border:1px solid #dde2ec}}button{{border:none;background:{acc};color:#fff;font-weight:700;cursor:pointer}}
button:hover{{filter:brightness(.9)}}small{{color:#5d6575}}.e{{color:#c0392b;margin:12px 0 0;font-size:14px}}</style></head>
<body><form class="c" method="post" action="/login">{head}<p><small>{html.escape(st["tagline"] or "Info-Dashboard")} · Bitte anmelden</small></p>
<input name="user" placeholder="Benutzername" value="{html.escape(user)}" autocomplete="username" required {"" if user else "autofocus"}>
<input type="password" name="pw" placeholder="Passwort" autocomplete="current-password" required {"autofocus" if user else ""}>{err}<button>Anmelden</button></form></body></html>"""

def dashboard_page():
    with open(os.path.join(WEB, "dashboard.html"), encoding="utf-8") as f:
        page = f.read()
    cfg = json.dumps(public_config(), ensure_ascii=False).replace("</", "<\\/")
    return page.replace("/*CONFIG*/null", cfg).encode("utf-8")

# ---------------------------------------------------------------- Server
STATIC_PAGES = ("/", "/index.html")

class Handler(http.server.BaseHTTPRequestHandler):
    def send(self, code, body, ctype, extra=()):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Dashboard-Version", VERSION)
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def jsend(self, code, obj):
        self.send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def err(self, code, msg):
        self.jsend(code, {"error": msg})

    def redirect(self, to, extra=()):
        self.send_response(303)
        self.send_header("Location", to)
        self.send_header("Content-Length", "0")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()

    def page(self, code, text_):
        self.send(code, text_.encode("utf-8"), "text/html; charset=utf-8")

    def file(self, name, ctype):
        try:
            with open(os.path.join(WEB, name), "rb") as f:
                return self.send(200, f.read(), ctype)
        except OSError:
            return self.send(404, b"", "text/plain")

    def local(self):
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def token(self):
        m = re.search(r"rd_session=([A-Za-z0-9_\-]+)", self.headers.get("Cookie", ""))
        return m.group(1) if m else None

    def login_cookie(self, user):
        tok = secrets.token_urlsafe(32)
        SESSIONS[tok] = {"u": user, "exp": time.time() + SESSION_STUNDEN * 3600}
        return ("Set-Cookie", f"rd_session={tok}; Path=/; Max-Age={SESSION_STUNDEN*3600}; HttpOnly; SameSite=Strict")

    def current(self):
        """Angemeldeter Benutzername oder None."""
        t = self.token()
        s = SESSIONS.get(t)
        if s and s["exp"] > time.time():
            rec = USERS.get(s["u"])
            if rec and rec.get("active", True):
                return s["u"]
        SESSIONS.pop(t, None)
        return None

    def body_json(self, limit=30_000):
        n = int(self.headers.get("Content-Length", 0) or 0)
        if n > limit:
            raise ValueError("zu gross")
        return json.loads(self.rfile.read(n) or b"{}")

    # ------------------------------------------------------------ GET
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/logo":
            ctype, data = logo_bytes()
            if not data:
                return self.send(404, b"", "text/plain")
            return self.send(200, data, ctype, [("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")])
        if not configured():
            if u.path == "/setup" and self.local():
                return self.file("setup.html", "text/html; charset=utf-8")
            if u.path in STATIC_PAGES + ("/setup", "/login"):
                return self.page(403, "<p style='font-family:sans-serif'>Das Dashboard ist noch nicht eingerichtet. Bitte auf dem Rechner, "
                                 "auf dem der Server läuft, <a href='/setup'>http://localhost:…/setup</a> öffnen.</p>") if not self.local() else self.redirect("/setup")
            return self.err(503, "Noch nicht eingerichtet")
        if u.path == "/login":
            return self.page(200, login_page())
        if u.path == "/logout":
            SESSIONS.pop(self.token(), None)
            return self.redirect("/login", [("Set-Cookie", "rd_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict")])
        me = self.current()
        if not me:
            if u.path in STATIC_PAGES or u.path in ("/setup", "/einstellungen"):
                return self.redirect("/login")
            return self.err(401, "Bitte anmelden")
        rec = USERS[me]
        is_admin = rec["role"] == "admin"

        if u.path in STATIC_PAGES:
            return self.send(200, dashboard_page(), "text/html; charset=utf-8")
        if u.path in ("/einstellungen", "/setup"):
            return self.file("setup.html", "text/html; charset=utf-8") if is_admin else self.redirect("/")
        if re.fullmatch(r"/[a-z0-9-]+\.js", u.path):
            return self.file(u.path[1:], "application/javascript; charset=utf-8")
        if u.path == "/api/config":
            if not is_admin:
                return self.err(403, "Nur für Administratoren.")
            return self.jsend(200, {"config": CONFIG, "version": VERSION})
        if u.path == "/api/me":
            return self.jsend(200, {"u": me, "name": rec["name"], "dept": rec.get("dept", ""), "role": rec["role"], "main": me == owner()})
        if u.path == "/api/users":
            with LOCK:
                if is_admin:
                    out = [{"u": k, "name": v["name"], "dept": v.get("dept", ""), "role": v["role"], "active": v.get("active", True),
                            "created": v.get("created", 0), "main": k == owner()} for k, v in USERS.items()]
                else:
                    out = [{"u": k, "name": v["name"], "dept": v.get("dept", "")} for k, v in USERS.items() if v.get("active", True)]
            return self.jsend(200, {"users": sorted(out, key=lambda x: x["name"].lower())})
        if u.path == "/api/messages":
            with LOCK:
                out = [{"id": m["id"], "from": m["from"], "fromName": m["fromName"], "fromDept": m.get("fromDept", ""), "to": m["to"],
                        "text": m["text"], "ts": m["ts"], "unread": m["from"] != me and me not in m["readBy"]}
                       for m in MSGS if can_see(m, me)][-300:]
            return self.jsend(200, {"messages": out})
        if u.path == "/api/listeners":
            cut = time.time() - 72 * 3600
            with LOCK:
                pts = [[t, n] for t, n in LISTEN if t >= cut]
            return self.jsend(200, {"now": int(time.time()), "points": pts})
        if u.path == "/api/live":
            return self.jsend(200, {"type": CONFIG["radio"]["listeners"]["type"], "listeners": STREAM["listeners"],
                                    "ok": STREAM["ok"], "checked": STREAM["checked"]})
        if u.path == "/api/nowplaying":
            R = CONFIG["radio"]
            with LOCK:
                ev = ADEVENTS[-20:]
            return self.jsend(200, {"now": time.time(), "configured": bool(R["nowplaying"]), "ok": NOWPLAYING["ok"], "song": NOWPLAYING["song"],
                                    "marker": NOWPLAYING["marker"], "events": ev, "interval": R["interval"], "lead": R["lead"],
                                    "grace": R["grace"], "started": STARTED, "markerName": R["marker"], "changed": NOWPLAYING["changed"],
                                    "deadair": R["deadair"], "stream": dict(STREAM, type=R["listeners"]["type"])})
        if u.path in ("/api/playlog", "/api/playlog.csv"):
            q = urllib.parse.parse_qs(u.query)
            try:   # ein Kalendertag (Ortszeit), Standard: heute
                day = time.strptime(q.get("date", [time.strftime("%Y-%m-%d")])[0], "%Y-%m-%d")
            except ValueError:
                return self.err(400, "Ungültiges Datum")
            t0 = int(time.mktime((day.tm_year, day.tm_mon, day.tm_mday, 0, 0, 0, 0, 0, -1)))
            t1 = int(time.mktime((day.tm_year, day.tm_mon, day.tm_mday + 1, 0, 0, 0, 0, 0, -1)))
            marker = CONFIG["radio"]["marker"]
            with LOCK:
                items = [[t, s] for t, s in PLAYLOG if t0 <= t < t1]
                first = PLAYLOG[0][0] if PLAYLOG else 0
            if u.path == "/api/playlog":
                return self.jsend(200, {"date": time.strftime("%Y-%m-%d", day), "items": items, "first": first,
                                        "marker": marker, "days": CONFIG["radio"]["playlog_days"]})
            rows = ["Datum;Uhrzeit;Interpret;Titel"]
            for t, s in items:
                if marker.lower() in s.lower():
                    continue   # Werbe-Marker gehört nicht in die Titelliste
                artist, sep, title = s.partition(" - ")
                cells = [time.strftime("%d.%m.%Y", time.localtime(t)), time.strftime("%H:%M:%S", time.localtime(t)),
                         artist if sep else "", title if sep else s]
                rows.append(";".join('"' + c.replace('"', '""') + '"' for c in cells))
            name = f"sendeverlauf-{time.strftime('%Y-%m-%d', day)}.csv"
            return self.send(200, ("﻿" + "\r\n".join(rows) + "\r\n").encode("utf-8"), "text/csv; charset=utf-8",
                             [("Content-Disposition", f'attachment; filename="{name}"')])
        if u.path == "/api/links":
            data = load_json(LINKS_FILE, None)
            return self.jsend(200, data if isinstance(data, list) and data else None)
        if u.path == "/rss":
            url = urllib.parse.parse_qs(u.query).get("url", [""])[0]
            if (urllib.parse.urlparse(url).hostname or "") not in allowed_hosts():
                return self.send(403, "Quelle nicht erlaubt".encode(), "text/plain; charset=utf-8")
            hit = CACHE.get(url)
            if hit and time.time() - hit[0] < TTL:
                return self.send(200, hit[1], "application/xml; charset=utf-8")
            try:
                body = fetch(url, 15)
                CACHE[url] = (time.time(), body)
                return self.send(200, body, "application/xml; charset=utf-8")
            except Exception as e:
                if hit:   # alte Daten besser als nichts
                    return self.send(200, hit[1], "application/xml; charset=utf-8")
                return self.send(502, str(e).encode(), "text/plain; charset=utf-8")
        self.send(404, "nicht gefunden".encode(), "text/plain; charset=utf-8")

    # ------------------------------------------------------------ Login
    def login(self):
        ip = self.client_address[0]
        n = min(int(self.headers.get("Content-Length", 0) or 0), 2000)
        form = urllib.parse.parse_qs(self.rfile.read(n).decode("utf-8", "ignore"))
        login, pw = form.get("user", [""])[0].strip(), form.get("pw", [""])[0]
        key = ip + "|" + login.lower()
        fails, until = FAILS.get(key, (0, 0))
        if until > time.time():
            return self.page(429, login_page("Zu viele Fehlversuche. Bitte eine Minute warten.", login))
        with LOCK:
            name = find_user(login)
            rec = USERS.get(name) if name else None
        ok = pw_ok(rec, pw) if rec else (hash_pw(pw) and False)   # auch bei unbekanntem Benutzer rechnen (gleiche Dauer)
        if ok and not rec.get("active", True):
            return self.page(403, login_page("Dieses Konto ist gesperrt. Bitte beim Administrator melden.", login))
        if ok:
            FAILS.pop(key, None)
            return self.redirect("/", [self.login_cookie(name)])
        fails += 1
        FAILS[key] = (0, time.time() + 60) if fails >= 5 else (fails, 0)
        time.sleep(1)   # bremst automatisches Durchprobieren
        return self.page(401, login_page("Benutzername oder Passwort falsch.", login))

    # ------------------------------------------------------------ POST
    def do_POST(self):
        global CONFIG
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/setup":   # Ersteinrichtung: Administrator + Konfiguration
            if configured() or not self.local():
                return self.err(403, "Das Dashboard ist bereits eingerichtet.")
            try:
                data = self.body_json(1_500_000)
                a = data["admin"]
                u, name, pw = str(a.get("u", "")).strip().lower(), text(a.get("name"), 60), str(a.get("password", ""))
            except Exception:
                return self.err(400, "Ungültige Anfrage")
            with LOCK:
                problem = check_new_user(u, name, pw)
                if problem:
                    return self.err(400, problem)
                cfg = clean_config(data.get("config"), {})
                if not cfg["station"]["name"]:
                    return self.err(400, "Bitte den Namen des Senders eingeben.")
                salt, h = hash_pw(pw)
                USERS[u] = {"name": name, "dept": "", "salt": salt, "hash": h, "role": "admin", "active": True, "created": int(time.time())}
                cfg["owner"] = u
                save_json(USERS_FILE, USERS)
                save_json(CONFIG_FILE, cfg)
                CONFIG = cfg
            restart = cfg["network"]   # vor der Einrichtung lauscht der Server nur lokal
            return self.send(200, json.dumps({"ok": True, "restart": restart}).encode(), "application/json", [self.login_cookie(u)])
        if path == "/login":
            return self.login()
        me = self.current()
        if not me:
            return self.err(401, "Bitte anmelden")
        try:
            data = self.body_json(1_500_000 if path == "/api/config" else 100_000 if path == "/api/links" else 30_000)
        except Exception:
            return self.err(400, "Ungültige Anfrage")
        rec = USERS[me]
        is_admin = rec["role"] == "admin"

        if path == "/api/config":
            if not is_admin:
                return self.err(403, "Nur für Administratoren.")
            with LOCK:
                cfg = clean_config(data, CONFIG)
                if not cfg["station"]["name"]:
                    return self.err(400, "Bitte den Namen des Senders eingeben.")
                restart = cfg["network"] != CONFIG["network"] or cfg["port"] != CONFIG["port"]
                save_json(CONFIG_FILE, cfg)
                CONFIG = cfg
            return self.jsend(200, {"ok": True, "restart": restart})
        if path == "/api/links":
            try:
                if not isinstance(data, list):
                    raise ValueError("keine Liste")
                save_json(LINKS_FILE, link_list(data, 100))
                return self.send(200, b"ok", "text/plain")
            except Exception as e:
                return self.err(400, str(e))
        if not isinstance(data, dict):
            return self.err(400, "Ungültige Anfrage")

        # ---- eigenes Passwort ändern
        if path == "/api/password":
            new = str(data.get("new", ""))
            with LOCK:
                if not pw_ok(rec, str(data.get("old", ""))):
                    return self.err(400, "Das aktuelle Passwort stimmt nicht.")
                if len(new) < 6:
                    return self.err(400, "Das neue Passwort ist zu kurz (mindestens 6 Zeichen).")
                rec["salt"], rec["hash"] = hash_pw(new)
                save_json(USERS_FILE, USERS)
                kill_sessions(me, keep=self.token())
            return self.jsend(200, {"ok": True})

        # ---- Benutzerverwaltung (nur Admin)
        if path in ("/api/users", "/api/users/update"):
            if not is_admin:
                return self.err(403, "Nur für Administratoren.")
            with LOCK:
                if path == "/api/users":
                    u = str(data.get("u", "")).strip().lower()
                    name, pw = str(data.get("name", "")).strip(), str(data.get("password", ""))
                    role = "admin" if data.get("role") == "admin" else "user"
                    dept = clean_dept(data.get("dept", ""))
                    if len(dept) > 40:
                        return self.err(400, "Die Abteilung ist zu lang (max. 40 Zeichen).")
                    problem = check_new_user(u, name, pw)
                    if problem:
                        return self.err(409 if "vergeben" in problem else 400, problem)
                    salt, h = hash_pw(pw)
                    USERS[u] = {"name": name, "dept": dept, "salt": salt, "hash": h, "role": role, "active": True, "created": int(time.time())}
                    save_json(USERS_FILE, USERS)
                    return self.jsend(200, {"ok": True})
                u, action = str(data.get("u", "")), str(data.get("action", ""))
                t = USERS.get(u)
                if not t:
                    return self.err(404, "Benutzer nicht gefunden.")
                protected = (u == owner())
                if action == "password":
                    pw = str(data.get("value", ""))
                    if len(pw) < 6:
                        return self.err(400, "Das Passwort ist zu kurz (mindestens 6 Zeichen).")
                    t["salt"], t["hash"] = hash_pw(pw)
                    kill_sessions(u)
                elif action == "dept":
                    d = clean_dept(data.get("value", ""))
                    if len(d) > 40:
                        return self.err(400, "Die Abteilung ist zu lang (max. 40 Zeichen).")
                    t["dept"] = d
                elif action == "role":
                    if protected or u == me:
                        return self.err(400, "Diese Rolle kann nicht geändert werden.")
                    t["role"] = "admin" if data.get("value") == "admin" else "user"
                elif action == "active":
                    if protected or u == me:
                        return self.err(400, "Dieses Konto kann nicht gesperrt werden.")
                    t["active"] = bool(data.get("value"))
                    if not t["active"]:
                        kill_sessions(u)
                elif action == "delete":
                    if protected or u == me:
                        return self.err(400, "Dieses Konto kann nicht gelöscht werden.")
                    del USERS[u]
                    kill_sessions(u)
                else:
                    return self.err(400, "Unbekannte Aktion.")
                save_json(USERS_FILE, USERS)
            return self.jsend(200, {"ok": True})

        # ---- Nachrichten
        if path == "/api/messages":
            to, txt = str(data.get("to", "")), str(data.get("text", "")).strip()
            if not txt or len(txt) > 2000:
                return self.err(400, "Nachricht leer oder zu lang (max. 2000 Zeichen).")
            with LOCK:
                if to.startswith("dept:"):
                    if not can_see({"to": to, "from": me}, me):
                        return self.err(403, "Du gehörst nicht zu dieser Abteilung.")
                elif to != "all" and (to == me or to not in USERS or not USERS[to].get("active", True)):
                    return self.err(400, "Empfänger nicht gefunden.")
                mid = (MSGS[-1]["id"] + 1) if MSGS else 1
                MSGS.append({"id": mid, "from": me, "fromName": rec["name"], "fromDept": rec.get("dept", ""), "to": to, "text": txt,
                             "ts": int(time.time()), "readBy": [me]})
                del MSGS[:-2000]
                save_json(MSG_FILE, MSGS)
            return self.jsend(200, {"ok": True, "id": mid})
        if path == "/api/messages/read":
            with_ = str(data.get("with", ""))
            with LOCK:
                changed = False
                for m in MSGS:
                    conv = (m["to"] == with_ and can_see(m, me)) if (with_ == "all" or with_.startswith("dept:")) else (m["from"] == with_ and m["to"] == me)
                    if conv and me not in m["readBy"]:
                        m["readBy"].append(me); changed = True
                if changed:
                    save_json(MSG_FILE, MSGS)
            return self.jsend(200, {"ok": True})
        if path == "/api/messages/delete":
            with LOCK:
                for m in MSGS:
                    if m["id"] == data.get("id"):
                        if m["from"] != me and not is_admin:
                            return self.err(403, "Du kannst nur eigene Nachrichten löschen.")
                        MSGS.remove(m)
                        save_json(MSG_FILE, MSGS)
                        break
            return self.jsend(200, {"ok": True})
        self.err(404, "nicht gefunden")

    def log_message(self, *a):
        pass

def find_running(port0):
    """Läuft schon ein Dashboard-Server? -> (Port, Version) oder None."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def probe(port):
        try:
            r = opener.open(f"http://127.0.0.1:{port}/login", timeout=0.7)
            if APP_ID in r.read(4000).decode("utf-8", "ignore") or r.headers.get("X-Dashboard-Version"):
                return port, r.headers.get("X-Dashboard-Version")
        except urllib.error.HTTPError as e:   # z. B. 403 "noch nicht eingerichtet"
            if e.headers.get("X-Dashboard-Version"):
                return port, e.headers.get("X-Dashboard-Version")
        except Exception:
            pass
        return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:   # alle Ports gleichzeitig prüfen (schnell)
        for res in ex.map(probe, range(port0, port0 + 20)):
            if res:
                return res
    return None

def main():
    load_all()
    port0 = CONFIG["port"]
    print("Radio-Dashboard wird gestartet …")
    found = find_running(port0)
    if found:   # nichts starten oder ändern, solange schon ein Server läuft
        port, ver = found
        if "--passwort" in sys.argv:
            print(f"Der Server läuft noch (Port {port}). Bitte zuerst das Server-Fenster schließen,")
            print("dann das Passwort ändern und danach den Server neu starten.")
        elif ver == VERSION:
            print(f"Das Dashboard läuft bereits: http://localhost:{port}")
            webbrowser.open(f"http://localhost:{port}")
        else:
            print(f"ACHTUNG: Auf Port {port} läuft noch ein ALTER Dashboard-Server.")
            print("Bitte das alte Server-Fenster schließen und dieses Programm erneut starten.")
        if sys.stdin and sys.stdin.isatty():
            input("\nZum Schließen Enter drücken …")
        sys.exit(0)
    if "--passwort" in sys.argv:
        if not configured():
            print("Das Dashboard ist noch nicht eingerichtet – einfach den Server starten, die Einrichtung öffnet sich im Browser.")
        else:
            rec = USERS[owner()]
            rec["salt"], rec["hash"] = hash_pw(ask_new_pw(f"{rec['name']} ({owner()})"))
            rec["active"] = True
            save_json(USERS_FILE, USERS)
            print("Passwort gespeichert.")
        input("Fertig. Zum Schließen Enter drücken …")
        sys.exit(0)
    load_series()
    load_playlog()
    threading.Thread(target=record_listeners, daemon=True).start()
    threading.Thread(target=watch_nowplaying, daemon=True).start()
    host = "0.0.0.0" if configured() and CONFIG["network"] else "127.0.0.1"
    srv = None
    for port in range(port0, port0 + 20):   # nimmt den ersten freien Port
        try:
            srv = http.server.ThreadingHTTPServer((host, port), Handler)
            break
        except OSError:
            continue
    if srv is None:
        raise SystemExit(f"Kein freier Port gefunden ({port0}-{port0 + 19}).")
    url =f"http://localhost:{port}"
    if configured():
        print(f"{CONFIG['station']['name']} – Dashboard läuft: {url}")
        if host == "0.0.0.0":
            print("Auch von anderen Rechnern im Netzwerk erreichbar (http://<Name-oder-IP-dieses-Rechners>:%d)." % port)
        R = CONFIG["radio"]
        if R["nowplaying"]:
            print(f"Überwacht wird {R['nowplaying']}" + (f" – Werbe-Marker {R['marker']} alle {R['interval']} Min." if R["interval"] else ""))
    else:
        url += "/setup"
        print(f"Erster Start – die Einrichtung öffnet sich im Browser: {url}")
    print("Zum Beenden: Strg + C (oder das Fenster schließen)")
    if "--no-browser" not in sys.argv:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
