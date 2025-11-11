#!/bin/sh
set -e

# PUID/PGID Support for Unraid
# This script ensures the application runs with the correct user/group permissions

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting Medicine Man Backend with PUID=${PUID} and PGID=${PGID}"

# Get or create group
if getent group "${PGID}" > /dev/null 2>&1; then
  GROUP_NAME=$(getent group "${PGID}" | cut -d: -f1)
  echo "Using existing group '${GROUP_NAME}' with GID ${PGID}"
else
  echo "Creating appgroup with GID ${PGID}"
  addgroup -g "${PGID}" appgroup
  GROUP_NAME="appgroup"
fi

# Get or create user
if getent passwd "${PUID}" > /dev/null 2>&1; then
  USER_NAME=$(getent passwd "${PUID}" | cut -d: -f1)
  echo "Using existing user '${USER_NAME}' with UID ${PUID}"
else
  echo "Creating appuser with UID ${PUID}"
  adduser -D -u "${PUID}" -G "${GROUP_NAME}" appuser
  USER_NAME="appuser"
fi

# Create directories if they don't exist and fix permissions
mkdir -p /app/logs /app/backups /app/db-backups

echo "Setting ownership of /app to ${USER_NAME}:${GROUP_NAME}"
chown -R "${PUID}:${PGID}" /app/logs /app/backups /app/db-backups

# If we're running as root, switch to the target user
if [ "$(id -u)" = "0" ]; then
  echo "Switching to ${USER_NAME} (UID ${PUID})"
  exec su-exec "${USER_NAME}" "$@"
else
  echo "Already running as non-root user"
  exec "$@"
fi
