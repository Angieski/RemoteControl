const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const ScreenCapture = require('./screenCapture');
const InputController = require('./inputController');
const Authentication = require('./authentication');

class RemoteControlServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Map();
    this.sessions = new Map();
    
    this.screenCapture = new ScreenCapture();
    this.inputController = new InputController();
    this.auth = new Authentication();
    
    this.setupExpress();
    this.setupWebSocket();
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());
    
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', clients: this.clients.size });
    });

    this.app.post('/generate-code', async (req, res) => {
      const code = this.auth.generateAccessCode();
      res.json({ code, expires: Date.now() + 300000 }); // 5 minutos
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      const clientInfo = {
        id: clientId,
        ws: ws,
        type: null, // 'host' ou 'viewer'
        sessionId: null,
        authenticated: false
      };
      
      this.clients.set(clientId, clientInfo);
      console.log(`Cliente conectado: ${clientId}`);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Erro ao processar mensagem:', error);
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.send(JSON.stringify({ 
        type: 'connected', 
        clientId: clientId 
      }));
    });
  }

  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'register_host':
        await this.registerHost(clientId, message);
        break;
        
      case 'connect_viewer':
        await this.connectViewer(clientId, message);
        break;
        
      case 'screen_request':
        await this.handleScreenRequest(clientId);
        break;
        
      case 'input_event':
        await this.handleInputEvent(clientId, message);
        break;
        
      case 'disconnect_session':
        this.disconnectSession(clientId);
        break;
    }
  }

  async registerHost(clientId, message) {
    const client = this.clients.get(clientId);
    const { accessCode } = message;
    
    if (!this.auth.validateAccessCode(accessCode)) {
      client.ws.send(JSON.stringify({ 
        type: 'auth_failed', 
        message: 'Código inválido ou expirado' 
      }));
      return;
    }

    client.type = 'host';
    client.authenticated = true;
    client.sessionId = uuidv4();
    
    this.sessions.set(client.sessionId, {
      hostId: clientId,
      viewers: new Set(),
      createdAt: Date.now()
    });

    client.ws.send(JSON.stringify({ 
      type: 'host_registered', 
      sessionId: client.sessionId,
      accessCode: accessCode
    }));

    console.log(`Host registrado: ${clientId}, Sessão: ${client.sessionId}`);
  }

  async connectViewer(clientId, message) {
    const client = this.clients.get(clientId);
    const { accessCode } = message;
    
    if (!this.auth.validateAccessCode(accessCode)) {
      client.ws.send(JSON.stringify({ 
        type: 'auth_failed', 
        message: 'Código inválido ou expirado' 
      }));
      return;
    }

    // Encontrar sessão pelo código
    const session = Array.from(this.sessions.values()).find(s => {
      const host = this.clients.get(s.hostId);
      return host && host.authenticated;
    });

    if (!session) {
      client.ws.send(JSON.stringify({ 
        type: 'connection_failed', 
        message: 'Nenhuma sessão ativa encontrada' 
      }));
      return;
    }

    client.type = 'viewer';
    client.authenticated = true;
    client.sessionId = session.hostId;
    
    session.viewers.add(clientId);

    client.ws.send(JSON.stringify({ 
      type: 'viewer_connected', 
      sessionId: client.sessionId 
    }));

    // Notificar host sobre novo viewer
    const host = this.clients.get(session.hostId);
    if (host) {
      host.ws.send(JSON.stringify({ 
        type: 'viewer_joined', 
        viewerId: clientId 
      }));
    }

    console.log(`Viewer conectado: ${clientId} à sessão: ${client.sessionId}`);
  }

  async handleScreenRequest(clientId) {
    const client = this.clients.get(clientId);
    if (!client || client.type !== 'viewer' || !client.authenticated) return;

    try {
      const screenshot = await this.screenCapture.captureScreen();
      client.ws.send(screenshot, { binary: true });
    } catch (error) {
      console.error('Erro ao capturar tela:', error);
    }
  }

  async handleInputEvent(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.type !== 'viewer' || !client.authenticated) return;

    try {
      await this.inputController.processInput(message.event);
    } catch (error) {
      console.error('Erro ao processar input:', error);
    }
  }

  disconnectSession(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.type === 'host' && client.sessionId) {
      const session = this.sessions.get(client.sessionId);
      if (session) {
        // Notificar todos os viewers
        session.viewers.forEach(viewerId => {
          const viewer = this.clients.get(viewerId);
          if (viewer) {
            viewer.ws.send(JSON.stringify({ type: 'session_ended' }));
          }
        });
        this.sessions.delete(client.sessionId);
      }
    }
  }

  handleDisconnect(clientId) {
    console.log(`Cliente desconectado: ${clientId}`);
    this.disconnectSession(clientId);
    this.clients.delete(clientId);
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Servidor rodando na porta ${this.port}`);
      console.log(`WebSocket: ws://localhost:${this.port}`);
      console.log(`HTTP: http://localhost:${this.port}`);
    });
  }
}

// Iniciar servidor se executado diretamente
if (require.main === module) {
  const server = new RemoteControlServer();
  server.start();
}

module.exports = RemoteControlServer;