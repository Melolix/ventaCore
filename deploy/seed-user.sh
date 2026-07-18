#!/bin/bash
# ============================================================
#  VentaCore — Crear un usuario en PRODUCCIÓN
#  Lo crea en Firebase Auth y en Postgres (resuelve el
#  huevo-y-la-gallina del primer superadmin).
#
#  Uso (desde la raíz del proyecto, después de deploy.sh):
#    bash deploy/seed-user.sh <email> <password> [rol]
#
#  El rol por defecto es "superadmin". Roles: superadmin | admin | user.
#  Ej: bash deploy/seed-user.sh jefa@empresa.com 'Passw0rd-fuerte' superadmin
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED_JS="$ROOT/packages/api/lib/api/src/seed.js"

if [ $# -lt 2 ]; then
    echo "Uso: bash deploy/seed-user.sh <email> <password> [rol]"
    echo "     rol: superadmin (default) | admin | user"
    exit 1
fi

if [ ! -f "$ROOT/.env.production" ]; then
    echo "Error: no existe $ROOT/.env.production"
    exit 1
fi

# El seed compilado sale del build de la API (deploy.sh). Usamos el JS, no
# ts-node: deploy.sh poda las devDependencies y ts-node ya no está.
if [ ! -f "$SEED_JS" ]; then
    echo "Error: no existe $SEED_JS"
    echo "Compilá primero: bash deploy/deploy.sh"
    exit 1
fi

# Mismo criterio que ecosystem.config.js: las variables salen del .env.production.
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.production"
set +a

cd "$ROOT/packages/api"
node "$SEED_JS" "$@"
