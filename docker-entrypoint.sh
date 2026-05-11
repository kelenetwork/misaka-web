#!/bin/sh
set -e
DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
chown -R nextjs:nodejs "$DATA_DIR"
exec su-exec nextjs:nodejs "$@"
