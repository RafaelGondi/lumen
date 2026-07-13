# Deploy Lumen para o droplet (PowerShell / OpenSSH do Windows)
# Uso:
#   .\deploy.ps1              → só app (NÃO mexe no banco de produção)
#   .\deploy.ps1 -SyncDb      → app + sobrescreve o SQLite de produção com o local

param(
  [switch]$SyncDb
)

$ErrorActionPreference = 'Stop'
$SERVER = 'root@137.184.195.81'
$APP = '/app'
$PACKAGE = 'lumen-output.tgz'
$DB = 'lumen-db.tgz'
$STAMP = Get-Date -Format 'yyyyMMdd-HHmmss'

Write-Host 'Buildando Lumen...'
npm run build
if (-not (Test-Path '.output/server/index.mjs')) {
  throw 'Bundle .output ausente'
}

Write-Host 'Empacotando...'
if (Test-Path $PACKAGE) { Remove-Item $PACKAGE -Force }
if (Test-Path $DB) { Remove-Item $DB -Force }
tar -czf $PACKAGE .output

if ($SyncDb) {
  if (-not (Test-Path '.data/lumen.sqlite3')) {
    throw 'SyncDb pedido, mas .data/lumen.sqlite3 nao existe'
  }
  Write-Host 'ATENCAO: SyncDb ativo — o banco local vai sobrescrever producao.'
  tar -czf $DB -C .data lumen.sqlite3
} else {
  Write-Host 'Banco de producao sera preservado (use -SyncDb so se pedir explicitamente).'
}

Write-Host 'Enviando...'
scp $PACKAGE "${SERVER}:${APP}/$PACKAGE"
if ($SyncDb -and (Test-Path $DB)) {
  scp $DB "${SERVER}:${APP}/$DB"
}
scp ecosystem.config.cjs "${SERVER}:${APP}/ecosystem.config.cjs"
scp package.json "${SERVER}:${APP}/package.json"
scp scripts/remote-deploy.sh "${SERVER}:/tmp/lumen-remote-deploy.sh"

Write-Host 'Aplicando no servidor...'
ssh $SERVER "STAMP='$STAMP' bash /tmp/lumen-remote-deploy.sh"

Remove-Item $PACKAGE -Force -ErrorAction SilentlyContinue
Remove-Item $DB -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Deploy concluido! http://137.184.195.81'
if (-not $SyncDb) {
  Write-Host 'SQLite de producao nao foi alterado.'
}
