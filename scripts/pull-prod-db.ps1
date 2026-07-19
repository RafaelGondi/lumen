$ErrorActionPreference = 'Stop'

$SERVER = 'root@137.184.195.81'
$REMOTE_DB = '/app/.data/lumen.sqlite3'
$STAMP = Get-Date -Format 'yyyyMMdd-HHmmss'
$REMOTE_EXPORT = "/tmp/lumen-pull-$STAMP.sqlite3"
$LOCAL_DIR = '.data'
$LOCAL_DB = Join-Path $LOCAL_DIR 'lumen.sqlite3'
$LOCAL_BACKUP = Join-Path $LOCAL_DIR "backups/lumen-local-$STAMP.sqlite3"

New-Item -ItemType Directory -Force -Path (Join-Path $LOCAL_DIR 'backups') | Out-Null

if (Test-Path $LOCAL_DB) {
  Copy-Item $LOCAL_DB $LOCAL_BACKUP
  Write-Host "Backup local: $LOCAL_BACKUP"
}

Write-Host 'Gerando snapshot consistente em producao (somente leitura)...'
scp "scripts/remote-db-backup.cjs" "${SERVER}:/app/.output/server/remote-db-backup.cjs"
$remoteExport = ssh $SERVER "cd /app/.output/server && node remote-db-backup.cjs $STAMP"
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar snapshot no servidor' }
$REMOTE_EXPORT = $remoteExport.Trim()

Write-Host 'Baixando banco...'
scp "${SERVER}:${REMOTE_EXPORT}" $LOCAL_DB
if ($LASTEXITCODE -ne 0) { throw 'Falha ao baixar banco' }

Write-Host 'Limpando arquivo temporario remoto...'
ssh $SERVER "rm -f $REMOTE_EXPORT /app/.output/server/remote-db-backup.cjs"

Remove-Item -Force -ErrorAction SilentlyContinue "$LOCAL_DB-wal", "$LOCAL_DB-shm"

$size = (Get-Item $LOCAL_DB).Length
Write-Host "Banco local atualizado: $LOCAL_DB ($size bytes)"
