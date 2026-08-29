# Nero workspace guest: Debian 13 (trixie) + systemd.
# No T3 server. No Docker-in-Docker.
#
# Seat: KasmVNC is an X11 server (Xvnc). cage/weston are Wayland and cannot
# attach. Smallest working compositor is openbox on that Xvnc (Xvnc replaces
# Xvfb). Chromium is nero-chromium.service; Blender is the official tarball
# (see guest/install-blender.sh), not a git blob. The Loom CLI
# (guest/install-loom.sh) is the git-customer client for loom.grogan.dev;
# it stays off until its first pinned release exists.
#
# Host landlord (PR 10) docker create:
#   --publish 127.0.0.1::8787
#   --tmpfs /tmp --tmpfs /run --tmpfs /run/lock
#   --shm-size=1g
#   --stop-signal SIGRTMIN+3
#   --mount type=bind,source=/var/lib/nero/ws/<id>,target=/home/nero
#   cgroup memory/cpu from workspace-lifecycle.md
# Host then binds /run/nero/w/<id>.sock → 127.0.0.1:<published>:8787 for Caddy.
#
# Build from repo root: docker build -f guest/Dockerfile .
# Skip the Blender fetch: --build-arg INSTALL_BLENDER=0
# Loom CLI is off by default (no pinned release yet): --build-arg INSTALL_LOOM=1
#
# debian:trixie is left unpinned so trixie security updates flow; pin a
# digest on Grid-01 when the landlord freezes the image. KasmVNC and
# Blender tarball SHAs are pinned below.

FROM node:24-bookworm AS daemon
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vite.config.ts ./
COPY patches ./patches
COPY packages ./packages
COPY apps/daemon ./apps/daemon
COPY apps/web/package.json ./apps/web/package.json
COPY scripts ./scripts
RUN pnpm install --filter @nero/daemon... --frozen-lockfile --ignore-scripts \
 && pnpm --filter @nero/daemon rebuild node-pty \
 && pnpm --filter @nero/daemon build \
 && mkdir -p /out/node_modules \
 && cp apps/daemon/dist/main.js /out/main.js \
# ssr.noExternal bundles every dep except node-pty, which is native and copied:
 && node --input-type=module -e "\
import { createRequire } from 'node:module';\
import fs from 'node:fs';\
import path from 'node:path';\
const require = createRequire('/src/apps/daemon/package.json');\
const pkg = path.dirname(require.resolve('node-pty/package.json'));\
fs.cpSync(pkg, '/out/node_modules/node-pty', { recursive: true });"

FROM debian:trixie

ENV container=docker \
    DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    DISPLAY=:1 \
    NERO_SEAT_LOCK=/run/nero/seat.lock

STOPSIGNAL SIGRTMIN+3

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      systemd systemd-sysv dbus dbus-user-session libpam-systemd \
      python3 python3-pip python3-venv \
      openbox \
      xdotool scrot \
      x11-utils x11-xserver-utils xauth \
      chromium \
      fonts-liberation fonts-dejavu-core \
      libgl1 libgl1-mesa-dri mesa-vulkan-drivers \
      libx11-6 libxext6 libxi6 libxrender1 libxfixes3 libxxf86vm1 \
      libxkbcommon0 libsm6 libice6 \
      ca-certificates curl xz-utils bzip2 \
      procps ssl-cert util-linux libstdc++6 \
      # The daemon shells out to git for checkpoints and vcs status; replaced
      # by the planned native git solution later.
      git \
      # Agent workstation toolchain (build/test/run without micromamba dances).
      build-essential pkg-config ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Units that fight the container (udev, getty, resolved overwriting Docker DNS).
RUN systemctl mask \
      systemd-udevd.service \
      systemd-udevd-kernel.socket \
      systemd-udevd-control.socket \
      systemd-firstboot.service \
      systemd-resolved.service \
      systemd-networkd-wait-online.service \
      getty@.service \
      console-getty.service

# Dataset mount point at runtime. Seed files live under /usr and /etc, not here.
RUN groupadd --gid 1000 nero \
 && useradd --uid 1000 --gid 1000 --create-home --home-dir /home/nero \
      --shell /bin/bash --no-log-init nero \
 && usermod -aG ssl-cert,audio,video nero \
 && install -d -o nero -g nero -m 0755 /etc/nero \
 && install -d /var/lib/systemd/linger \
 && touch /var/lib/systemd/linger/nero \
 && printf '%s\n' \
      'd /run/nero 0755 nero nero -' \
      'C /home/nero/.kasmpasswd 0600 nero nero - /etc/nero/kasmpasswd' \
      'd /home/nero/.vnc 0700 nero nero -' \
      'f /home/nero/.vnc/.de-was-selected 0644 nero nero -' \
      > /etc/tmpfiles.d/nero.conf \
 && mkdir -p /etc/xdg/openbox /etc/chromium.d /usr/lib/nero \
 && printf '%s\n' \
      'export DISPLAY=:1' \
      'export NERO_SEAT_LOCK=/run/nero/seat.lock' \
      'export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"' \
      'export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"' \
      > /etc/profile.d/nero.sh

