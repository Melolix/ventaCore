#!/bin/bash
# ============================================================
#  VentaCore — Script de deploy
#  Ejecutar desde el servidor como usuario 'ubuntu'.
#  Uso: bash deploy.sh
# ============================================================
set -euo pipefail

APP_DIR="/home/ubuntu/ventacore"
REPO_URL="${1:-}"

echo "══════════════════════════════════════"
echo "  VentaCore — Deploy"
echo "══════════════════════════════════════"

# ── 1. Obtener código ──
if [ ! -d "$APP_DIR/.git" ]; then
    if [ -z "$REPO_URL" ]; then
        echo "Error: Primera vez. Pasar la URL del repo como argumento:"
        echo "  bash deploy.sh https://github.com/tu-usuario/ventacore.git"
        exit 1
    fi
    echo "[1/5] Clonando repositorio..."
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "[1/5] Actualizando código..."
    cd "$APP_DIR"
    git pull origin main
fi

cd "$APP_DIR"

# ── 2. Verificar .env.production ──
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo ""
    echo "  ⚠ No existe .env.production"
    echo "  Copia el template y configura las variables:"
    echo "    cp .env.production.template .env.production"
    echo "    nano .env.production"
    echo ""
    exit 1
fi

# ── 3. Instalar dependencias ──
# tsc y vite son devDependencies: con --omit=dev el build no las encuentra.
# Se instala todo, se compila, y al final se podan las de desarrollo.
echo "[2/5] Instalando dependencias..."
npm ci

# ── 4. Build ──
echo "[3/5] Construyendo proyecto..."
# Cargar variables de entorno para el build del frontend
set -a
source .env.production
set +a

# Node dimensiona el heap según la RAM física, que en una instancia chica
# queda por debajo de lo que necesita el build. Con swap activo podemos
# pedirle más sin que el kernel lo mate. Requiere haber corrido setup-swap.sh.
export NODE_OPTIONS="--max-old-space-size=2048"

# Build shared: la API compilada lo carga como paquete (require), no por
# tsconfig-paths, así que necesita el JS emitido en packages/shared/lib.
cd packages/shared
npx tsc -p tsconfig.json
cd "$APP_DIR"

# Build API (TypeScript -> JavaScript)
cd packages/api
npx tsc -p tsconfig.json
cd "$APP_DIR"

# Build Frontend (Vite)
cd packages/frontend
npx vite build --mode production
cd "$APP_DIR"

# El heap grande era solo para el build; la API corre con el default.
unset NODE_OPTIONS

# Ya compilamos: las devDependencies no hacen falta en runtime y ocupan
# disco y RAM. Podarlas deja el server liviano.
echo "[3/5] Podando dependencias de desarrollo..."
npm prune --omit=dev

# ── 5. Configurar Nginx ──
echo "[4/5] Configurando Nginx..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ventacore
sudo ln -sf /etc/nginx/sites-available/ventacore /etc/nginx/sites-enabled/ventacore
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# ── 6. Reiniciar API con PM2 ──
echo "[5/5] Reiniciando API..."
# Cargar .env.production en PM2
pm2 delete ventacore-api 2>/dev/null || true
cd "$APP_DIR"
set -a
source .env.production
set +a
pm2 start deploy/ecosystem.config.js
pm2 save

echo ""
echo "══════════════════════════════════════"
echo "  Deploy completado!"
echo "  Frontend: http://$(curl -s ifconfig.me)"
echo "  API:      http://$(curl -s ifconfig.me)/api"
echo "  API Docs: http://$(curl -s ifconfig.me)/api/docs"
echo "══════════════════════════════════════"
