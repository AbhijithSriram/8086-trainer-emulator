#!/usr/bin/env bash
#
# Install the 8086 trainer emulator as a system service on homeserver.
#
#   sudo bash /home/abhijith/8086-emulator/deploy/install.sh
#
# Idempotent: safe to re-run. It touches exactly two things --
#
#   /etc/systemd/system/8086-emulator.service
#   /etc/cloudflared/config.yml   ONE ingress rule appended, backed up first
#
# It does not touch cockpit, chat, ammas-codex, locomotion-transitops or
# voice-lab.

set -euo pipefail

APP_USER=abhijith
APP_DIR=/home/abhijith/8086-emulator
HOSTNAME_FQDN=8086-emulator.abhijith-sriram.in
PORT=8086
CF_CONFIG=/etc/cloudflared/config.yml

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run this with sudo"
[ -d "$APP_DIR" ]    || die "$APP_DIR does not exist -- clone the repo first"

# ---------------------------------------------------------------- 1. packages
if python3 -m venv --help >/dev/null 2>&1; then
    say "python venv support present"
else
    say "Installing python venv support"
    apt-get update -qq
    apt-get install -y python3-venv python3-dev \
        || apt-get install -y "python$(python3 -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")')-venv" python3-dev \
        || die "could not install venv support"
fi

# ------------------------------------------------------------------- 2. venv
say "Building the virtualenv (as $APP_USER)"
sudo -u "$APP_USER" bash -c "
    set -e
    cd '$APP_DIR'
    [ -d .venv ] || python3 -m venv .venv
    .venv/bin/pip install --quiet --upgrade pip wheel
    .venv/bin/pip install --quiet -r requirements.txt
    .venv/bin/python -c 'import flask, flask_cors, gunicorn; print(\"deps OK\")'
"

# -------------------------------------------------------------- 3. systemd
say "Installing the service"
install -m 0644 "$APP_DIR/deploy/8086-emulator.service" /etc/systemd/system/8086-emulator.service
systemctl daemon-reload
systemctl enable 8086-emulator >/dev/null
systemctl restart 8086-emulator

sleep 3
systemctl is-active --quiet 8086-emulator || {
    journalctl -u 8086-emulator -n 30 --no-pager
    die "8086-emulator did not stay up (log above)"
}
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" || die "nothing answering on 127.0.0.1:$PORT"
say "Service is up and answering on 127.0.0.1:$PORT"

# ------------------------------------------------------------ 4. cloudflared
if grep -q "$HOSTNAME_FQDN" "$CF_CONFIG"; then
    say "Tunnel already routes $HOSTNAME_FQDN -- config left untouched"
else
    say "Adding one ingress rule to the existing tunnel"
    BACKUP="$CF_CONFIG.bak.$(date +%Y%m%d-%H%M%S)"
    cp -a "$CF_CONFIG" "$BACKUP"
    echo "    backup: $BACKUP"

    # Insert immediately before the catch-all -- Cloudflare matches ingress
    # rules top to bottom and http_status:404 matches everything, so a rule
    # appended after it would be dead.
    awk -v host="$HOSTNAME_FQDN" -v port="$PORT" '
        !done && /^[[:space:]]*-[[:space:]]*service:[[:space:]]*http_status:404/ {
            print "  - hostname: " host
            print "    service: http://localhost:" port
            done = 1
        }
        { print }
        END { if (!done) exit 3 }
    ' "$BACKUP" > "$CF_CONFIG" || die "no catch-all rule found -- $CF_CONFIG restored from $BACKUP"

    # `--config` is a flag on `tunnel`, not on `ingress validate`. Put it in
    # the wrong place and cloudflared prints "Incorrect Usage" and still
    # exits 0, so the check passes without having validated anything.
    if ! cloudflared tunnel --config "$CF_CONFIG" ingress validate; then
        cp -a "$BACKUP" "$CF_CONFIG"
        die "ingress validation failed -- $CF_CONFIG rolled back, tunnel untouched"
    fi

    say "Reloading cloudflared"
    systemctl restart cloudflared
    sleep 3
    systemctl is-active --quiet cloudflared || {
        cp -a "$BACKUP" "$CF_CONFIG"
        systemctl restart cloudflared
        die "cloudflared would not start -- config rolled back and restarted"
    }
fi

say "Done"
echo
echo "  https://$HOSTNAME_FQDN"
echo
echo "  Logs:    journalctl -u 8086-emulator -f"
echo "  Restart: sudo systemctl restart 8086-emulator"
echo
