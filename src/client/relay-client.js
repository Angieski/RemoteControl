class RemoteControlRelayClient {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.clientType = null; // 'host' ou 'viewer'
    this.isConnected = false;
    this.currentSession = null;
    this.heartbeatInterval = null;
    
    // Configuração do servidor relay
    this.relayServerUrl = 'ws://52.67.59.247:8081'; // Servidor AWS EC2
    
    this.initializeUI();
    this.connectToRelay();
  }

  initializeUI() {
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupUI();
      });
    } else {
      this.setupUI();
    }
  }

  setupUI() {
    // Integrar funcionalidade relay com as abas existentes
    this.setupHostTab();
    this.setupViewerTab();
    
    console.log('✅ Relay client integrado com abas existentes');
  }

  setupHostTab() {
    // Integrar funcionalidade relay na aba Host existente
    const anydeskId = document.getElementById('anydeskId');
    const copyAnydeskIdBtn = document.getElementById('copyAnydeskIdBtn');
    const refreshAnydeskIdBtn = document.getElementById('refreshAnydeskIdBtn');
    const relayServerStatusHost = document.getElementById('relayServerStatusHost');
    const debugMyId = document.getElementById('debugMyId');
    const connectionRequests = document.getElementById('connectionRequests');
    const requestsList = document.getElementById('requestsList');

    // Atualizar status do relay
    if (relayServerStatusHost) {
      relayServerStatusHost.textContent = 'Conectando...';
    }

    // Event listener para copiar ID
    if (copyAnydeskIdBtn) {
      copyAnydeskIdBtn.addEventListener('click', () => {
        this.copyToClipboard();
      });
    }

    // Event listener para refresh ID
    if (refreshAnydeskIdBtn) {
      refreshAnydeskIdBtn.addEventListener('click', () => {
        this.registerAsHost();
      });
    }

    // Auto-registrar como host quando a aba host estiver ativa
    const hostTab = document.querySelector('[data-tab="host"]');
    if (hostTab) {
      hostTab.addEventListener('click', () => {
        setTimeout(() => {
          this.registerAsHost();
        }, 500);
      });
    }

    // Event listener para botão de desconectar host
    const disconnectHostBtn = document.getElementById('disconnectHostBtn');
    if (disconnectHostBtn) {
      disconnectHostBtn.addEventListener('click', () => {
        this.disconnectSession();
      });
    }
  }

  setupViewerTab() {
    // Integrar funcionalidade relay na aba Viewer existente
    const connectViaIdBtn = document.getElementById('connectViaIdBtn');
    const remoteIdInput = document.getElementById('remoteId');
    const connectionStatus = document.getElementById('connectionStatus');
    const relayConnectionStatus = document.getElementById('relayConnectionStatus');

    // Event listener para conectar via ID
    if (connectViaIdBtn) {
      connectViaIdBtn.addEventListener('click', () => {
        this.connectToRemoteId();
      });
    }

    // Event listener para botão de desconectar viewer (já existe no HTML)
    const disconnectBtn = document.getElementById('disconnectBtn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        this.disconnectSession();
      });
    }

    // Atualizar status do relay
    if (relayConnectionStatus) {
      relayConnectionStatus.textContent = '🔄 Conectando...';
    }

    // Auto-formatação do input ID
    if (remoteIdInput) {
      remoteIdInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Apenas números
        if (value.length > 9) value = value.substring(0, 9);
        // Formatar como 000 000 000
        if (value.length > 6) {
          value = value.substring(0, 3) + ' ' + value.substring(3, 6) + ' ' + value.substring(6);
        } else if (value.length > 3) {
          value = value.substring(0, 3) + ' ' + value.substring(3);
        }
        e.target.value = value;
      });
    }
  }

  async connectToRelay() {
    try {
      console.log('Conectando ao servidor relay...');
      this.updateRelayStatus('Conectando...');
      
      this.ws = new WebSocket(this.relayServerUrl);
      
      this.ws.onopen = () => {
        console.log('Conectado ao servidor relay');
        this.updateRelayStatus('Online');
        this.isConnected = true;
        this.startHeartbeat();
      };
      
      this.ws.onmessage = (event) => {
        this.handleRelayMessage(event);
      };
      
      this.ws.onclose = () => {
        console.log('Desconectado do servidor relay');
        this.updateRelayStatus('Offline');
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
        this.updateRelayStatus('Erro de Conexão');
      };
      
    } catch (error) {
      console.error('Erro ao conectar ao relay:', error);
      this.updateRelayStatus('Falha na Conexão');
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
      this.updateRelayStatus('Não conectado');
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
    
    // Atualizar status na aba host
    const relayServerStatusHost = document.getElementById('relayServerStatusHost');
    if (relayServerStatusHost) {
      relayServerStatusHost.textContent = 'Registrando...';
    }
    
    const listeningStatus = document.getElementById('listeningStatus');
    if (listeningStatus) {
      listeningStatus.textContent = 'Registrando como host...';
    }
  }

  connectToRemoteId() {
    const remoteIdInput = document.getElementById('remoteId');
    const remoteId = remoteIdInput ? remoteIdInput.value.replace(/\s/g, '') : '';
    
    if (!remoteId || remoteId.length !== 9) {
      alert('Por favor, digite um ID válido de 9 dígitos');
      return;
    }
    
    if (!this.isConnected) {
      this.updateConnectionStatus('Não conectado ao relay');
      return;
    }
    
    this.clientType = 'viewer';
    
    // Mostrar status de conexão
    const connectionStatus = document.getElementById('connectionStatus');
    const targetIdDisplay = document.getElementById('targetIdDisplay');
    const connectionInfo = document.getElementById('connectionInfo');
    
    if (connectionStatus) connectionStatus.style.display = 'block';
    if (targetIdDisplay) targetIdDisplay.textContent = remoteId;
    if (connectionInfo) connectionInfo.textContent = 'Registrando como viewer...';
    
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
      if (connectionInfo) connectionInfo.textContent = 'Solicitando conexão...';
      
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
    
    // Ocultar solicitação na aba Host
    const connectionRequests = document.getElementById('connectionRequests');
    const requestsList = document.getElementById('requestsList');
    
    if (connectionRequests) connectionRequests.style.display = 'none';
    if (requestsList) requestsList.innerHTML = '';
    
    // Atualizar status
    const listeningStatus = document.getElementById('listeningStatus');
    if (listeningStatus) {
      listeningStatus.textContent = accepted ? 'Conexão aceita - Sessão ativa' : 'Conexão rejeitada - Aguardando...';
    }
    
    // Mostrar/ocultar botão de desconectar para host
    const hostSessionControls = document.getElementById('hostSessionControls');
    if (hostSessionControls) {
      hostSessionControls.style.display = accepted ? 'block' : 'none';
    }
  }

  handleClientRegistered(message) {
    this.clientId = message.clientId;
    
    if (this.clientType === 'host') {
      // Atualizar elementos da aba Host
      const anydeskId = document.getElementById('anydeskId');
      const debugMyId = document.getElementById('debugMyId');
      const relayServerStatusHost = document.getElementById('relayServerStatusHost');
      const listeningStatus = document.getElementById('listeningStatus');
      
      if (anydeskId) {
        const formattedId = this.clientId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        anydeskId.textContent = formattedId;
      }
      
      if (debugMyId) debugMyId.textContent = this.clientId;
      if (relayServerStatusHost) relayServerStatusHost.textContent = 'Online';
      if (listeningStatus) listeningStatus.textContent = `Aguardando conexões - ID: ${this.clientId}`;
    }
    
    console.log(`Registrado como ${this.clientType} com ID: ${this.clientId}`);
  }

  handleConnectionRequest(message) {
    this.currentSession = {
      sessionId: message.sessionId,
      requesterId: message.requesterId,
      requestType: message.requestType
    };
    
    // Mostrar solicitação na aba Host
    const connectionRequests = document.getElementById('connectionRequests');
    const requestsList = document.getElementById('requestsList');
    
    if (connectionRequests) connectionRequests.style.display = 'block';
    
    if (requestsList) {
      requestsList.innerHTML = `
        <div class="connection-request-item" style="background: rgba(255, 193, 7, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h4>Nova Solicitação</h4>
          <p><strong>ID:</strong> ${message.requesterId}</p>
          <p><strong>Tipo:</strong> ${message.requestType === 'control' ? 'Controlar este computador' : 'Visualizar tela'}</p>
          <div style="margin-top: 1rem;">
            <button id="acceptConnectionBtn" class="btn-success" style="margin-right: 0.5rem;">Aceitar</button>
            <button id="rejectConnectionBtn" class="btn-danger">Rejeitar</button>
          </div>
        </div>
      `;
      
      // Adicionar event listeners para os novos botões
      const acceptBtn = document.getElementById('acceptConnectionBtn');
      const rejectBtn = document.getElementById('rejectConnectionBtn');
      
      if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
          this.acceptConnection(true);
        });
      }
      
      if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
          this.acceptConnection(false);
        });
      }
    }
  }

  handleConnectionAccepted(message) {
    console.log('Conexão aceita!', message);
    this.currentSession = { sessionId: message.sessionId };
    
    // Atualizar status na aba Viewer
    const connectionInfo = document.getElementById('connectionInfo');
    if (connectionInfo) connectionInfo.textContent = 'Conectado - Aguardando tela...';
    
    // Mostrar controles de sessão para viewer
    const sessionControls = document.getElementById('sessionControls');
    if (sessionControls) sessionControls.style.display = 'block';
    
    // Iniciar sessão remota se for viewer
    if (this.clientType === 'viewer') {
      this.startRemoteSession(message.sessionId);
    }
  }

  handleConnectionRejected(message) {
    this.showNotification('Conexão rejeitada pelo usuário remoto', 'warning');
    this.currentSession = null;
    
    // Ocultar controles de sessão
    const sessionControls = document.getElementById('sessionControls');
    if (sessionControls) sessionControls.style.display = 'none';
    
    // Atualizar status
    const connectionInfo = document.getElementById('connectionInfo');
    if (connectionInfo) connectionInfo.textContent = 'Conexão rejeitada';
  }

  handleConnectionEstablished(message) {
    console.log('Sessão estabelecida:', message);
    this.currentSession = { sessionId: message.sessionId };
    
    if (this.clientType === 'host') {
      // Mostrar botão de desconectar para host
      const hostSessionControls = document.getElementById('hostSessionControls');
      if (hostSessionControls) hostSessionControls.style.display = 'block';
      
      // Atualizar status do host
      const listeningStatus = document.getElementById('listeningStatus');
      if (listeningStatus) listeningStatus.textContent = 'Sessão ativa - Sendo controlado';
      
      this.startHostSession(message.sessionId);
    } else if (this.clientType === 'viewer') {
      // Mostrar botão de desconectar para viewer
      const sessionControls = document.getElementById('sessionControls');
      if (sessionControls) sessionControls.style.display = 'block';
      
      // Mostrar tela remota
      const remoteScreen = document.getElementById('remoteScreen');
      if (remoteScreen) remoteScreen.style.display = 'block';
      
      // Atualizar status do viewer
      const connectionInfo = document.getElementById('connectionInfo');
      if (connectionInfo) connectionInfo.textContent = 'Sessão ativa - Controlando remotamente';
    }
  }

  handleRelayData(message) {
    const { dataType, data, sessionId, senderId } = message;
    
    if (!this.currentSession || this.currentSession.sessionId !== sessionId) {
      console.warn('Dados relay para sessão inválida:', sessionId);
      return;
    }
    
    switch (dataType) {
      case 'screen':
        // Só processar se formos viewer
        if (this.clientType === 'viewer') {
          this.displayRemoteScreen(data);
        }
        break;
        
      case 'input':
        // Só processar se formos host
        if (this.clientType === 'host') {
          this.processRemoteInput(data);
        }
        break;
        
      case 'screen_request':
        // Host responde com frame de tela
        if (this.clientType === 'host') {
          this.sendScreenFrame();
        }
        break;
        
      default:
        console.warn('Tipo de dados desconhecido:', dataType);
    }
  }

  async sendScreenFrame() {
    try {
      if (window.electronAPI && window.electronAPI.captureScreenRelay) {
        const screenshot = await window.electronAPI.captureScreenRelay();
        
        if (screenshot && this.currentSession) {
          this.sendToRelay({
            type: 'relay_data',
            sessionId: this.currentSession.sessionId,
            dataType: 'screen',
            data: screenshot
          });
        }
      }
    } catch (error) {
      console.error('Erro ao enviar frame de tela:', error);
    }
  }

  handleSessionEnded(message) {
    console.log('Sessão encerrada:', message.reason);
    
    // PRIMEIRO: Limpar sessão e parar todos os intervalos
    this.currentSession = null;
    this.stopFrameRequests(); // Parar solicitações de frame
    
    // Parar captura de tela se ativa (host)
    if (this.screenCaptureInterval) {
      clearInterval(this.screenCaptureInterval);
      this.screenCaptureInterval = null;
    }
    
    if (this.clientType === 'host') {
      // Atualizar status na aba Host
      const listeningStatus = document.getElementById('listeningStatus');
      if (listeningStatus) {
        listeningStatus.textContent = `Aguardando conexões - ID: ${this.clientId}`;
      }
      
      // Ocultar solicitações se estiverem visíveis
      const connectionRequests = document.getElementById('connectionRequests');
      if (connectionRequests) connectionRequests.style.display = 'none';
      
      // Ocultar botão de desconectar
      const hostSessionControls = document.getElementById('hostSessionControls');
      if (hostSessionControls) hostSessionControls.style.display = 'none';
      
    } else if (this.clientType === 'viewer') {
      // Fechar TODAS as telas remotas (HTML + dinâmica)
      const remoteScreen = document.getElementById('remoteScreen');
      if (remoteScreen) {
        remoteScreen.style.display = 'none';
        console.log('Tela remota (HTML) fechada');
      }
      
      // Fechar tela remota dinâmica se existir
      const dynamicRemoteScreen = document.querySelector('[id^="remoteScreen"]');
      if (dynamicRemoteScreen && dynamicRemoteScreen !== remoteScreen) {
        dynamicRemoteScreen.style.display = 'none';
        console.log('Tela remota dinâmica fechada');
      }
      
      // Limpar canvas se existir
      const screenCanvas = document.getElementById('screenCanvas');
      if (screenCanvas) {
        const ctx = screenCanvas.getContext('2d');
        ctx.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
        console.log('Canvas limpo');
      }
      
      // Atualizar status na aba Viewer
      const connectionInfo = document.getElementById('connectionInfo');
      if (connectionInfo) connectionInfo.textContent = 'Desconectado';
      
      // Ocultar controles de sessão
      const sessionControls = document.getElementById('sessionControls');
      if (sessionControls) sessionControls.style.display = 'none';
      
      // Ocultar status de conexão
      const connectionStatus = document.getElementById('connectionStatus');
      if (connectionStatus) connectionStatus.style.display = 'none';
    }
    
    // Mostrar notificação UMA ÚNICA VEZ
    this.showNotification('Sessão encerrada: ' + message.reason, 'warning');
  }

  handleRelayError(message) {
    console.error('Erro do relay:', message.message);
    this.showNotification('Erro: ' + message.message, 'warning');
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
    if (window.electronAPI && window.electronAPI.captureScreenRelay) {
      // Usar captura nativa do Electron
      this.screenCaptureInterval = setInterval(async () => {
        try {
          // Capturar tela real via IPC
          const screenshot = await window.electronAPI.captureScreenRelay();
          
          if (screenshot) {
            this.sendToRelay({
              type: 'relay_data',
              sessionId: sessionId,
              dataType: 'screen',
              data: screenshot
            });
          }
        } catch (error) {
          console.error('Erro na captura de tela:', error);
        }
      }, 150); // ~6.5 FPS - Performance otimizada
    } else {
      console.error('electronAPI.captureScreenRelay não disponível');
    }
  }

  requestScreenFrames(sessionId) {
    // Solicitar frames periodicamente
    this.frameRequestInterval = setInterval(() => {
      // Verificar se ainda temos sessão ativa antes de solicitar
      if (!this.currentSession || this.currentSession.sessionId !== sessionId) {
        console.log('Sessão inválida, parando solicitações de frame');
        this.stopFrameRequests();
        return;
      }
      
      // Verificar se relay ainda está conectado
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.log('Relay desconectado, parando solicitações de frame');
        this.stopFrameRequests();
        return;
      }
      
      this.sendToRelay({
        type: 'relay_data',
        sessionId: sessionId,
        dataType: 'screen_request',
        data: 'request_frame'
      });
    }, 150); // Performance otimizada
  }

  stopFrameRequests() {
    if (this.frameRequestInterval) {
      clearInterval(this.frameRequestInterval);
      this.frameRequestInterval = null;
      console.log('Solicitações de frame interrompidas');
    }
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
    // Atualizar status em ambas as abas
    const relayServerStatusHost = document.getElementById('relayServerStatusHost');
    const relayConnectionStatus = document.getElementById('relayConnectionStatus');
    const debugRelayStatus = document.getElementById('debugRelayStatus');
    
    if (relayServerStatusHost) relayServerStatusHost.textContent = status;
    if (relayConnectionStatus) relayConnectionStatus.textContent = status;
    if (debugRelayStatus) debugRelayStatus.textContent = status;
  }

  updateConnectionStatus(status) {
    const connectionInfo = document.getElementById('connectionInfo');
    if (connectionInfo) {
      connectionInfo.textContent = status;
    }
  }

  showNotification(message, type = 'info') {
    // Criar notificação não-invasiva
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'warning' ? '#f39c12' : type === 'success' ? '#27ae60' : '#3498db'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 300px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Adicionar animação CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    // Remover após 4 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  }

  copyToClipboard() {
    if (this.clientId) {
      navigator.clipboard.writeText(this.clientId).then(() => {
        alert(`ID ${this.clientId} copiado para a área de transferência!`);
      }).catch(() => {
        // Fallback para navegadores mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = this.clientId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`ID ${this.clientId} copiado para a área de transferência!`);
      });
    }
  }

  showRemoteCanvas() {
    // Criar ou mostrar canvas para exibição da tela remota
    let remoteScreen = document.getElementById('remoteScreen');
    
    if (!remoteScreen) {
      remoteScreen = document.createElement('div');
      remoteScreen.id = 'remoteScreen';
      remoteScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 10000;
        display: none;
      `;
      
      const canvas = document.createElement('canvas');
      canvas.id = 'screenCanvas';
      canvas.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
        cursor: crosshair;
      `;
      
      // Configurar canvas para receber foco
      canvas.setAttribute('tabindex', '0');
      canvas.focus();
      
      // Adicionar eventos de input otimizados
      canvas.addEventListener('mousemove', (e) => this.sendInputToHost(e, 'mouseMove'));
      canvas.addEventListener('click', (e) => { 
        e.preventDefault();
        this.sendInputToHost(e, 'mouseClick');
        canvas.focus(); // Manter foco
      });
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.sendInputToHost(e, 'mouseClick', 'right');
      });
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.sendInputToHost(e, 'mouseWheel');
      });
      canvas.addEventListener('keydown', (e) => {
        e.preventDefault();
        this.sendInputToHost(e, 'keyDown');
      });
      canvas.addEventListener('keyup', (e) => {
        e.preventDefault();
        this.sendInputToHost(e, 'keyUp');
      });
      
      // Botão para fechar sessão
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Encerrar Sessão';
      closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 10001;
      `;
      closeBtn.addEventListener('click', () => {
        this.endSession();
      });
      
      remoteScreen.appendChild(canvas);
      remoteScreen.appendChild(closeBtn);
      document.body.appendChild(remoteScreen);
    }
    
    remoteScreen.style.display = 'block';
    const canvas = document.getElementById('screenCanvas');
    canvas.focus(); // Focar para receber eventos de teclado
  }

  sendInputToHost(event, type, buttonOverride = null) {
    if (!this.currentSession) return;
    
    const canvas = document.getElementById('screenCanvas');
    const rect = canvas.getBoundingClientRect();
    
    let inputData = {
      type: type,
      timestamp: Date.now()
    };
    
    if (type === 'mouseMove' || type === 'mouseClick') {
      // Converter coordenadas do canvas para coordenadas da tela
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      inputData.x = Math.floor((event.clientX - rect.left) * scaleX);
      inputData.y = Math.floor((event.clientY - rect.top) * scaleY);
      
      if (type === 'mouseClick') {
        inputData.button = buttonOverride || (event.button === 0 ? 'left' : event.button === 2 ? 'right' : 'middle');
      }
      
      console.log(`🖱️ ${type} em (${inputData.x}, ${inputData.y}) button: ${inputData.button || 'none'}`);
      
    } else if (type === 'mouseWheel') {
      // Mouse wheel
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      inputData.x = Math.floor((event.clientX - rect.left) * scaleX);
      inputData.y = Math.floor((event.clientY - rect.top) * scaleY);
      inputData.deltaX = event.deltaX;
      inputData.deltaY = event.deltaY;
      
      console.log(`🎡 Wheel em (${inputData.x}, ${inputData.y}) delta: ${inputData.deltaY}`);
      
    } else if (type === 'keyDown' || type === 'keyUp') {
      inputData.key = event.key;
      inputData.code = event.code;
      inputData.keyCode = event.keyCode;
      inputData.modifiers = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey
      };
      
      console.log(`⌨️ ${type}: ${event.key} (${event.code})`);
    }
    
    // Enviar input para o relay
    this.sendToRelay({
      type: 'relay_data',
      sessionId: this.currentSession.sessionId,
      dataType: 'input',
      data: inputData
    });
  }

  displayRemoteScreen(screenData) {
    try {
      const canvas = document.getElementById('screenCanvas');
      if (!canvas) {
        console.warn('Canvas não encontrado para exibir tela remota');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      
      if (screenData.type === 'image/jpeg' && screenData.data) {
        const img = new Image();
        img.onload = () => {
          canvas.width = screenData.width || img.width;
          canvas.height = screenData.height || img.height;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        
        img.onerror = () => {
          console.error('Erro ao carregar imagem da tela remota');
        };
        
        // Construir data URL se necessário
        const dataUrl = screenData.data.startsWith('data:') 
          ? screenData.data 
          : `data:${screenData.type};base64,${screenData.data}`;
          
        img.src = dataUrl;
      }
    } catch (error) {
      console.error('Erro ao exibir tela remota:', error);
    }
  }

  processRemoteInput(inputData) {
    // Processar input recebido via relay (quando estamos no modo host)
    if (window.electronAPI && window.electronAPI.sendInputRelay) {
      window.electronAPI.sendInputRelay(inputData)
        .then(result => {
          if (!result) {
            console.warn('Falha ao processar input remoto:', inputData);
          }
        })
        .catch(error => {
          console.error('Erro ao processar input remoto:', error);
        });
    } else {
      console.warn('electronAPI.sendInputRelay não disponível');
    }
  }

  disconnectSession() {
    // Função para desconectar sessão (chamada pelos botões)
    this.endSession();
    this.showNotification('Sessão encerrada pelo usuário', 'info');
  }

  endSession() {
    // PRIMEIRO: Parar todos os intervalos para evitar notificações em loop
    this.stopFrameRequests();
    
    if (this.screenCaptureInterval) {
      clearInterval(this.screenCaptureInterval);
      this.screenCaptureInterval = null;
    }
    
    // Enviar desconexão se temos sessão ativa
    if (this.currentSession) {
      this.sendToRelay({
        type: 'disconnect_session',
        sessionId: this.currentSession.sessionId
      });
      
      this.currentSession = null;
    }
    
    // Resetar elementos para ambos host e viewer
    if (this.clientType === 'host') {
      // Ocultar botão de desconectar host
      const hostSessionControls = document.getElementById('hostSessionControls');
      if (hostSessionControls) hostSessionControls.style.display = 'none';
      
      // Resetar status do host
      const listeningStatus = document.getElementById('listeningStatus');
      if (listeningStatus) {
        listeningStatus.textContent = this.clientId 
          ? `Aguardando conexões - ID: ${this.clientId}` 
          : 'Aguardando registro...';
      }
      
      // Ocultar solicitações
      const connectionRequests = document.getElementById('connectionRequests');
      if (connectionRequests) connectionRequests.style.display = 'none';
      
    } else if (this.clientType === 'viewer') {
      // Fechar TODAS as telas remotas de forma robusta
      this.closeAllRemoteScreens();
      
      // Ocultar botão de desconectar viewer
      const sessionControls = document.getElementById('sessionControls');
      if (sessionControls) sessionControls.style.display = 'none';
      
      // Resetar status do viewer
      const connectionStatus = document.getElementById('connectionStatus');
      if (connectionStatus) connectionStatus.style.display = 'none';
      
      const connectionInfo = document.getElementById('connectionInfo');
      if (connectionInfo) connectionInfo.textContent = 'Desconectado';
    }
  }

  // Função para fechar TODAS as telas remotas
  closeAllRemoteScreens() {
    console.log('🔄 Fechando todas as telas remotas...');
    
    // 1. Fechar tela remota do HTML principal
    const remoteScreen = document.getElementById('remoteScreen');
    if (remoteScreen) {
      remoteScreen.style.display = 'none';
      console.log('✅ Tela remota HTML fechada');
    }
    
    // 2. Fechar todas as telas criadas dinamicamente
    const allRemoteScreens = document.querySelectorAll('[id*="remoteScreen"], [class*="remote-screen"]');
    allRemoteScreens.forEach((screen, index) => {
      screen.style.display = 'none';
      console.log(`✅ Tela dinâmica ${index + 1} fechada`);
    });
    
    // 3. Limpar canvas
    const screenCanvas = document.getElementById('screenCanvas');
    if (screenCanvas) {
      const ctx = screenCanvas.getContext('2d');
      ctx.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
      screenCanvas.style.display = 'none'; // Garantir que canvas também seja oculto
      console.log('✅ Canvas limpo e oculto');
    }
    
    // 4. Remover qualquer overlay ou modal de tela remota
    const overlays = document.querySelectorAll('[style*="position: fixed"][style*="z-index"]');
    overlays.forEach(overlay => {
      if (overlay.querySelector('canvas') || overlay.textContent.includes('Controle Remoto')) {
        overlay.style.display = 'none';
        console.log('✅ Overlay de tela remota removido');
      }
    });
    
    console.log('🎯 Limpeza de tela remota concluída');
  }
}

// Integrar com a aplicação existente
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar cliente relay junto com a aplicação existente
  window.relayClient = new RemoteControlRelayClient();
});