# 📻 Radio-Dashboard

Ein Info- und Studio-Dashboard für kleine Radiosender, Webradios und Lokalfunk. Es läuft auf dem Studio-PC im Browser und bündelt alles, was in der Moderation gebraucht wird:

- **📰 Lokale Nachrichten** aus Google News und beliebigen RSS-Feeds, doppelte Meldungen werden zusammengefasst, Werbung und Traueranzeigen ausgefiltert. Ein Klick öffnet einen **fertigen Vorlesetext** (mit Quelle, Anmoderation oder Teaser).
- **🌤️ Wetter** für den Sendeort mit **Sprechtext zum Vorlesen** (kurz, heute, morgen, Ausblick).
- **🚧 Baustellen und Sperrungen** auf den Autobahnen im Umkreis (Autobahn GmbH), mit Alarmton bei neuen Sperrungen.
- **🚨 Blitzer**: Meldungen aus der Presse und eigene Hörer-Hinweise.
- **⚽ Sport**: Bundesliga, 2. und 3. Liga mit Spieltag und Tabelle (OpenLigaDB), dazu Lokalsport.
- **📅 Moderationsfutter**: Feiertage je Bundesland, besondere Tage, Mondphase, Sonnenauf- und -untergang, Namenstage.
- **🎧 Hörerzahl und Hörerverlauf** von laut.fm, Icecast oder Shoutcast.
- **🎵 Sendeverlauf**: jeder gespielte Titel aus der NowPlaying-Datei der Sendesoftware, Hinweis auf Wiederholungen, **CSV-Export** (z. B. für GEMA-Meldungen).
- **🔇 Warnung bei Stille und Stream-Ausfall**: rotes Banner mit Ton, wenn die Sendesoftware keinen Titel mehr wechselt oder der Stream offline ist.
- **⏰ Werbe-Timer**: erinnert zum festen Takt an den Werbeblock und prüft, ob der Werbe-Marker wirklich lief.
- **💬 Team-Nachrichten** (an alle, an Abteilungen, privat) und **👥 Benutzerverwaltung** mit Rollen.
- Dunkelmodus, Schriftgröße, Großanzeige zum Vorlesen.

Gedacht für Sender in **Deutschland** (deutsche Oberfläche, Autobahn-Daten, Bundesliga, Feiertage).

## Installation

Nötig ist nur **Python 3.8 oder neuer**, es müssen keine weiteren Pakete installiert werden.

1. Python installieren: <https://www.python.org/downloads/> (unter Windows bei der Installation **„Add python.exe to PATH“** anhaken).
2. Dieses Projekt herunterladen: oben auf **Code → Download ZIP** klicken und entpacken (oder `git clone`).
3. Starten:
   - **Windows:** Doppelklick auf `start.bat`
   - **Linux/macOS:** `./start.sh` (oder `python3 server.py`)
4. Der Browser öffnet sich mit dem **Einrichtungsassistenten**: Sendername, Logo, Sendeort, Administrator-Konto, Nachrichtenquellen, Hörerzahl usw. eintragen, fertig.

Das schwarze Server-Fenster muss geöffnet bleiben, solange das Dashboard benutzt wird. Alle Einstellungen lassen sich später im Dashboard unter **⚙️ Einstellungen** ändern (nur für Administratoren).

## Einrichtung im Detail

| Bereich | Was du einträgst |
| --- | --- |
| **Sendegebiet** | Ort suchen. Daraus ergeben sich Koordinaten, Landkreis und Bundesland. Dazu die weiteren Orte im Sendegebiet, sie werden für Ortsfilter und Nachrichtensuche genutzt. |
| **Nachrichtenquellen** | Mit **„Vorschläge erzeugen“** werden passende Google-News-Suchen angelegt. Eigene Quellen: Suchbegriffe (z. B. `"Musterstadt" Feuerwehr when:2d`) oder eine RSS-Adresse. |
| **Verkehr** | Autobahnen im Umfeld, z. B. `A7, A23`, und der Umkreis in km. |
| **Sport** | Ligen auswählen und Vereine, die hervorgehoben werden. |
| **Hörerzahl** | laut.fm-Stationsname, Icecast (`…/status-json.xsl`) oder Shoutcast v2 (`…/stats?sid=1&json=1`). |
| **NowPlaying-Datei** | Die Textdatei, in die die Sendesoftware den laufenden Titel schreibt (RadioDJ, mAirList, SAM Broadcaster, …). Daraus entstehen Sendeverlauf, Stille-Warnung und Werbe-Timer. |
| **Netzwerk** | Standardmäßig ist das Dashboard nur auf dem Rechner selbst erreichbar. Wird die Freigabe eingeschaltet, kann das Team es im Studio-Netz über `http://<Rechnername>:8765` öffnen. |

## Daten und Sicherheit

- Alle Daten liegen im Ordner **`data/`**: Einstellungen, Benutzer, Nachrichten, Hörerstatistik und Sendeverlauf. Für ein Backup diesen Ordner kopieren. Bei einem Update der Programmdateien bleibt er erhalten.
- Passwörter werden nur als Hash gespeichert (PBKDF2). Nach 5 Fehlversuchen wird die Anmeldung kurz gesperrt.
- Die Verbindung ist **nicht verschlüsselt** (HTTP). Die Netzwerkfreigabe deshalb nur in vertrauenswürdigen Netzen einschalten und das Dashboard nicht direkt ins Internet stellen.
- **Passwort vergessen?** Server beenden und `passwort-zuruecksetzen.bat` starten (oder `python server.py --passwort`). Damit wird das Passwort des Haupt-Administrators neu gesetzt.

## Datenquellen

Alle Quellen sind kostenlos und brauchen keinen API-Schlüssel: [Open-Meteo](https://open-meteo.com) (Wetter und Ortssuche), [Autobahn GmbH](https://verkehr.autobahn.de) (Verkehr), [OpenLigaDB](https://www.openligadb.de) (Fußball), Google News (RSS), [abalin.net](https://nameday.abalin.net) (Namenstage) und die Schnittstellen von laut.fm, Icecast und Shoutcast. Bitte die Nutzungsbedingungen der jeweiligen Dienste beachten.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Verbesserungen und Pull Requests sind willkommen.
