class RemoteControlRelayClient {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.clientType = null; // 'host' ou 'viewer'
    this.isConnected = false;
    this.currentSession = null;
    this.heartbeatInterval = null;
    
    // Configuração do servidor relay
    this.relayServerUrl = 'ws://54.232.138.198:8080'; // Servidor AWS EC2
    
    this.initializeUI();
    this.connectToRelay();
  }

  initializeUI() {
    // Adicionar novos elementos na interface
    this.addRelayInterface();
    
    // Event listeners para novos controles
    document.getElementById('setAsHostBtn').addEventListener('click', () => {
      this.registerAsHost();
    });
    
    document.getElementById('connectToIdBtn').addEventListener('click', () => {
      this.connectToRemoteId();
    });
    
    document.getElementById('acceptConnectionBtn').addEventListener('click', () => {
      this.acceptConnection(true);
    });
    
    document.getElementById('rejectConnectionBtn').addEventListener('click', () => {
      this.acceptConnection(false);
    });
  }

  addRelayInterface() {
    // Adicionar interface estilo AnyDesk na página HTML
    const relayInterface = `
      <div class="relay-interface" style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h2>🌐 Conexão via Internet (Estilo AnyDesk)</h2>
        
        <div class="my-id-section">
          <h3>📋 Seu ID</h3>
          <div class="id-display">
            <span id="myClientId" style="font-size: 24px; font-weight: bold; color: #2196F3;">---</span>
            <button id="copyIdBtn" onclick="this.copyToClipboard()">📋 Copiar</button>
          </div>
          <p>Compartilhe este ID para receber conexões</p>
        </div>
        
        <div class="host-section">
          <h3>🖥️ Permitir Controle Remoto</h3>
          <button id="setAsHostBtn" class="btn-primary">Aguardar Conexões</button>
          <div id="hostStatus" style="display: none;">
            <p>Status: <span id="hostStatusText">Aguardando...</span></p>
          </div>
        </div>
        
        <div class="viewer-section">
          <h3>👁️ Conectar a Outro Computador</h3>
          <div class="input-group">
            <label for="remoteId">ID do Computador Remoto:</label>
            <input type="text" id="remoteId" placeholder="Ex: 123456789" maxlength="9">
          </div>
          <button id="connectToIdBtn" class="btn-primary">Conectar ao ID</button>
        </div>
        
        <div class="connection-request" id="connectionRequest" style="display: none;">
          <h3>📞 Solicitação de Conexão</h3>
          <p id="requestMessage">Usuário X quer se conectar</p>
          <button id="acceptConnectionBtn" class="btn-success">✅ Aceitar</button>
          <button id="rejectConnectionBtn" class="btn-danger">❌ Rejeitar</button>
        </div>
        
        <div class="relay-status">
          <p>Servidor Relay: <span id="relayStatus">Conectando...</span></p>
        </div>
      </div>
    `;
    
    // Inserir antes da primeira aba
    const mainContent = document.querySelector('.app-main');
    mainContent.insertAdjacentHTML('afterbegin', relayInterface);
  }

  async connectToRelay() {
    try {
      console.log('Conectando ao servidor relay...');
      this.updateRelayStatus('Conectando...');
      
      this.ws = new WebSocket(this.relayServerUrl);
      
      this.ws.onopen = () => {
        console.log('Conectado ao servidor relay');
        this.updateRelayStatus('✅ Online');
        this.isConnected = true;
        this.startHeartbeat();
      };
      
      this.ws.onmessage = (event) => {
        this.handleRelayMessage(event);
      };
      
      this.ws.onclose = () => {
        console.log('Desconectado do servidor relay');
        this.updateRelayStatus('❌ Offline');
        this.isConnected = false;
        this.stopHeartbeat();
        
        // Tentar reconectar após 5 segundos
        setTimeout(() => {
          if (!this.isConnected) {
            this.connectToRelay();
          }
        }, 5000);
      };
      
      this.ws.onerror = (error) => {
        console.error('Erro no servidor relay:', error);
        this.updateRelayStatus('❌ Erro de Conexão');
      };
      
    } catch (error) {
      console.error('Erro ao conectar ao relay:', error);
      this.updateRelayStatus('❌ Falha na Conexão');
    }
  }

  handleRelayMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('Mensagem do relay:', message);
      
      switch (message.type) {
        case 'server_hello':
          console.log(message.message);
          break;
          
        case 'client_registered':
          this.handleClientRegistered(message);
          break;
          
        case 'connection_request':
          this.handleConnectionRequest(message);
          break;
          
        case 'connection_accepted':
          this.handleConnectionAccepted(message);
          break;
          
        case 'connection_rejected':
          this.handleConnectionRejected(message);
          break;
          
        case 'connection_established':
          this.handleConnectionEstablished(message);
          break;
          
        case 'relay_data':
          this.handleRelayData(message);
          break;
          
        case 'session_ended':
          this.handleSessionEnded(message);
          break;
          
        case 'error':
          this.handleRelayError(message);
          break;
          
        case 'heartbeat_ack':
          // Heartbeat confirmado
          break;
          
        default:
          console.warn('Tipo de mensagem desconhecido:', message.type);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem do relay:', error);
    }
  }

  registerAsHost() {
    if (!this.isConnected) {
      alert('Não conectado ao servidor relay');
      return;
    }
    
    this.clientType = 'host';
    
    this.sendToRelay({
      type: 'register_client',
      clientType: 'host',
      deviceInfo: {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timestamp: Date.now()
      }
    });
    
    document.getElementById('hostStatus').style.display = 'block';
    document.getElementById('hostStatusText').textContent = 'Registrando...';
  }

  connectToRemoteId() {
    const remoteId = document.getElementById('remoteId').value.trim();
    
    if (!remoteId || remoteId.length !== 9) {
      alert('Por favor, digite um ID válido de 9 dígitos');
      return;
    }
    
    if (!this.isConnected) {
      alert('Não conectado ao servidor relay');
      return;
    }
    
    this.clientType = 'viewer';
    
    // Primeiro registrar como viewer
    this.sendToRelay({
      type: 'register_client',
      clientType: 'viewer',
      deviceInfo: {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }
    });
    
    // Depois solicitar conexão
    setTimeout(() => {
      this.sendToRelay({
        type: 'request_connection',
        targetClientId: remoteId,
        requestType: 'control'
      });
    }, 1000);
  }

  acceptConnection(accepted) {
    if (!this.currentSession) {
      return;
    }
    
    this.sendToRelay({
      type: 'accept_connection',
      sessionId: this.currentSession.sessionId,
      accepted: accepted
    });
    
    document.getElementById('connectionRequest').style.display = 'none';
  }

  handleClientRegistered(message) {
    this.clientId = message.clientId;
    document.getElementById('myClientId').textContent = this.clientId;
    
    if (this.clientType === 'host') {
      document.getElementById('hostStatusText').textContent = `Aguardando conexões (ID: ${this.clientId})`;
    }
    
    console.log(`Registrado como ${this.clientType} com ID: ${this.clientId}`);
  }

  handleConnectionRequest(message) {
    this.currentSession = {
      sessionId: message.sessionId,
      requesterId: message.requesterId,
      requestType: message.requestType
    };
    
    document.getElementById('requestMessage').textContent = 
      `${message.requesterId} solicita ${message.requestType === 'control' ? 'controlar' : 'visualizar'} este computador`;
    
    document.getElementById('connectionRequest').style.display = 'block';
  }

  handleConnectionAccepted(message) {
    console.log('Conexão aceita!', message);
    this.currentSession = { sessionId: message.sessionId };
    
    // Iniciar captura de tela se for host na sessão ativa
    if (this.clientType === 'viewer') {
      this.startRemoteSession(message.sessionId);
    }
  }

  handleConnectionRejected(message) {
    alert('Conexão rejeitada pelo usuário remoto');
    this.currentSession = null;
  }

  handleConnectionEstablished(message) {
    console.log('Sessão estabelecida:', message);
    this.currentSession = { sessionId: message.sessionId };
    
    if (this.clientType === 'host') {
      this.startHostSession(message.sessionId);
    }
  }

  handleRelayData(message) {
    const { dataType, data, sessionId } = message;
    
    if (!this.currentSession || this.currentSession.sessionId !== sessionId) {
      return;
    }
    
    switch (dataType) {
      case 'screen':
        this.displayRemoteScreen(data);
        break;
        
      case 'input':
        this.processRemoteInput(data);
        break;
        
      default:
        console.warn('Tipo de dados desconhecido:', dataType);
    }
  }

  handleSessionEnded(message) {
    console.log('Sessão encerrada:', message.reason);
    this.currentSession = null;
    
    if (this.clientType === 'host') {
      document.getElementById('hostStatusText').textContent = 'Aguardando conexões...';
    }
    
    alert('Sessão encerrada: ' + message.reason);
  }

  handleRelayError(message) {
    console.error('Erro do relay:', message.message);
    alert('Erro: ' + message.message);
  }

  startHostSession(sessionId) {
    console.log('Iniciando sessão como host:', sessionId);
    document.getElementById('hostStatusText').textContent = 'Sessão ativa - Sendo controlado';
    
    // Iniciar captura e envio de tela
    this.startScreenCapture(sessionId);
  }

  startRemoteSession(sessionId) {
    console.log('Iniciando sessão como viewer:', sessionId);
    
    // Mostrar canvas para exibir tela remota
    this.showRemoteCanvas();
    
    // Solicitar frames de tela
    this.requestScreenFrames(sessionId);
  }

  startScreenCapture(sessionId) {
    // Integrar com a captura de tela existente
    if (window.electronAPI) {
      // Usar captura nativa do Electron
      this.screenCaptureInterval = setInterval(async () => {
        try {
          // Aqui você integraria com o ScreenCapture existente
          // Por agora, enviaremos dados mock
          this.sendToRelay({
            type: 'relay_data',
            sessionId: sessionId,
            dataType: 'screen',
            data: 'screen_frame_data_base64' // Substituir por dados reais
          });
        } catch (error) {
          console.error('Erro na captura de tela:', error);
        }
      }, 100); // 10 FPS
    }
  }

  requestScreenFrames(sessionId) {
    // Solicitar frames periodicamente
    this.frameRequestInterval = setInterval(() => {
      this.sendToRelay({
        type: 'relay_data',
        sessionId: sessionId,
        dataType: 'screen_request',
        data: 'request_frame'
      });
    }, 100);
  }

  sendToRelay(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendToRelay({ type: 'heartbeat' });
    }, 30000); // A cada 30 segundos
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  updateRelayStatus(status) {
    const statusElement = document.getElementById('relayStatus');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  copyToClipboard() {
    if (this.clientId) {
      navigator.clipboard.writeText(this.clientId).then(() => {
        alert(`ID ${this.clientId} copiado para a área de transferência!`);
      });
    }
  }
}

// Integrar com a aplicação existente
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar cliente relay junto com a aplicação existente
  window.relayClient = new RemoteControlRelayClient();
});