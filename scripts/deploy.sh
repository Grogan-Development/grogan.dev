#!/bin/sh
# Deploy Nero to Grid-01 so a browser reload previews current main.
#
# Default: everything needed for a preview — web bundle, host landlord,
# Caddy config, guest image, and in-place recreation of running workspaces
# so they pick up the new image and tokens.
#
# Usage:
#   scripts/deploy.sh            # web + host + caddy + image + recreate
#   scripts/deploy.sh --no-image # skip the guest image rebuild (web/host only)
#
# What it does, in order:
#   1. rsync the repo to grid-01:/opt/nero/src (server builds from this tree)
#   2. pnpm build locally; rsync apps/web/dist → /var/lib/nero/web
#   3. go build the host on grid-01; install + restart nero-host
#   4. install deploy/Caddyfile (validated) + reload caddy
#   5. docker build the guest image (tag nero-guest:v1)
#   6. recreate running workspace containers via apps/host cmd/recreate-ws
#      (datasets survive; the landlord re-adopts them)
#
# Run from the repo root on a machine with SSH access to grid-01.
set -eu

HOST_ALIAS=${NERO_DEPLOY_HOST:-grid-01}
REMOTE_ROOT=${NERO_DEPLOY_ROOT:-/opt/nero/src}
WITH_IMAGE=1
for arg in "$@"; do
  case "$arg" in
    --no-image) WITH_IMAGE=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

echo "==> sync repo → $HOST_ALIAS:$REMOTE_ROOT"
rsync -az --delete \
  --exclude .git --exclude node_modules --exclude target \
  --exclude 'apps/web/dist' --exclude '.env' --exclude '.env.*' \
  ./ "$HOST_ALIAS:$REMOTE_ROOT/"

echo "==> build + ship web"
pnpm build >/dev/null
rsync -az --delete --exclude '.DS_Store' apps/web/dist/ "$HOST_ALIAS:/var/lib/nero/web/"

echo "==> build + restart host"
ssh "$HOST_ALIAS" "cd $REMOTE_ROOT/apps/host \
  && go build -o /tmp/nero-host.new ./cmd/nero-host \
  && install -m 0755 /tmp/nero-host.new /usr/local/bin/nero-host \
  && cp $REMOTE_ROOT/deploy/nero-host.service /etc/systemd/system/nero-host.service \
  && cp $REMOTE_ROOT/deploy/tmpfiles/nero-host.conf /etc/tmpfiles.d/nero-host.conf \
  && systemd-tmpfiles --create /etc/tmpfiles.d/nero-host.conf \
  && systemctl daemon-reload && systemctl restart nero-host"

echo "==> caddy"
ssh "$HOST_ALIAS" "cp $REMOTE_ROOT/deploy/Caddyfile /etc/caddy/Caddyfile \
  && caddy validate --config /etc/caddy/Caddyfile >/dev/null \
  && systemctl reload caddy"

if [ "$WITH_IMAGE" = "1" ]; then
  echo "==> guest image (this is the slow part)"
  ssh "$HOST_ALIAS" "cd $REMOTE_ROOT && docker build -f guest/Dockerfile -t nero-guest:v1 . >/tmp/image-build.log 2>&1 \
    && echo 'image built' || { tail -20 /tmp/image-build.log; exit 1; }"

  echo "==> recreate running workspaces (in place; datasets survive)"
  ssh "$HOST_ALIAS" "cd $REMOTE_ROOT/apps/host \
    && IDS=\$(docker ps --format '{{.Names}}' | grep '^nero-ws-' | sed 's/^nero-ws-//') \
    && ARGS=\$(for id in \$IDS; do echo \"\$id:workspace-\${id:0:4}\"; done) \
    && [ -n \"\$IDS\" ] && go run ./cmd/recreate-ws \$ARGS || echo 'no running workspaces'"
fi

echo "==> done. Reload nero.grogan.dev to preview."
