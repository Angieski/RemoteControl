# Script PowerShell para atualizar servidor AWS Relay
# Execute como: .\update-aws-server.ps1

Write-Host "🚀 ATUALIZANDO SERVIDOR AWS RELAY" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

$SERVER_IP = "54.232.138.198"
$SERVER_USER = "ubuntu"
$LOCAL_FILE = ".\relay-server\server.js"
$REMOTE_PATH = "/home/ubuntu/remote-control-relay/server.js"

# Verificar se arquivo local existe
if (!(Test-Path $LOCAL_FILE)) {
    Write-Host "❌ Erro: $LOCAL_FILE não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Arquivo local encontrado" -ForegroundColor Green

# Comandos SSH que você precisa executar manualmente
Write-Host "`n📋 COMANDOS PARA EXECUTAR NO SERVIDOR AWS:" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow

Write-Host "`n1️⃣ CONECTAR AO SERVIDOR:" -ForegroundColor Cyan
Write-Host "ssh ubuntu@$SERVER_IP" -ForegroundColor White

Write-Host "`n2️⃣ FAZER BACKUP:" -ForegroundColor Cyan
Write-Host "cp /home/ubuntu/remote-control-relay/server.js /home/ubuntu/remote-control-relay/server.js.backup-$(date +%Y%m%d_%H%M%S)" -ForegroundColor White

Write-Host "`n3️⃣ PARAR SERVIÇO:" -ForegroundColor Cyan
Write-Host "sudo systemctl stop remote-relay" -ForegroundColor White

Write-Host "`n4️⃣ SAIR DO SSH TEMPORARIAMENTE (exit) E FAZER UPLOAD:" -ForegroundColor Cyan
Write-Host "scp .\relay-server\server.js ubuntu@$SERVER_IP:/home/ubuntu/remote-control-relay/server.js" -ForegroundColor White

Write-Host "`n5️⃣ RECONECTAR E INICIAR SERVIÇO:" -ForegroundColor Cyan
Write-Host "ssh ubuntu@$SERVER_IP" -ForegroundColor White
Write-Host "sudo systemctl start remote-relay" -ForegroundColor White
Write-Host "sudo systemctl status remote-relay" -ForegroundColor White

Write-Host "`n6️⃣ VERIFICAR LOGS:" -ForegroundColor Cyan
Write-Host "sudo journalctl -u remote-relay -f" -ForegroundColor White

Write-Host "`n🔍 TESTE RÁPIDO:" -ForegroundColor Yellow
Write-Host "curl http://54.232.138.198:8080/health" -ForegroundColor White

Write-Host "`n💡 DICA: Abra outra janela do PowerShell para executar estes comandos" -ForegroundColor Magenta