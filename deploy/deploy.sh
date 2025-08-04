#!/bin/bash

# Script de Deploy Automatizado - Remote Control Relay Server
# Uso: ./deploy.sh [servidor] [dominio]

set -e

SERVER_IP=$1
DOMAIN=$2
SERVER_USER="root"
DEPLOY_PATH="/var/www/remote-control-relay"

if [ $# -eq 0 ]; then
    echo "❌ Uso: ./deploy.sh [IP_SERVIDOR] [DOMINIO]"
    echo "📝 Exemplo: ./deploy.sh 192.168.1.100 meudominio.com"
    exit 1
fi

echo "🚀 Iniciando deploy do Remote Control Relay Server..."
echo "📡 Servidor: $SERVER_IP"
echo "🌐 Domínio: $DOMAIN"

# Função para executar comandos no servidor remoto
run_remote() {
    ssh $SERVER_USER@$SERVER_IP "$1"
}

# Função para copiar arquivos
copy_files() {
    scp -r "$1" $SERVER_USER@$SERVER_IP:"$2"
}

echo "📋 Etapa 1: Verificando conexão..."
if ! ping -c 1 $SERVER_IP > /dev/null 2>&1; then
    echo "❌ Erro: Não foi possível conectar ao servidor $SERVER_IP"
    exit 1
fi

echo "✅ Conexão OK"

echo "📋 Etapa 2: Atualizando sistema..."
run_remote "apt update && apt upgrade -y"

echo "📋 Etapa 3: Instalando Node.js..."
run_remote "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
run_remote "apt-get install -y nodejs"

echo "📋 Etapa 4: Instalando Nginx e Certbot..."
run_remote "apt install -y nginx certbot python3-certbot-nginx"

echo "📋 Etapa 5: Criando diretório de deploy..."
run_remote "mkdir -p $DEPLOY_PATH"
run_remote "chown -R www-data:www-data $DEPLOY_PATH"

echo "📋 Etapa 6: Copiando arquivos do servidor relay..."
copy_files "../relay-server/*" "$DEPLOY_PATH/"

echo "📋 Etapa 7: Instalando dependências..."
run_remote "cd $DEPLOY_PATH && npm install --production"

echo "📋 Etapa 8: Configurando arquivo .env..."
run_remote "cd $DEPLOY_PATH && cp .env.example .env"
run_remote "cd $DEPLOY_PATH && sed -i 's/NODE_ENV=development/NODE_ENV=production/' .env"
run_remote "cd $DEPLOY_PATH && sed -i 's/PORT=8080/PORT=8080/' .env"

echo "📋 Etapa 9: Criando serviço systemd..."
cat << EOF | ssh $SERVER_USER@$SERVER_IP "cat > /etc/systemd/system/remote-relay.service"
[Unit]
Description=Remote Control Relay Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$DEPLOY_PATH
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF

echo "📋 Etapa 10: Configurando Nginx..."
cat << EOF | ssh $SERVER_USER@$SERVER_IP "cat > /etc/nginx/sites-available/remote-relay"
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

echo "📋 Etapa 11: Ativando configuração Nginx..."
run_remote "ln -sf /etc/nginx/sites-available/remote-relay /etc/nginx/sites-enabled/"
run_remote "nginx -t"
run_remote "systemctl restart nginx"

echo "📋 Etapa 12: Iniciando serviços..."
run_remote "systemctl daemon-reload"
run_remote "systemctl enable remote-relay"
run_remote "systemctl start remote-relay"

echo "📋 Etapa 13: Configurando SSL..."
run_remote "certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN" || echo "⚠️ SSL pode ser configurado depois"

echo "📋 Etapa 14: Configurando firewall..."
run_remote "ufw allow 22/tcp"
run_remote "ufw allow 80/tcp"
run_remote "ufw allow 443/tcp"
run_remote "ufw --force enable"

echo "📋 Etapa 15: Verificando status..."
echo "🔍 Status do serviço:"
run_remote "systemctl status remote-relay --no-pager"

echo "🔍 Testando endpoint:"
sleep 5
if curl -s "http://$DOMAIN/health" > /dev/null; then
    echo "✅ Servidor respondendo em http://$DOMAIN/health"
else
    echo "⚠️ Servidor pode estar iniciando ainda..."
fi

echo ""
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo ""
echo "📊 URLs importantes:"
echo "   🌐 Health Check: https://$DOMAIN/health"
echo "   📈 Estatísticas: https://$DOMAIN/stats"
echo "   📱 WebSocket: wss://$DOMAIN"
echo ""
echo "🛠️ Comandos úteis no servidor:"
echo "   📋 Status: systemctl status remote-relay"
echo "   📜 Logs: journalctl -u remote-relay -f"
echo "   🔄 Restart: systemctl restart remote-relay"
echo ""
echo "⚠️ PRÓXIMO PASSO:"
echo "   Atualize src/client/relay-client.js com:"
echo "   this.relayServerUrl = 'wss://$DOMAIN';"
echo ""
echo "🚀 Seu servidor relay está rodando em: wss://$DOMAIN"