# KasmVNC 1.5.0 ships a Debian trixie deb. Pin sha256.
ARG KASMVNC_VERSION=1.5.0
ARG KASMVNC_DEB=kasmvncserver_trixie_1.5.0_amd64.deb
ARG KASMVNC_SHA256=80b241de7dfe53bba2b7e1cc5ac8c5246d72271efa16be2d4f76607f30fab1c4
RUN curl -fL -o /tmp/kasmvnc.deb \
      "https://github.com/kasmtech/KasmVNC/releases/download/v${KASMVNC_VERSION}/${KASMVNC_DEB}" \
 && echo "${KASMVNC_SHA256}  /tmp/kasmvnc.deb" | sha256sum -c \
 && apt-get update \
 && apt-get install -y --no-install-recommends /tmp/kasmvnc.deb \
 && rm -f /tmp/kasmvnc.deb \
 && rm -rf /var/lib/apt/lists/* \
 && runuser -u nero -- env HOME=/home/nero \
      sh -c 'printf "nero-vm-seat\nnero-vm-seat\n" | kasmvncpasswd -u nero -w' \
 && cp /home/nero/.kasmpasswd /etc/nero/kasmpasswd \
 && chown nero:nero /etc/nero/kasmpasswd \
 && chmod 600 /etc/nero/kasmpasswd

COPY guest/install-blender.sh /usr/lib/nero/install-blender.sh
ARG INSTALL_BLENDER=1
RUN chmod 0755 /usr/lib/nero/install-blender.sh \
 && if [ "$INSTALL_BLENDER" = 1 ]; then /usr/lib/nero/install-blender.sh; fi

COPY guest/install-loom.sh /usr/lib/nero/install-loom.sh
ARG INSTALL_LOOM=0
RUN chmod 0755 /usr/lib/nero/install-loom.sh \
 && if [ "$INSTALL_LOOM" = 1 ]; then /usr/lib/nero/install-loom.sh; fi

COPY guest/seat/kasmvnc.yaml /etc/kasmvnc/kasmvnc.yaml
COPY guest/seat/wait-for-display /usr/lib/nero/wait-for-display
COPY guest/seat/seed-home /usr/lib/nero/seed-home
COPY guest/seat/openbox-startup /usr/lib/nero/openbox-startup
COPY guest/seat/openbox-autostart /etc/xdg/openbox/autostart
COPY guest/seat/chromium-flags /etc/chromium.d/nero
COPY guest/seat/nero-desktop /usr/local/bin/nero-desktop
COPY guest/nero-run /usr/local/bin/nero-run
COPY guest/systemd/kasmvnc.service /etc/systemd/system/kasmvnc.service
COPY guest/systemd/nero-seat.service /etc/systemd/system/nero-seat.service
COPY guest/systemd/nero-chromium.service /etc/systemd/system/nero-chromium.service
COPY guest/systemd/nero-daemon.service /etc/systemd/system/nero-daemon.service
COPY guest/systemd/nero-container-env.service /etc/systemd/system/nero-container-env.service
COPY guest/systemd/user/nero-job.slice /etc/systemd/user/nero-job.slice
COPY guest/export-container-env /usr/lib/nero/export-container-env
COPY guest/nero-daemon /usr/local/bin/nero-daemon
COPY --from=daemon /usr/local/bin/node /usr/local/bin/node
COPY --from=daemon /out/main.js /usr/lib/nero/daemon/main.js
COPY --from=daemon /out/node_modules /usr/lib/nero/daemon/node_modules

RUN chmod 0755 \
      /usr/lib/nero/wait-for-display \
      /usr/lib/nero/seed-home \
      /usr/lib/nero/openbox-startup \
      /usr/local/bin/nero-desktop \
      /usr/local/bin/nero-run \
      /usr/local/bin/nero-daemon \
      /usr/local/bin/node \
      /usr/lib/nero/export-container-env \
 && find /usr/lib/nero/daemon/node_modules/node-pty -type f -name 'spawn-helper' -exec chmod 0755 {} + \
 && systemctl enable kasmvnc.service nero-seat.service nero-chromium.service nero-container-env.service nero-daemon.service user@1000.service \
 && rm -f /etc/machine-id \
 && touch /etc/machine-id

WORKDIR /home/nero
CMD ["/usr/lib/systemd/systemd"]
