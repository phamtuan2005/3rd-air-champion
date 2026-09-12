#!/usr/bin/env bash
#
# Is the backend actually answering? If not, restart it.
#
# Written after 2026-09-12, when the API was down for about two hours and
# nothing said so. pm2 reported the app "online" with pid: N/A -- it had
# re-registered the process without ever starting one, so every route returned
# a CloudFront 504 while every dashboard looked healthy. The house found out
# because a guest could not open TiBook.
#
# The lesson is narrow and worth stating: "pm2 says online" is not a health
# check. The only honest question is whether an HTTP request gets an answer,
# which is what this asks.
#
# Install (on the box):
#   chmod +x ~/3rd-air-champion/3rd-air-champion-backend/scripts/watchdog.sh
#   crontab -e     # add:
#   */5 * * * * /home/ubuntu/3rd-air-champion/3rd-air-champion-backend/scripts/watchdog.sh
#
# It writes to ~/watchdog.log and says nothing anywhere else, so a quiet log is
# the good case.

set -u

URL="http://localhost:8080/"
APP="backend"
ENTRY="$HOME/3rd-air-champion/3rd-air-champion-backend/dist/server.js"
LOG="$HOME/watchdog.log"
STAMP="$HOME/.watchdog-last-restart"
# Long enough that a genuinely broken build is not restarted every five minutes
# for ever. If it is still down after this, it needs a person, not another
# restart.
COOLDOWN_SECONDS=900

# cron runs with a bare PATH and no fnm, so neither `node` nor `pm2` is on it --
# which is the same class of fault this script exists to recover from. Borrowing
# the login shell's PATH is what makes the restart below actually work.
PATH="$(bash -lc 'echo $PATH' 2>/dev/null || echo "$PATH")"
export PATH

log() { printf '%s  %s\n' "$(date -Is)" "$*" >>"$LOG"; }

answers() { curl -sf -o /dev/null --max-time 10 "$URL"; }

answers && exit 0

# One retry before doing anything drastic: a single missed request during a
# deploy or a garbage-collection pause is not an outage.
sleep 5
if answers; then
  log "missed one check, answered on retry -- left alone"
  exit 0
fi

now=$(date +%s)
last=0
[ -f "$STAMP" ] && last=$(cat "$STAMP" 2>/dev/null || echo 0)
if [ $((now - last)) -lt "$COOLDOWN_SECONDS" ]; then
  log "still not answering, but restarted $((now - last))s ago -- NEEDS A HUMAN"
  exit 0
fi

log "no answer from $URL -- restarting $APP"
echo "$now" >"$STAMP"

# Both, and by absolute path. A missing binary here is the same class of fault
# as the outage itself, and without these checks the script logs three
# "command not found" lines and then reports that it restarted something.
node_bin="$(command -v node || true)"
pm2_bin="$(command -v pm2 || true)"
if [ -z "$node_bin" ] || [ -z "$pm2_bin" ]; then
  log "cannot restart: node=${node_bin:-MISSING} pm2=${pm2_bin:-MISSING} -- NEEDS A HUMAN"
  exit 1
fi

# --interpreter with the ABSOLUTE path, for the reason the outage happened: the
# pm2 daemon does not inherit fnm's PATH, so a start without it registers an app
# the daemon can never actually run.
"$pm2_bin" delete "$APP" >>"$LOG" 2>&1
"$pm2_bin" start "$ENTRY" --name "$APP" --interpreter "$node_bin" >>"$LOG" 2>&1
"$pm2_bin" save >>"$LOG" 2>&1

sleep 10
if answers; then
  log "back up"
else
  log "STILL DOWN after a restart -- NEEDS A HUMAN"
fi
