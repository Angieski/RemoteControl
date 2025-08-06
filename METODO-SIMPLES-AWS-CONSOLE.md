# 🌐 MÉTODO MAIS SIMPLES - AWS CONSOLE (SEM SSH)

## 🎯 ACESSO DIRETO VIA NAVEGADOR

**Não precisa de chave SSH!** Use o próprio console da AWS:

### **Passo 1: Acessar AWS Console**
1. Vá para: https://console.aws.amazon.com/
2. Faça login na sua conta AWS
3. Navegue para: **EC2** → **Instances**

### **Passo 2: Conectar à instância**
1. **Encontre a instância** com IP `54.232.138.198`
2. **Selecione a instância** (checkbox)
3. **Clique no botão "Connect"** (no topo)
4. **Selecione "EC2 Instance Connect"**
5. **Username:** `ubuntu` (deixe como está)
6. **Clique "Connect"**

Isso abrirá um terminal no navegador!

---

## 🔧 COMANDOS PARA EXECUTAR NO TERMINAL AWS

### **1. Fazer backup do arquivo atual:**
```bash
cp /home/ubuntu/remote-control-relay/server.js /home/ubuntu/remote-control-relay/server.js.backup-$(date +%Y%m%d_%H%M%S)
```

### **2. Parar o serviço:**
```bash
sudo systemctl stop remote-relay
```

### **3. Verificar se parou:**
```bash
sudo systemctl status remote-relay
```

### **4. Editar o arquivo (método 1 - nano):**
```bash
nano /home/ubuntu/remote-control-relay/server.js
```

**OU**

### **4. Substituir arquivo completo (método 2 - mais seguro):**
```bash
# Primeiro, vamos ver o conteúdo atual
head -10 /home/ubuntu/remote-control-relay/server.js

# Criar novo arquivo
cat > /home/ubuntu/remote-control-relay/server.js << 'EOF'
[AQUI VOCÊ COLA O CONTEÚDO NOVO - VOU PREPARAR PARA VOCÊ]
EOF
```

### **5. Iniciar serviço novamente:**
```bash
sudo systemctl start remote-relay
```

### **6. Verificar se funcionou:**
```bash
sudo systemctl status remote-relay
```

### **7. Ver logs:**
```bash
sudo journalctl -u remote-relay -n 20
```

---

## 📋 CONTEÚDO PARA COLAR (ARQUIVO server.js ATUALIZADO)

Vou preparar o comando completo para você copiar e colar:

