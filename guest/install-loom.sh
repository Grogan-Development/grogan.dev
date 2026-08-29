#!/bin/sh
# Install the Loom CLI (the loomd HTTP client) into /usr/local/bin.
#
# Nero workspaces are git customers of Loom (the git/repo server on this
# host, loom.grogan.dev): clones go over /git/<project>/<repo>.git and
# feature/candidate/event work goes through the CLI. Do not vendor the
# binary in git; fetch a pinned release tarball.
#
# Expected artifact layout: a .tar.gz containing one `loom` binary
# (linux-x64, built by the loom repo's Dockerfile toolchain).
#
# Runtime auth (never baked into the image): the CLI reads LOOM_URL and
# LOOM_TOKEN from the environment (see guest/export-container-env).
#
# Default: on, pinned to the v0.1.0 release (see the LOOM_CLI_* args in the
# Dockerfile). Bump the version + SHA256 together when a new release is cut.
set -eu

VERSION="${LOOM_CLI_VERSION:-v0.1.0}"
URL="${LOOM_CLI_URL:-https://github.com/Grogan-Development/loom/releases/download/${VERSION}/loom-cli-${VERSION}-linux-x64.tar.gz}"
SHA256="${LOOM_CLI_SHA256:-}"
BINDIR="${BINDIR:-/usr/local/bin}"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "fetching $URL"
curl -fL "$URL" -o "$tmpdir/loom-cli.tar.gz"

if [ -z "$SHA256" ]; then
  echo "LOOM_CLI_SHA256 is not set; refusing to install an unverified binary." >&2
  echo "Pin the release tarball's sha256 (or set LOOM_CLI_ALLOW_UNVERIFIED=1 for a throwaway build)." >&2
  exit 1
fi
if [ "${LOOM_CLI_ALLOW_UNVERIFIED:-0}" = "1" ]; then
  echo "WARNING: skipping loom-cli checksum verification (throwaway build only)" >&2
else
  echo "$SHA256  $tmpdir/loom-cli.tar.gz" | sha256sum -c
fi

tar -xzf "$tmpdir/loom-cli.tar.gz" -C "$tmpdir"
if [ ! -f "$tmpdir/loom" ]; then
  echo "loom-cli tarball does not contain a top-level 'loom' binary" >&2
  exit 1
fi
install -m 0755 "$tmpdir/loom" "$BINDIR/loom"

# Loom protected refs are `refs/main` by convention; make fresh clones and
# `git init` inside workspaces match instead of Debian's master default.
git config --system init.defaultBranch main

echo "installed $BINDIR/loom ($VERSION)"
