#!/bin/bash
# Entrypoint script: ensure writable directories exist inside
# the Docker volume mount before starting the application.
set -e

mkdir -p /app/artifacts/user_media/avatars \
         /app/artifacts/user_media/org_avatars \
         /app/artifacts/user_media/team_avatars \
  2>/dev/null || true

exec "$@"
