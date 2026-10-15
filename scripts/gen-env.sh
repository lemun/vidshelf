#!/usr/bin/env bash
# Writes .env at the repo root with freshly generated secrets, using .env.example as the template.
# docker compose (variable substitution) and `npm run dev` (the API's ConfigModule) both read it.
# The file is git-ignored and readable only by you. Refuses to overwrite an existing .env unless
# --force is given (that would log out every user and change the MinIO root password, which an
# existing MinIO data volume would no longer accept).
#
# Usage: scripts/gen-env.sh [--force]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
template="$root/.env.example"
target="$root/.env"

if [[ -e "$target" && "${1:-}" != "--force" ]]; then
  echo ".env already exists; keeping it. Use --force to replace it." >&2
  exit 1
fi

random_hex() { # $1 = bytes
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    node -e "process.stdout.write(require('node:crypto').randomBytes(+process.argv[1]).toString('hex'))" "$1"
  fi
}

access_secret="$(random_hex 32)"
refresh_secret="$(random_hex 32)"
minio_user="vidshelf-$(random_hex 6)"
minio_password="$(random_hex 24)"

tmp="$(mktemp "$root/.env.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    JWT_ACCESS_SECRET=*) echo "JWT_ACCESS_SECRET=$access_secret" ;;
    JWT_REFRESH_SECRET=*) echo "JWT_REFRESH_SECRET=$refresh_secret" ;;
    MINIO_ACCESS_KEY=*) echo "MINIO_ACCESS_KEY=$minio_user" ;;
    MINIO_SECRET_KEY=*) echo "MINIO_SECRET_KEY=$minio_password" ;;
    *) echo "$line" ;;
  esac
done <"$template" >"$tmp"

for key in JWT_ACCESS_SECRET JWT_REFRESH_SECRET MINIO_ACCESS_KEY MINIO_SECRET_KEY; do
  if ! grep -Eq "^$key=.+" "$tmp"; then
    echo "$key is missing from .env.example; cannot generate it" >&2
    exit 1
  fi
done
mv "$tmp" "$target"
trap - EXIT
echo "Wrote $target with new JWT secrets and MinIO root credentials (mode 600)."
echo "MinIO console user: $minio_user (the password is MINIO_SECRET_KEY in .env)."
