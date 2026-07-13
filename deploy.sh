#!/bin/bash
# Deploy Lumen → droplet (substitui gestao-financeira em /app)
# Uso (Git Bash / WSL com chave SSH do Windows):
#   bash deploy.sh              → só app (NÃO mexe no banco de produção)
#   bash deploy.sh --with-db    → app + sobrescreve o SQLite de produção com o local
# Se scp falhar por chave, rode via PowerShell: .\deploy.ps1

set -euo pipefail

SERVER="root@137.184.195.81"
APP_DIR="/app"
PACKAGE="lumen-output.tgz"
DB_PACKAGE="lumen-db.tgz"
SSH_OPTS="-o PreferredAuthentications=publickey -o PasswordAuthentication=no -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
STAMP="$(date +%Y%m%d-%H%M%S)"
SYNC_DB=0

for arg in "$@"; do
  case "$arg" in
    --with-db) SYNC_DB=1 ;;
    *)
      echo "Uso: bash deploy.sh [--with-db]"
      exit 1
      ;;
  esac
done

echo "Buildando Lumen..."
npm run build

echo "Verificando bundle..."
test -f ".output/server/index.mjs"

echo "Empacotando..."
rm -f "$PACKAGE" "$DB_PACKAGE"
tar -czf "$PACKAGE" .output

if [ "$SYNC_DB" -eq 1 ]; then
  if [ ! -f ".data/lumen.sqlite3" ]; then
    echo "Sync DB pedido, mas .data/lumen.sqlite3 nao existe" >&2
    exit 1
  fi
  echo "ATENCAO: --with-db ativo — o banco local vai sobrescrever producao."
  tar -czf "$DB_PACKAGE" -C .data lumen.sqlite3
else
  echo "Banco de producao sera preservado (use --with-db so se pedir explicitamente)."
fi

echo "Enviando para o servidor..."
scp $SSH_OPTS "$PACKAGE" "$SERVER:$APP_DIR/$PACKAGE"
if [ "$SYNC_DB" -eq 1 ] && [ -f "$DB_PACKAGE" ]; then
  scp $SSH_OPTS "$DB_PACKAGE" "$SERVER:$APP_DIR/$DB_PACKAGE"
fi
scp $SSH_OPTS ecosystem.config.cjs "$SERVER:$APP_DIR/ecosystem.config.cjs"
scp $SSH_OPTS package.json "$SERVER:$APP_DIR/package.json"

echo "Aplicando no servidor..."
scp $SSH_OPTS scripts/remote-deploy.sh "$SERVER:/tmp/lumen-remote-deploy.sh"
ssh $SSH_OPTS "$SERVER" "STAMP='$STAMP' bash /tmp/lumen-remote-deploy.sh"

rm -f "$PACKAGE" "$DB_PACKAGE"

echo ""
echo "Deploy concluido! http://137.184.195.81"
if [ "$SYNC_DB" -eq 0 ]; then
  echo "SQLite de producao nao foi alterado."
fi
