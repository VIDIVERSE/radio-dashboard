#!/bin/sh
# Radio-Dashboard starten (Linux / macOS). Benötigt Python 3.8 oder neuer.
cd "$(dirname "$0")" && exec python3 server.py "$@"