```bash
cat > /home/ubuntu/remote-control-relay/server.js << 'EOF'
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');

class RemoteControlRelayServer {
  constructor(port = 8080) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Armazenar clientes conectados
    this.clients = new Map(); // clientId -> { ws, info, lastSeen }
    this.sessions = new Map(); // sessionId -> { hostId, viewerId, status }
    
    this.setupExpress();
    this.setupWebSocket();
    this.startCleanupInterval();
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        clients: this.clients.size,
        sessions: this.sessions.size,
        server: 'AWS EC2'
      });
    });

    // API para obter estatísticas
    this.app.get('/stats', (req, res) => {
      const onlineClients = Array.from(this.clients.values())
        .filter(client => Date.now() - client.lastSeen < 30000);
      
      res.json({
        totalClients: this.clients.size,
        onlineClients: onlineClients.length,
        activeSessions: this.sessions.size,
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        server: 'AWS EC2 São Paulo'
      });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log(`Nova conexão WebSocket de ${req.socket.remoteAddress}`);
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Erro ao processar mensagem:', error);
          this.sendError(ws, 'Mensagem inválida');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('Erro WebSocket:', error);
      });

      // Enviar mensagem de boas-vindas
      this.send(ws, {
        type: 'server_hello',
        message: 'Conectado ao servidor relay Remote Control'
      });
    });
  }

  async handleMessage(ws, message) {
    const { type } = message;
    
    switch (type) {
      case 'register_client':
        await this.handleRegisterClient(ws, message);
        break;
        
      case 'request_connection':
        await this.handleRequestConnection(ws, message);
        break;
        
      case 'accept_connection':
        await this.handleAcceptConnection(ws, message);
        break;
        
      case 'relay_data':
        await this.handleRelayData(ws, message);
        break;
        
      case 'heartbeat':
        await this.handleHeartbeat(ws, message);
        break;
        
      case 'disconnect_session':
        await this.handleDisconnectSession(ws, message);
        break;
        
      case 'test_ping':
        await this.handleTestPing(ws, message);
        break;
        
      case 'get_stats':
        await this.handleGetStats(ws, message);
        break;
        
      default:
        console.warn(`Tipo de mensagem desconhecido: ${type}`);
    }
  }

  async handleRegisterClient(ws, message) {
    const { clientType, deviceInfo } = message; // 'host' ou 'viewer'
    
    // Gerar ID único estilo AnyDesk (9 dígitos)
    let clientId;
    do {
      clientId = this.generateClientId();
    } while (this.clients.has(clientId));
    
    const clientData = {
      id: clientId,
      ws: ws,
      type: clientType,
      deviceInfo: deviceInfo || {},
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      status: 'online'
    };
    
    this.clients.set(clientId, clientData);
    ws.clientId = clientId;
    
    console.log(`Cliente registrado: ${clientId} (${clientType})`);
    
    this.send(ws, {
      type: 'client_registered',
      clientId: clientId,
      message: `Seu ID: ${clientId}`
    });
  }

  async handleRequestConnection(ws, message) {
    const { targetClientId, requestType } = message; // requestType: 'control' ou 'view'
    const requesterId = ws.clientId;
    
    if (!requesterId) {
      return this.sendError(ws, 'Cliente não registrado');
    }
    
    const targetClient = this.clients.get(targetClientId);
    if (!targetClient || targetClient.status !== 'online') {
      return this.sendError(ws, 'Cliente de destino não encontrado ou offline');
    }
    
    if (Date.now() - targetClient.lastSeen > 30000) {
      return this.sendError(ws, 'Cliente de destino não está respondendo');
    }
    
    // Gerar session ID
    const sessionId = this.generateSessionId();
    
    // Criar sessão pendente
    this.sessions.set(sessionId, {
      id: sessionId,
      requesterId: requesterId,
      targetId: targetClientId,
      type: requestType,
      status: 'pending',
      createdAt: Date.now()
    });
    
    // Enviar solicitação para o cliente de destino
    this.send(targetClient.ws, {
      type: 'connection_request',
      sessionId: sessionId,
      requesterId: requesterId,
      requesterInfo: this.clients.get(requesterId)?.deviceInfo || {},
      requestType: requestType,
      message: `Solicitação de ${requestType} de ${requesterId}`
    });
    
    // Confirmar para o solicitante
    this.send(ws, {
      type: 'connection_requested',
      sessionId: sessionId,
      targetId: targetClientId,
      message: 'Solicitação enviada. Aguardando aprovação...'
    });
    
    console.log(`Solicitação de conexão: ${requesterId} → ${targetClientId} (${requestType})`);
  }

  async handleAcceptConnection(ws, message) {
    const { sessionId, accepted } = message;
    const clientId = ws.clientId;
    
    const session = this.sessions.get(sessionId);
    if (!session || session.targetId !== clientId) {
      return this.sendError(ws, 'Sessão não encontrada ou não autorizada');
    }
    
    const requester = this.clients.get(session.requesterId);
    if (!requester) {
      this.sessions.delete(sessionId);
      return this.sendError(ws, 'Solicitante não está mais online');
    }
    
    if (accepted) {
      // Aceitar conexão
      session.status = 'active';
      session.connectedAt = Date.now();
      
      // Notificar ambos os clientes
      this.send(requester.ws, {
        type: 'connection_accepted',
        sessionId: sessionId,
        targetId: clientId,
        message: 'Conexão aceita! Iniciando sessão...'
      });
      
      this.send(ws, {
        type: 'connection_established',
        sessionId: sessionId,
        requesterId: session.requesterId,
        message: 'Sessão iniciada'
      });
      
      console.log(`Conexão estabelecida: Sessão ${sessionId}`);
    } else {
      // Rejeitar conexão
      this.sessions.delete(sessionId);
      
      this.send(requester.ws, {
        type: 'connection_rejected',
        targetId: clientId,
        message: 'Conexão rejeitada pelo usuário'
      });
      
      console.log(`Conexão rejeitada: Sessão ${sessionId}`);
    }
  }

  async handleRelayData(ws, message) {
    const { sessionId, data, dataType } = message; // dataType: 'screen', 'input', 'audio'
    const senderId = ws.clientId;
    
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return this.sendError(ws, 'Sessão não ativa');
    }
    
    // Determinar destinatário
    let targetId;
    if (session.requesterId === senderId) {
      targetId = session.targetId;
    } else if (session.targetId === senderId) {
      targetId = session.requesterId;
    } else {
      return this.sendError(ws, 'Não autorizado para esta sessão');
    }
    
    const targetClient = this.clients.get(targetId);
    if (!targetClient) {
      return this.sendError(ws, 'Cliente de destino desconectado');
    }
    
    // Relay dos dados
    this.send(targetClient.ws, {
      type: 'relay_data',
      sessionId: sessionId,
      senderId: senderId,
      dataType: dataType,
      data: data
    });
  }

  async handleHeartbeat(ws, message) {
    const clientId = ws.clientId;
    if (clientId && this.clients.has(clientId)) {
      this.clients.get(clientId).lastSeen = Date.now();
      this.send(ws, { type: 'heartbeat_ack' });
    }
  }

  async handleDisconnectSession(ws, message) {
    const { sessionId } = message;
    const clientId = ws.clientId;
    
    const session = this.sessions.get(sessionId);
    if (session && (session.requesterId === clientId || session.targetId === clientId)) {
      this.endSession(sessionId);
    }
  }

  handleDisconnect(ws) {
    const clientId = ws.clientId;
    if (clientId) {
      console.log(`Cliente desconectado: ${clientId}`);
      
      // Encerrar sessões ativas
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.requesterId === clientId || session.targetId === clientId) {
          this.endSession(sessionId);
        }
      }
      
      this.clients.delete(clientId);
    }
  }

  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Notificar ambos os clientes
    const requester = this.clients.get(session.requesterId);
    const target = this.clients.get(session.targetId);
    
    if (requester) {
      this.send(requester.ws, {
        type: 'session_ended',
        sessionId: sessionId,
        reason: 'Sessão encerrada'
      });
    }
    
    if (target) {
      this.send(target.ws, {
        type: 'session_ended',
        sessionId: sessionId,
        reason: 'Sessão encerrada'
      });
    }
    
    this.sessions.delete(sessionId);
    console.log(`Sessão encerrada: ${sessionId}`);
  }

  send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, errorMessage) {
    this.send(ws, {
      type: 'error',
      message: errorMessage
    });
  }

  generateClientId() {
    // Gerar ID estilo AnyDesk (9 dígitos)
    return Math.floor(100000000 + Math.random() * 900000000).toString();
  }

  generateSessionId() {
    return crypto.randomUUID();
  }

  startCleanupInterval() {
    // Limpar clientes offline e sessões expiradas a cada minuto
    setInterval(() => {
      this.cleanupOfflineClients();
      this.cleanupExpiredSessions();
    }, 60000);
  }

  cleanupOfflineClients() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastSeen > 120000) { // 2 minutos offline
        this.clients.delete(clientId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Removidos ${removedCount} clientes offline`);
    }
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const maxAge = session.status === 'pending' ? 300000 : 3600000; // 5min pending, 1h active
      
      if (now - session.createdAt > maxAge) {
        this.endSession(sessionId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Removidas ${removedCount} sessões expiradas`);
    }
  }

  async handleTestPing(ws, message) {
    console.log(`🧪 Teste ping recebido de: ${ws.clientId || 'desconhecido'}`);
    
    // Responder com pong
    ws.send(JSON.stringify({
      type: 'test_pong',
      timestamp: Date.now(),
      originalMessage: message
    }));
  }

  async handleGetStats(ws, message) {
    const stats = {
      type: 'stats_response',
      totalClients: this.clients.size,
      onlineClients: Array.from(this.clients.values()).filter(c => c.ws.readyState === 1).length,
      activeSessions: this.sessions.size,
      serverTime: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(stats));
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Servidor Relay Remote Control iniciado!`);
      console.log(`📡 WebSocket: ws://localhost:${this.port}`);
      console.log(`🌐 HTTP API: http://localhost:${this.port}`);
      console.log(`📊 Stats: http://localhost:${this.port}/stats`);
      console.log(`💚 Health: http://localhost:${this.port}/health`);
    });
  }
}

// Iniciar servidor se executado diretamente
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  const server = new RemoteControlRelayServer(PORT);
  server.start();
}

module.exports = RemoteControlRelayServer;
EOF
```

---

## ✅ RESUMO DO PROCESSO

1. **AWS Console** → EC2 → Instances → Connect → EC2 Instance Connect
2. **Backup:** `cp /home/ubuntu/remote-control-relay/server.js /home/ubuntu/remote-control-relay/server.js.backup-$(date +%Y%m%d_%H%M%S)`
3. **Parar:** `sudo systemctl stop remote-relay`
4. **Colar comando completo** acima (criar arquivo novo)
5. **Iniciar:** `sudo systemctl start remote-relay`
6. **Verificar:** `sudo systemctl status remote-relay`

**Essa é a forma mais fácil sem precisar de SSH!**