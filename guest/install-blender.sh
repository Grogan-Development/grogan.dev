#!/bin/sh
# Download the official Blender Linux x64 tarball into /opt/blender.
# Do not vendor the archive in git (~366 MiB).
#
# Official URL (LTS 5.2.1, 2026-08-25):
#   https://download.blender.org/release/Blender5.2/blender-5.2.1-linux-x64.tar.xz
# SHA256:
#   a31f524fa99a527d3d52b7f5aaa68c34e1a19d5a1c9473f79c5cc610fd5b10e9
set -eu

VERSION="${BLENDER_VERSION:-5.2.1}"
MAJOR=$(echo "$VERSION" | cut -d. -f1,2)
URL="${BLENDER_URL:-https://download.blender.org/release/Blender${MAJOR}/blender-${VERSION}-linux-x64.tar.xz}"
SHA256="${BLENDER_SHA256:-a31f524fa99a527d3d52b7f5aaa68c34e1a19d5a1c9473f79c5cc610fd5b10e9}"
PREFIX="${PREFIX:-/opt/blender}"
BINDIR="${BINDIR:-/usr/local/bin}"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "fetching $URL"
curl -fL "$URL" -o "$tmpdir/blender.tar.xz"
echo "$SHA256  $tmpdir/blender.tar.xz" | sha256sum -c

parent=$(dirname "$PREFIX")
mkdir -p "$parent"
rm -rf "$PREFIX"
tar -xJf "$tmpdir/blender.tar.xz" -C "$parent"
extracted="$parent/blender-${VERSION}-linux-x64"
if [ ! -d "$extracted" ]; then
  echo "install-blender: expected $extracted after extract" >&2
  exit 1
fi
mv "$extracted" "$PREFIX"
mkdir -p "$BINDIR"
ln -sfn "$PREFIX/blender" "$BINDIR/blender"
echo "installed $PREFIX (symlink $BINDIR/blender)"
