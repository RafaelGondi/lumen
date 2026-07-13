#!/bin/bash
# Executado no droplet pelo deploy.sh
set -euo pipefail

APP_DIR="/app"
PACKAGE="lumen-output.tgz"
DB_PACKAGE="lumen-db.tgz"
STAMP="${STAMP:-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$APP_DIR/backups" "$APP_DIR/.data"

if [ -d "$APP_DIR/.output" ]; then
  tar -czf "$APP_DIR/backups/lumen-output-$STAMP.tgz" -C "$APP_DIR" .output || true
fi
if [ -f "$APP_DIR/data/financeiro.db" ]; then
  cp "$APP_DIR/data/financeiro.db" "$APP_DIR/backups/financeiro-$STAMP.db"
fi

# better-sqlite3 nativo (Linux)
if [ ! -d /tmp/lumen-native/node_modules/better-sqlite3 ]; then
  rm -rf /tmp/lumen-native
  mkdir -p /tmp/lumen-native
  cd /tmp/lumen-native
  npm init -y >/dev/null
  npm install better-sqlite3@12.11.1 --omit=dev
fi

rm -rf "$APP_DIR/.output_new" "$APP_DIR/.output_prev"
mkdir -p "$APP_DIR/.output_new"
tar -xzf "$APP_DIR/$PACKAGE" -C "$APP_DIR/.output_new"
test -f "$APP_DIR/.output_new/.output/server/index.mjs"

if [ -d "$APP_DIR/.output" ]; then
  mv "$APP_DIR/.output" "$APP_DIR/.output_prev"
fi
mv "$APP_DIR/.output_new/.output" "$APP_DIR/.output"
rm -rf "$APP_DIR/.output_new" "$APP_DIR/$PACKAGE"

mkdir -p "$APP_DIR/.output/server/node_modules"
rm -rf "$APP_DIR/.output/server/node_modules/better-sqlite3"
cp -a /tmp/lumen-native/node_modules/better-sqlite3 "$APP_DIR/.output/server/node_modules/"

if [ -f "$APP_DIR/$DB_PACKAGE" ]; then
  echo "Aplicando pacote de banco (somente quando enviado explicitamente)..."
  # Para o app antes de trocar o SQLite para não deixar -wal/-shm órfãos.
  pm2 stop financas >/dev/null 2>&1 || true
  if [ -f "$APP_DIR/.data/lumen.sqlite3" ]; then
    cp "$APP_DIR/.data/lumen.sqlite3" "$APP_DIR/backups/lumen-$STAMP.sqlite3" || true
  fi
  rm -f \
    "$APP_DIR/.data/lumen.sqlite3" \
    "$APP_DIR/.data/lumen.sqlite3-wal" \
    "$APP_DIR/.data/lumen.sqlite3-shm"
  tar -xzf "$APP_DIR/$DB_PACKAGE" -C "$APP_DIR/.data"
  rm -f "$APP_DIR/$DB_PACKAGE"
else
  echo "Nenhum pacote de banco enviado — SQLite de producao preservado."
fi

# Deploy de app nunca cria o banco; ele precisa ja existir em producao.
test -f "$APP_DIR/.data/lumen.sqlite3"

cd "$APP_DIR"
pm2 delete financas >/dev/null 2>&1 || true
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save

sleep 2
curl -s -o /dev/null -w "home:%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "api:%{http_code}\n" http://127.0.0.1:3000/api/cards
