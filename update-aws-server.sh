#!/bin/bash

echo "🚀 SCRIPT DE ATUALIZAÇÃO DO SERVIDOR AWS RELAY"
echo "=============================================="

# Configurações
SERVER_IP="54.232.138.198"
SERVER_USER="ubuntu"
LOCAL_RELAY_PATH="./relay-server/server.js"
REMOTE_RELAY_PATH="/home/ubuntu/remote-control-relay/server.js"
SERVICE_NAME="remote-relay"

echo "📡 Servidor: $SERVER_IP"
echo "👤 Usuário: $SERVER_USER"
echo "📂 Arquivo local: $LOCAL_RELAY_PATH"
echo "📂 Arquivo remoto: $REMOTE_RELAY_PATH"
echo ""

# Verificar se o arquivo local existe
if [ ! -f "$LOCAL_RELAY_PATH" ]; then
    echo "❌ Erro: Arquivo $LOCAL_RELAY_PATH não encontrado!"
    exit 1
fi

echo "✅ Arquivo local encontrado"

# Fazer backup do servidor atual
echo ""
echo "1️⃣ FAZENDO BACKUP DO SERVIDOR ATUAL..."
ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "
    echo '📁 Criando backup...'
    cp $REMOTE_RELAY_PATH ${REMOTE_RELAY_PATH}.backup-$(date +%Y%m%d_%H%M%S)
    echo '✅ Backup criado'
"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao fazer backup do servidor"
    exit 1
fi

# Parar o serviço
echo ""
echo "2️⃣ PARANDO SERVIÇO ATUAL..."
ssh $SERVER_USER@$SERVER_IP "
    echo '🛑 Parando serviço $SERVICE_NAME...'
    sudo systemctl stop $SERVICE_NAME
    echo '✅ Serviço parado'
"

# Fazer upload do novo arquivo
echo ""
echo "3️⃣ FAZENDO UPLOAD DO NOVO CÓDIGO..."
scp $LOCAL_RELAY_PATH $SERVER_USER@$SERVER_IP:$REMOTE_RELAY_PATH

if [ $? -ne 0 ]; then
    echo "❌ Erro no upload do arquivo"
    echo "🔄 Restaurando backup..."
    ssh $SERVER_USER@$SERVER_IP "
        cp ${REMOTE_RELAY_PATH}.backup-* $REMOTE_RELAY_PATH
        sudo systemctl start $SERVICE_NAME
    "
    exit 1
fi

echo "✅ Upload concluído"

# Reiniciar o serviço
echo ""
echo "4️⃣ REINICIANDO SERVIÇO..."
ssh $SERVER_USER@$SERVER_IP "
    echo '🚀 Iniciando serviço $SERVICE_NAME...'
    sudo systemctl start $SERVICE_NAME
    sleep 3
    echo '📊 Status do serviço:'
    sudo systemctl status $SERVICE_NAME --no-pager -l
"

# Verificar se o serviço está funcionando
echo ""
echo "5️⃣ VERIFICANDO FUNCIONAMENTO..."
sleep 5

# Testar API de health
echo "🏥 Testando health check..."
HEALTH_RESPONSE=$(curl -s http://$SERVER_IP:8080/health)

if [ $? -eq 0 ]; then
    echo "✅ Health check: $HEALTH_RESPONSE"
else
    echo "❌ Health check falhou"
    exit 1
fi

# Testar WebSocket (precisaria de um cliente)
echo ""
echo "6️⃣ TESTANDO WEBSOCKET..."
echo "📝 Para testar o WebSocket completamente, execute:"
echo "   node test-websocket.js"
echo ""

echo "🎉 ATUALIZAÇÃO DO SERVIDOR CONCLUÍDA!"
echo "=================================="
echo "✅ Backup criado"
echo "✅ Código atualizado" 
echo "✅ Serviço reiniciado"
echo "✅ Health check passou"
echo ""
echo "🔍 Próximos passos:"
echo "1. Teste a aplicação cliente"
echo "2. Verifique conexões WebSocket"
echo "3. Valide o fluxo completo Host ↔ Viewer"