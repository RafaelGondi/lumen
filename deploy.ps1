# Deploy Lumen para o droplet (PowerShell / OpenSSH do Windows)
# Uso: .\deploy.ps1

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
if (Test-Path '.data/lumen.sqlite3') {
  tar -czf $DB -C .data lumen.sqlite3
}

Write-Host 'Enviando...'
scp $PACKAGE "${SERVER}:${APP}/$PACKAGE"
if (Test-Path $DB) { scp $DB "${SERVER}:${APP}/$DB" }
scp ecosystem.config.cjs "${SERVER}:${APP}/ecosystem.config.cjs"
scp package.json "${SERVER}:${APP}/package.json"
scp scripts/remote-deploy.sh "${SERVER}:/tmp/lumen-remote-deploy.sh"

Write-Host 'Aplicando no servidor...'
ssh $SERVER "STAMP='$STAMP' bash /tmp/lumen-remote-deploy.sh"

Remove-Item $PACKAGE -Force -ErrorAction SilentlyContinue
Remove-Item $DB -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Deploy concluido! http://137.184.195.81'
