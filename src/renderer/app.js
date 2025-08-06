class RemoteControlClient {
  constructor() {
    this.ws = null;
    this.isHost = false;
    this.isViewer = false;
    this.currentCode = null;
    this.codeExpiration = null;
    this.canvas = null;
    this.ctx = null;
    this.isConnected = false;
    this.currentAnydeskId = null;
    this.relayWs = null;
    this.currentRelaySession = null;
    this.relayScreenInterval = null;
    
    this.initializeUI();
    this.connectToServer();
    this.startStatusUpdates();
    this.detectLocalIP();
    this.initializeRelayIntegration();
    
    // Conectar ao relay automaticamente
    setTimeout(() => {
      this.connectToRelayServer();
    }, 2000);
  }

  initializeUI() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Host controls
    document.getElementById('generateCodeBtn').addEventListener('click', () => {
      this.generateAccessCode();
    });

    document.getElementById('copyCodeBtn').addEventListener('click', () => {
      this.copyCodeToClipboard();
    });

    document.getElementById('revokeCodeBtn').addEventListener('click', () => {
      this.revokeCurrentCode();
    });

    // Viewer controls
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connectAsViewer();
    });

    document.getElementById('disconnectBtn').addEventListener('click', () => {
      this.disconnect();
    });

    // AnyDesk-style relay controls
    // Host controls
    document.getElementById('copyAnydeskIdBtn').addEventListener('click', () => {
      this.copyAnydeskIdToClipboard();
    });

    document.getElementById('refreshAnydeskIdBtn').addEventListener('click', () => {
      this.generateNewAnydeskId();
    });

    // Viewer relay controls
    document.getElementById('connectViaIdBtn').addEventListener('click', () => {
      this.connectViaAnydeskId();
    });

    // Auto-format ID input (add spaces)
    document.getElementById('remoteId').addEventListener('input', (e) => {
      this.formatAnydeskIdInput(e.target);
    });

    // Debug buttons
    document.getElementById('debugRefreshBtn').addEventListener('click', () => {
      this.updateDebugInfo();
    });

    document.getElementById('debugTestConnBtn').addEventListener('click', () => {
      this.testRelayConnection();
    });

    // Settings
    document.getElementById('imageQuality').addEventListener('input', (e) => {
      document.getElementById('qualityValue').textContent = e.target.value;
    });

    document.getElementById('imageScale').addEventListener('input', (e) => {
      document.getElementById('scaleValue').textContent = e.target.value;
    });

    document.getElementById('refreshStatsBtn').addEventListener('click', () => {
      this.updateStats();
    });

    // Modal
    document.getElementById('closeAbout').addEventListener('click', () => {
      document.getElementById('aboutModal').style.display = 'none';
    });

    // Canvas setup
    this.canvas = document.getElementById('screenCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.setupCanvasEvents();

    // Electron menu events
    if (window.electronAPI) {
      window.electronAPI.onGenerateCode(() => {
        this.generateAccessCode();
      });

      window.electronAPI.onStartHost(() => {
        this.switchTab('host');
      });

      window.electronAPI.onConnectViewer(() => {
        this.switchTab('viewer');
      });

      window.electronAPI.onDisconnect(() => {
        this.disconnect();
      });

      window.electronAPI.onShowAbout(() => {
        document.getElementById('aboutModal').style.display = 'block';
      });
    }
  }

  switchTab(tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    // Update stats if settings tab is selected
    if (tabName === 'settings') {
      this.updateStats();
    }
  }

  async connectToServer() {
    try {
      // Por padrão conecta local, mas pode ser alterado na interface
      const serverUrl = this.serverUrl || 'ws://localhost:3000';
      this.ws = new WebSocket(serverUrl);

      this.ws.onopen = () => {
        console.log('Conectado ao servidor');
        this.updateServerStatus(true);
      };

      this.ws.onmessage = (event) => {
        this.handleServerMessage(event);
      };

      this.ws.onclose = () => {
        console.log('Desconectado do servidor');
        this.updateServerStatus(false);
        // Tentar reconectar após 3 segundos
        setTimeout(() => this.connectToServer(), 3000);
      };

      this.ws.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        this.updateServerStatus(false);
      };

    } catch (error) {
      console.error('Erro ao conectar:', error);
      this.updateServerStatus(false);
    }
  }

  handleServerMessage(event) {
    try {
      // Verificar se é uma mensagem binária (screenshot)
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        this.handleScreenshot(event.data);
        return;
      }

      const message = JSON.parse(event.data);
      console.log('Mensagem recebida:', message);

      switch (message.type) {
        case 'connected':
          console.log('Cliente ID:', message.clientId);
          break;

        case 'host_registered':
          this.handleHostRegistered(message);
          break;

        case 'viewer_connected':
          this.handleViewerConnected(message);
          break;

        case 'viewer_joined':
          this.handleViewerJoined(message);
          break;

        case 'session_ended':
          this.handleSessionEnded();
          break;

        case 'auth_failed':
        case 'connection_failed':
          this.handleConnectionError(message.message);
          break;

        case 'error':
          console.error('Erro do servidor:', message.message);
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  }

  async generateAccessCode() {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.generateAccessCode();
        if (result) {
          this.displayAccessCode(result.code, result.expires);
          this.registerAsHost(result.code);
        }
      }
    } catch (error) {
      console.error('Erro ao gerar código:', error);
    }
  }

  displayAccessCode(code, expires) {
    this.currentCode = code;
    this.codeExpiration = expires;

    document.getElementById('accessCode').textContent = code;
    document.getElementById('accessCodeDisplay').style.display = 'block';
    document.getElementById('hostInfo').style.display = 'block';
    
    this.updateCodeExpiration();
    
    // Atualizar expiração a cada segundo
    this.expirationInterval = setInterval(() => {
      this.updateCodeExpiration();
    }, 1000);
  }

  updateCodeExpiration() {
    if (!this.codeExpiration) return;

    const now = Date.now();
    const timeLeft = this.codeExpiration - now;

    if (timeLeft <= 0) {
      document.getElementById('codeExpiration').textContent = 'EXPIRADO';
      document.getElementById('accessCodeDisplay').style.display = 'none';
      if (this.expirationInterval) {
        clearInterval(this.expirationInterval);
      }
      return;
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    document.getElementById('codeExpiration').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  copyCodeToClipboard() {
    if (this.currentCode) {
      navigator.clipboard.writeText(this.currentCode).then(() => {
        // Feedback visual
        const btn = document.getElementById('copyCodeBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copiado!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      });
    }
  }

  async revokeCurrentCode() {
    if (this.currentCode && window.electronAPI) {
      try {
        await window.electronAPI.revokeCode(this.currentCode);
        document.getElementById('accessCodeDisplay').style.display = 'none';
        this.currentCode = null;
        if (this.expirationInterval) {
          clearInterval(this.expirationInterval);
        }
      } catch (error) {
        console.error('Erro ao revogar código:', error);
      }
    }
  }

  registerAsHost(code) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'register_host',
        accessCode: code
      }));
      this.isHost = true;
    }
  }

  connectAsViewer() {
    const code = document.getElementById('connectCode').value.trim();
    const hostIP = document.getElementById('hostIP').value.trim();
    
    if (!code || code.length !== 6) {
      alert('Por favor, digite um código de 6 dígitos válido');
      return;
    }

    // Se IP foi especificado, criar nova conexão dedicada para viewer
    if (hostIP) {
      this.connectToRemoteHost(hostIP, code);
    } else {
      this.sendViewerCode(code);
    }
  }

  async connectToRemoteHost(hostIP, code) {
    try {
      // Mostrar status de conexão
      document.getElementById('connectionStatus').style.display = 'block';
      this.updateConnectionStatus('Conectando...', false);
      
      // Criar nova conexão WebSocket dedicada para o host remoto
      const remoteUrl = `ws://${hostIP}:3000`;
      console.log(`Conectando ao host remoto: ${remoteUrl}`);
      
      // Manter conexão local para status, criar nova para controle remoto
      this.remoteWs = new WebSocket(remoteUrl);
      
      this.remoteWs.onopen = () => {
        console.log('Conectado ao host remoto');
        this.updateConnectionStatus('Conectado ao host remoto', true);
        
        // Enviar código para o host remoto
        this.remoteWs.send(JSON.stringify({
          type: 'connect_viewer',
          accessCode: code
        }));
      };

      this.remoteWs.onmessage = (event) => {
        this.handleRemoteMessage(event);
      };

      this.remoteWs.onclose = () => {
        console.log('Desconectado do host remoto');
        this.updateConnectionStatus('Desconectado do host remoto', false);
      };

      this.remoteWs.onerror = (error) => {
        console.error('Erro na conexão remota:', error);
        alert(`Erro ao conectar ao IP ${hostIP}:3000. Verifique se o host está executando e o IP está correto.`);
        this.updateConnectionStatus('Erro de conexão', false);
      };

    } catch (error) {
      console.error('Erro ao conectar ao host remoto:', error);
      alert(`Erro ao conectar: ${error.message}`);
    }
  }

  handleRemoteMessage(event) {
    // Usar a mesma lógica de handleServerMessage, mas para conexão remota
    this.handleServerMessage(event);
  }

  updateConnectionStatus(message, isConnected) {
    const statusElement = document.getElementById('connectionInfo');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.style.color = isConnected ? '#38a169' : '#e53e3e';
    }
  }
  
  sendViewerCode(code) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'connect_viewer',
        accessCode: code
      }));
    } else {
      alert('Não foi possível conectar ao servidor host. Verifique o IP e tente novamente.');
    }
  }

  disconnect() {
    // Desconectar da sessão remota se existir
    if (this.remoteWs && this.remoteWs.readyState === WebSocket.OPEN) {
      this.remoteWs.send(JSON.stringify({
        type: 'disconnect_session'
      }));
      this.remoteWs.close();
      this.remoteWs = null;
    }
    
    // Desconectar da sessão local se existir
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'disconnect_session'
      }));
    }
    
    this.isHost = false;
    this.isViewer = false;
    this.isConnected = false;
    
    // Parar requisições de tela
    if (this.screenRequestInterval) {
      clearInterval(this.screenRequestInterval);
      this.screenRequestInterval = null;
    }
    
    // Reset UI
    document.getElementById('connectBtn').style.display = 'inline-block';
    document.getElementById('disconnectBtn').style.display = 'none';
    document.getElementById('connectionStatus').style.display = 'none';
    document.getElementById('remoteScreen').style.display = 'none';
    this.updateConnectionStatus('Desconectado', false);
  }

  handleHostRegistered(message) {
    console.log('Host registrado com sucesso:', message.sessionId);
    this.isHost = true;
    this.isConnected = true;
  }

  handleViewerConnected(message) {
    console.log('Conectado como viewer:', message.sessionId);
    this.isViewer = true;
    this.isConnected = true;
    
    // Update UI
    document.getElementById('connectBtn').style.display = 'none';
    document.getElementById('disconnectBtn').style.display = 'inline-block';
    document.getElementById('connectionStatus').style.display = 'block';
    document.getElementById('connectionInfo').textContent = 'Conectado';
    document.getElementById('remoteScreen').style.display = 'block';
    
    // Start requesting screenshots
    this.startScreenRequests();
  }

  handleViewerJoined(message) {
    console.log('Viewer conectado:', message.viewerId);
    // Update sessions list
    this.updateSessionsList();
  }

  handleSessionEnded() {
    console.log('Sessão encerrada');
    this.disconnect();
    alert('A sessão foi encerrada pelo host');
  }

  handleConnectionError(message) {
    console.error('Erro de conexão:', message);
    alert(`Erro: ${message}`);
  }

  startScreenRequests() {
    if (!this.isViewer) return;
    
    this.screenRequestInterval = setInterval(() => {
      const activeWs = this.remoteWs || this.ws;
      if (activeWs && activeWs.readyState === WebSocket.OPEN && this.isViewer) {
        activeWs.send(JSON.stringify({
          type: 'screen_request'
        }));
      }
    }, 100); // 10 FPS
  }

  handleScreenshot(data) {
    if (!this.isViewer || !this.canvas) return;

    const blob = new Blob([data], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = () => {
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  setupCanvasEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isViewer) return;
      this.sendInputEvent({
        type: 'mouseMove',
        x: e.offsetX,
        y: e.offsetY
      });
    });

    this.canvas.addEventListener('click', (e) => {
      if (!this.isViewer) return;
      this.sendInputEvent({
        type: 'mouseClick',
        x: e.offsetX,
        y: e.offsetY,
        button: 'left'
      });
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.isViewer) return;
      this.sendInputEvent({
        type: 'mouseClick',
        x: e.offsetX,
        y: e.offsetY,
        button: 'right'
      });
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.isViewer) return;
      this.sendInputEvent({
        type: 'mouseWheel',
        x: e.offsetX,
        y: e.offsetY,
        deltaX: e.deltaX,
        deltaY: e.deltaY
      });
    });

    // Keyboard events (canvas needs to be focused)
    this.canvas.setAttribute('tabindex', '0');
    
    this.canvas.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (!this.isViewer) return;
      this.sendInputEvent({
        type: 'keyPress',
        key: e.key,
        modifiers: this.getModifiers(e)
      });
    });
  }

  sendInputEvent(event) {
    const activeWs = this.remoteWs || this.ws;
    if (activeWs && activeWs.readyState === WebSocket.OPEN && this.isViewer) {
      activeWs.send(JSON.stringify({
        type: 'input_event',
        event: event
      }));
    }
  }

  getModifiers(e) {
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('control');
    if (e.shiftKey) modifiers.push('shift');
    if (e.altKey) modifiers.push('alt');
    if (e.metaKey) modifiers.push('cmd');
    return modifiers;
  }

  updateServerStatus(isOnline) {
    const indicator = document.getElementById('serverStatus');
    const info = document.getElementById('serverInfo');
    const localStatus = document.getElementById('localServerStatus');
    
    if (isOnline) {
      indicator.classList.add('online');
      info.textContent = 'Servidor Online';
      if (localStatus) {
        localStatus.textContent = 'Online';
        localStatus.style.color = '#38a169';
      }
    } else {
      indicator.classList.remove('online');
      info.textContent = 'Servidor Offline';
      if (localStatus) {
        localStatus.textContent = 'Offline';
        localStatus.style.color = '#e53e3e';
      }
    }
  }

  async updateStats() {
    if (!window.electronAPI) return;

    try {
      const [serverInfo, authStats] = await Promise.all([
        window.electronAPI.getServerInfo(),
        window.electronAPI.getAuthStats()
      ]);

      const statsDisplay = document.getElementById('statsDisplay');
      statsDisplay.innerHTML = `
        <p><strong>Servidor:</strong> Porta ${serverInfo.port}</p>
        <p><strong>Clientes conectados:</strong> ${serverInfo.clients}</p>
        <p><strong>Sessões ativas:</strong> ${serverInfo.sessions}</p>
        <p><strong>Códigos totais:</strong> ${authStats?.total || 0}</p>
        <p><strong>Códigos ativos:</strong> ${authStats?.active || 0}</p>
        <p><strong>Códigos expirados:</strong> ${authStats?.expired || 0}</p>
      `;

      // Update footer
      document.getElementById('connectionCount').textContent = 
        `${serverInfo.clients} conexões ativas`;

    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
    }
  }

  updateSessionsList() {
    // This would be implemented with real session data from the server
    const sessionsList = document.getElementById('sessionsList');
    if (this.isHost && this.isConnected) {
      sessionsList.innerHTML = '<p>1 viewer conectado</p>';
    } else {
      sessionsList.innerHTML = '<p class="no-sessions">Nenhuma sessão ativa</p>';
    }
  }

  startStatusUpdates() {
    // Update stats every 5 seconds
    setInterval(() => {
      if (document.querySelector('[data-tab="settings"]').classList.contains('active')) {
        this.updateStats();
      }
    }, 5000);
  }

  async detectLocalIP() {
    try {
      // Usar API do navegador para detectar IP local
      const pc = new RTCPeerConnection({iceServers: []});
      pc.createDataChannel('');
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (ipMatch && ipMatch[0] !== '127.0.0.1') {
            document.getElementById('localIP').textContent = ipMatch[0];
            pc.close();
          }
        }
      };
      
      await pc.createOffer();
      await pc.setLocalDescription(pc.localDescription);
      
      // Fallback após 3 segundos
      setTimeout(() => {
        if (document.getElementById('localIP').textContent === 'Carregando...') {
          document.getElementById('localIP').textContent = 'Não detectado (use ipconfig)';
        }
      }, 3000);
      
    } catch (error) {
      console.error('Erro ao detectar IP:', error);
      document.getElementById('localIP').textContent = 'Use: ipconfig (Windows) ou ifconfig (Linux/Mac)';
    }
  }

  // ====== SISTEMA ANYDESK-STYLE RELAY ======

  generateAnydeskId() {
    // Gerar ID de 9 dígitos estilo AnyDesk
    const id = Math.floor(100000000 + Math.random() * 900000000).toString();
    const formattedId = `${id.slice(0,3)} ${id.slice(3,6)} ${id.slice(6,9)}`;
    
    document.getElementById('anydeskId').textContent = formattedId;
    this.currentAnydeskId = id;
    
    // ID será registrado automaticamente quando conectado ao relay
    
    console.log(`ID AnyDesk gerado: ${formattedId} (${id})`);
  }

  // Nova função para registrar diretamente no relay
  registerWithRelayServer() {
    // Criar conexão WebSocket direta se não existir
    if (!this.relayWs || this.relayWs.readyState !== WebSocket.OPEN) {
      this.connectToRelayServer();
      return;
    }
    
    // Registrar imediatamente se conectado
    this.relayWs.send(JSON.stringify({
      type: 'register_client',
      clientType: 'host',
      deviceInfo: {
        os: navigator.platform,
        userAgent: navigator.userAgent.substring(0, 100)
      }
    }));
    
    this.updateRelayStatus('🟢 Conectado', '🔄 Registrando...');
    console.log(`Registro enviado para relay`);
  }

  // Conectar ao servidor relay
  connectToRelayServer() {
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      return; // Já conectado
    }

    try {
      this.updateRelayStatus('🔄 Conectando...', '🔄 Conectando ao relay...');
      this.relayWs = new WebSocket('ws://54.232.138.198:8080');

      this.relayWs.onopen = () => {
        console.log('Conectado ao servidor relay AWS');
        this.updateRelayStatus('🟢 Conectado', '🟢 Online');
        
        // Registrar automaticamente como host após conectar
        if (!this.currentAnydeskId) {
          this.registerWithRelayServer();
        }
      };

      this.relayWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleRelayMessage(message);
        } catch (error) {
          console.error('Erro ao processar mensagem relay:', error);
        }
      };

      this.relayWs.onclose = () => {
        console.log('Desconectado do servidor relay');
        this.updateRelayStatus('🔴 Desconectado', '🔴 Offline');
        // Tentar reconectar em 5 segundos
        setTimeout(() => this.connectToRelayServer(), 5000);
      };

      this.relayWs.onerror = (error) => {
        console.error('Erro WebSocket relay:', error);
        this.updateRelayStatus('❌ Erro', '❌ Erro de conexão');
      };

    } catch (error) {
      console.error('Erro ao conectar relay:', error);
      this.updateRelayStatus('❌ Erro', '❌ Falha na conexão');
    }
  }

  // Processar mensagens do relay
  handleRelayMessage(message) {
    // Atualizar debug com última mensagem
    document.getElementById('debugLastMessage').textContent = `📥 ${message.type} (${new Date().toLocaleTimeString()})`;
    
    console.log('Mensagem relay recebida:', message);
    
    switch (message.type) {
      case 'server_hello':
        console.log('Conectado ao servidor relay:', message.message);
        break;
        
      case 'client_registered':
        console.log(`Cliente registrado com ID: ${message.clientId}`);
        this.currentAnydeskId = message.clientId;
        const formattedId = `${message.clientId.slice(0,3)} ${message.clientId.slice(3,6)} ${message.clientId.slice(6,9)}`;
        document.getElementById('anydeskId').textContent = formattedId;
        this.updateRelayStatus('🟢 Conectado', `🆔 ID: ${formattedId}`);
        break;
        
      case 'connection_request':
        this.showConnectionRequest(message.requesterId, message.sessionId, message.requestType);
        break;
        
      case 'connection_requested':
        console.log('Solicitação enviada:', message.message);
        document.getElementById('connectionInfo').textContent = message.message;
        break;
        
      case 'connection_accepted':
        this.handleConnectionAccepted(message.sessionId);
        break;
        
      case 'connection_rejected':
        this.handleConnectionRejected();
        break;
        
      case 'connection_established':
        console.log('Conexão estabelecida como host:', message.sessionId);
        this.currentRelaySession = message.sessionId;
        this.startRelayScreenCapture();
        break;
        
      case 'session_ended':
        this.handleSessionEnded(message.sessionId);
        break;
        
      case 'relay_data':
        this.handleRelayData(message);
        break;
        
      case 'error':
        console.error('Erro do servidor relay:', message.message);
        this.showNotification('Erro: ' + message.message, 'error');
        break;
        
      case 'test_pong':
        document.getElementById('debugLastMessage').textContent = `📥 Teste OK: ${new Date().toLocaleTimeString()}`;
        this.showNotification('Teste de conexão OK!', 'success');
        break;
        
      case 'stats_response':
        console.log('Estatísticas do servidor:', message);
        break;
        
      default:
        console.log('Tipo de mensagem relay desconhecido:', message.type);
        document.getElementById('debugLastMessage').textContent = `❓ ${message.type}`;
    }
  }

  // Tratar falha de conexão
  handleConnectFailed(reason, targetId) {
    console.log(`Conexão falhou: ${reason} (ID: ${targetId})`);
    
    document.getElementById('connectionInfo').textContent = `Falha: ${reason}`;
    
    if (reason.includes('não encontrado') || reason.includes('offline')) {
      this.showNotification(`ID ${targetId} não encontrado ou offline`, 'error');
    } else {
      this.showNotification(`Erro na conexão: ${reason}`, 'error');
    }
  }

  // Tratar conexão aceita
  handleConnectionAccepted(sessionId) {
    console.log(`Conexão aceita! Sessão: ${sessionId}`);
    this.currentRelaySession = sessionId;
    
    // Atualizar interface do viewer
    document.getElementById('connectionInfo').textContent = '✅ Conectado! Iniciando controle remoto...';
    document.getElementById('sessionControls').style.display = 'block';
    document.getElementById('activeSessionId').textContent = sessionId.slice(0, 8);
    
    this.showNotification('Conexão estabelecida! Iniciando tela remota...', 'success');
    
    // Iniciar captura de tela se for host
    if (this.isHost || this.currentAnydeskId) {
      this.startRelayScreenCapture();
    }
    
    // Mostrar tela remota se for viewer
    if (!this.isHost && !this.currentAnydeskId) {
      document.getElementById('remoteScreen').style.display = 'block';
      this.setupRelayCanvas();
    }
  }

  // Tratar conexão rejeitada
  handleConnectionRejected(sessionId) {
    console.log(`Conexão rejeitada. Sessão: ${sessionId}`);
    
    document.getElementById('connectionInfo').textContent = '❌ Conexão rejeitada pelo host';
    this.showNotification('Host rejeitou a conexão', 'error');
    
    // Limpar interface
    document.getElementById('sessionControls').style.display = 'none';
    document.getElementById('remoteScreen').style.display = 'none';
  }

  // Configurar canvas para exibir tela remota
  setupRelayCanvas() {
    const canvas = document.getElementById('screenCanvas');
    if (!canvas) return;
    
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Configurar eventos do mouse para enviar para o host
    canvas.addEventListener('mousemove', (e) => {
      if (this.currentRelaySession) {
        this.sendRelayInput('mouseMove', { x: e.offsetX, y: e.offsetY });
      }
    });
    
    canvas.addEventListener('click', (e) => {
      if (this.currentRelaySession) {
        this.sendRelayInput('mouseClick', { x: e.offsetX, y: e.offsetY, button: e.button });
      }
    });
    
    // Configurar eventos do teclado
    document.addEventListener('keydown', (e) => {
      if (this.currentRelaySession && document.getElementById('remoteScreen').style.display === 'block') {
        this.sendRelayInput('keyDown', { key: e.key, code: e.code });
        e.preventDefault();
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (this.currentRelaySession && document.getElementById('remoteScreen').style.display === 'block') {
        this.sendRelayInput('keyUp', { key: e.key, code: e.code });
        e.preventDefault();
      }
    });
    
    console.log('Canvas configurado para controle remoto');
  }

  // Enviar input do viewer para o host via relay
  sendRelayInput(type, data) {
    if (!this.relayWs || this.relayWs.readyState !== WebSocket.OPEN) {
      return;
    }
    
    this.relayWs.send(JSON.stringify({
      type: 'relay_data',
      sessionId: this.currentRelaySession,
      dataType: 'input',
      data: { type, ...data }
    }));
  }

  // Iniciar captura de tela no host para relay
  startRelayScreenCapture() {
    if (this.relayScreenInterval) {
      clearInterval(this.relayScreenInterval);
    }
    
    console.log('Iniciando captura de tela para relay...');
    
    // Capturar e enviar tela a cada 200ms (5 FPS)
    this.relayScreenInterval = setInterval(async () => {
      try {
        if (!this.currentRelaySession || !this.relayWs || this.relayWs.readyState !== WebSocket.OPEN) {
          return;
        }
        
        // Capturar tela via Electron API
        const screenshot = await this.captureScreenForRelay();
        
        if (screenshot) {
          this.relayWs.send(JSON.stringify({
            type: 'relay_data',
            sessionId: this.currentRelaySession,
            dataType: 'screen',
            data: screenshot
          }));
        }
        
      } catch (error) {
        console.error('Erro na captura para relay:', error);
      }
    }, 200); // 5 FPS
  }

  // Capturar tela para relay
  async captureScreenForRelay() {
    try {
      if (window.electronAPI && window.electronAPI.captureScreen) {
        // Usar API do Electron se disponível
        return await window.electronAPI.captureScreen();
      } else {
        // Fallback: usar API do navegador (limitado)
        return await this.captureViaWebAPI();
      }
    } catch (error) {
      console.error('Erro na captura de tela:', error);
      return null;
    }
  }

  // Fallback para captura via Web API
  async captureViaWebAPI() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(video.videoWidth * 0.5); // Reduzir resolução
          canvas.height = Math.floor(video.videoHeight * 0.5);
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          stream.getTracks().forEach(track => track.stop());
          
          resolve({
            type: 'image/jpeg',
            data: canvas.toDataURL('image/jpeg', 0.6).split(',')[1], // Qualidade 60%
            width: canvas.width,
            height: canvas.height,
            timestamp: Date.now()
          });
        };
      });
    } catch (error) {
      console.error('Erro na captura web:', error);
      return null;
    }
  }

  // Processar dados do relay
  handleRelayData(message) {
    const { dataType, data } = message;
    
    switch (dataType) {
      case 'screen':
        this.displayRelayScreen(data);
        break;
        
      case 'input':
        this.processRelayInput(data);
        break;
        
      default:
        console.log('Tipo de dados relay desconhecido:', dataType);
    }
  }

  // Exibir tela remota recebida via relay
  displayRelayScreen(screenData) {
    if (!this.canvas || !this.ctx) return;
    
    try {
      const img = new Image();
      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
      };
      
      img.src = `data:${screenData.type};base64,${screenData.data}`;
    } catch (error) {
      console.error('Erro ao exibir tela relay:', error);
    }
  }

  // Processar input recebido via relay (no host)
  processRelayInput(inputData) {
    if (window.electronAPI && window.electronAPI.sendInput) {
      // Enviar para processo principal do Electron
      window.electronAPI.sendInput(inputData);
    } else {
      console.log('Input recebido via relay:', inputData);
      // Fallback para debug
    }
  }

  copyAnydeskIdToClipboard() {
    const id = document.getElementById('anydeskId').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id.replace(/\s/g, '')).then(() => {
        this.showNotification('ID copiado para área de transferência!', 'success');
      });
    } else {
      // Fallback para browsers mais antigos
      const textArea = document.createElement('textarea');
      textArea.value = id.replace(/\s/g, '');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showNotification('ID copiado!', 'success');
    }
  }

  generateNewAnydeskId() {
    // Revogar ID atual se existir
    if (this.currentAnydeskId && window.relayClient) {
      window.relayClient.unregister();
    }
    
    // Gerar novo ID
    this.generateAnydeskId();
    this.showNotification('Novo ID gerado!', 'info');
  }

  formatAnydeskIdInput(input) {
    // Pegar posição do cursor antes da formatação
    const cursorPos = input.selectionStart;
    
    // Formatar input com espaços automáticos
    let value = input.value.replace(/\D/g, ''); // Remove não-dígitos
    if (value.length > 9) value = value.slice(0, 9); // Máximo 9 dígitos
    
    // Adicionar espaços para visualização
    let formattedValue = value;
    if (value.length > 6) {
      formattedValue = `${value.slice(0,3)} ${value.slice(3,6)} ${value.slice(6)}`;
    } else if (value.length > 3) {
      formattedValue = `${value.slice(0,3)} ${value.slice(3)}`;
    }
    
    input.value = formattedValue;
    
    // Restaurar posição do cursor (aproximadamente)
    let newCursorPos = cursorPos;
    if (cursorPos > 3 && formattedValue.length > 3) newCursorPos++;
    if (cursorPos > 6 && formattedValue.length > 7) newCursorPos++;
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    // Debug
    console.log(`Input formatado: "${input.value}" (${value.length} dígitos)`);
  }

  async connectViaAnydeskId() {
    const remoteIdInput = document.getElementById('remoteId');
    const originalInput = remoteIdInput.value.trim(); // Remove espaços do início/fim
    const remoteId = originalInput.replace(/\s/g, ''); // Remove todos os espaços
    
    // Validar se tem apenas números
    if (!remoteId || !/^\d{9}$/.test(remoteId)) {
      this.showNotification('Digite um ID válido de 9 dígitos (apenas números)', 'error');
      console.log(`ID inválido: "${originalInput}" -> "${remoteId}" (${remoteId.length} caracteres)`);
      return;
    }
    
    console.log(`Conectando ao ID: "${originalInput}" -> "${remoteId}"`);

    try {
      // Conectar ao relay se não estiver conectado
      if (!this.relayWs || this.relayWs.readyState !== WebSocket.OPEN) {
        this.connectToRelayServer();
        // Aguardar conexão
        await new Promise((resolve) => {
          const checkConnection = () => {
            if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
              resolve();
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        });
      }

      // Mostrar status de conexão
      document.getElementById('connectionStatus').style.display = 'block';
      document.getElementById('targetIdDisplay').textContent = remoteIdInput.value;
      document.getElementById('relayConnectionStatus').textContent = '🟢 Conectado ao relay';
      document.getElementById('connectionInfo').textContent = 'Solicitando conexão...';

      // Registrar como viewer primeiro
      this.relayWs.send(JSON.stringify({
        type: 'register_client',
        clientType: 'viewer',
        deviceInfo: {
          os: navigator.platform,
          userAgent: navigator.userAgent.substring(0, 100)
        }
      }));

      // Aguardar um pouco e solicitar conexão
      setTimeout(() => {
        this.relayWs.send(JSON.stringify({
          type: 'request_connection',
          targetClientId: remoteId,
          requestType: 'control'
        }));
        
        document.getElementById('connectionInfo').textContent = 'Aguardando aprovação do host...';
        this.showNotification(`Solicitando conexão ao ID ${remoteIdInput.value}...`, 'info');
      }, 500);

    } catch (error) {
      console.error('Erro ao conectar via ID:', error);
      document.getElementById('relayConnectionStatus').textContent = '❌ Erro na conexão';
      document.getElementById('connectionInfo').textContent = 'Falha na conexão';
      this.showNotification('Erro ao conectar: ' + error.message, 'error');
    }
  }

  updateRelayStatus(localStatus, relayStatus) {
    const localStatusElement = document.getElementById('localServerStatusHost');
    const relayStatusElement = document.getElementById('relayServerStatusHost');
    
    if (localStatusElement) localStatusElement.textContent = localStatus;
    if (relayStatusElement) relayStatusElement.textContent = relayStatus;
  }

  showNotification(message, type = 'info') {
    // Criar notificação visual
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    `;

    // Cores baseadas no tipo
    switch(type) {
      case 'success':
        notification.style.background = '#10b981';
        notification.style.color = 'white';
        break;
      case 'error':
        notification.style.background = '#ef4444';
        notification.style.color = 'white';
        break;
      case 'info':
        notification.style.background = '#3b82f6';
        notification.style.color = 'white';
        break;
      default:
        notification.style.background = '#6b7280';
        notification.style.color = 'white';
    }

    document.body.appendChild(notification);

    // Remover após 3 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  }

  // Integração com relay client quando disponível
  initializeRelayIntegration() {
    // Aguardar relay client estar disponível
    const checkRelay = () => {
      if (window.relayClient) {
        // Configurar handlers
        window.relayClient.onConnectionRequest = (fromId, sessionId) => {
          this.showConnectionRequest(fromId, sessionId);
        };

        window.relayClient.onSessionStart = (sessionId, remoteId) => {
          this.startRelaySession(sessionId, remoteId);
        };

        window.relayClient.onSessionEnd = (sessionId) => {
          this.endRelaySession(sessionId);
        };

        // O ID será gerado quando conectado ao relay
        
        console.log('Sistema relay integrado');
      } else {
        // Tentar novamente em 1 segundo
        setTimeout(checkRelay, 1000);
      }
    };
    
    checkRelay();
  }

  showConnectionRequest(fromId, sessionId, requestType = 'controle') {
    // Mostrar solicitação de conexão
    const requestsDiv = document.getElementById('connectionRequests');
    const requestsList = document.getElementById('requestsList');
    
    // Limpar solicitações anteriores
    requestsList.innerHTML = '';
    
    const formattedId = fromId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    
    const requestElement = document.createElement('div');
    requestElement.className = 'connection-request';
    requestElement.innerHTML = `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
        <h5>🔔 Solicitação de Conexão</h5>
        <p><strong>ID:</strong> ${formattedId}</p>
        <p><strong>Tipo:</strong> ${requestType}</p>
        <p>Deseja permitir o controle remoto?</p>
        <div style="margin-top: 1rem;">
          <button onclick="remoteControlClient.acceptConnection('${sessionId}')" 
                  style="background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; margin-right: 0.5rem; cursor: pointer;">
            ✅ Aceitar
          </button>
          <button onclick="remoteControlClient.rejectConnection('${sessionId}')" 
                  style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
            ❌ Rejeitar
          </button>
        </div>
      </div>
    `;
    
    requestsList.appendChild(requestElement);
    requestsDiv.style.display = 'block';
    
    this.showNotification(`Solicitação de ${formattedId}`, 'info');
  }

  acceptConnection(sessionId) {
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      this.relayWs.send(JSON.stringify({
        type: 'accept_connection',
        sessionId: sessionId,
        accepted: true
      }));
      
      // Limpar interface de solicitações
      document.getElementById('connectionRequests').style.display = 'none';
      document.getElementById('requestsList').innerHTML = '';
      
      this.showNotification('Conexão aceita', 'success');
    }
  }

  rejectConnection(sessionId) {
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      this.relayWs.send(JSON.stringify({
        type: 'accept_connection',
        sessionId: sessionId,
        accepted: false
      }));
      
      // Limpar interface de solicitações
      document.getElementById('connectionRequests').style.display = 'none';
      document.getElementById('requestsList').innerHTML = '';
      
      this.showNotification('Conexão rejeitada', 'info');
    }
  }

  startRelaySession(sessionId, remoteId) {
    // Iniciar sessão relay
    document.getElementById('activeSessionId').textContent = remoteId;
    document.getElementById('sessionControls').style.display = 'block';
    
    this.showNotification('Sessão iniciada', 'success');
    console.log(`Sessão relay iniciada: ${sessionId} com ${remoteId}`);
  }

  endRelaySession(sessionId) {
    // Finalizar sessão relay
    document.getElementById('sessionControls').style.display = 'none';
    document.getElementById('remoteScreen').style.display = 'none';
    
    this.showNotification('Sessão finalizada', 'info');
    console.log(`Sessão relay finalizada: ${sessionId}`);
  }

  // ====== FUNÇÕES DE DEBUG ======

  updateDebugInfo() {
    // Atualizar informações de debug na interface
    const relayStatus = this.relayWs ? 
      (this.relayWs.readyState === 1 ? '🟢 Conectado' : 
       this.relayWs.readyState === 0 ? '🔄 Conectando' : 
       this.relayWs.readyState === 2 ? '🔴 Fechando' : '❌ Desconectado') 
      : '❌ Não inicializado';
    
    document.getElementById('debugRelayStatus').textContent = relayStatus;
    document.getElementById('debugMyId').textContent = this.currentAnydeskId || 'Não gerado';
    document.getElementById('debugActiveSession').textContent = this.currentRelaySession || 'Nenhuma';
    
    // Contar clientes conectados no servidor (estimativa)
    if (this.relayWs && this.relayWs.readyState === 1) {
      // Enviar mensagem para pedir estatísticas
      this.relayWs.send(JSON.stringify({
        type: 'get_stats'
      }));
    }
  }

  testRelayConnection() {
    if (!this.relayWs || this.relayWs.readyState !== 1) {
      document.getElementById('debugLastMessage').textContent = '❌ WebSocket não conectado';
      this.showNotification('WebSocket não está conectado', 'error');
      return;
    }

    // Enviar mensagem de teste
    const testMessage = {
      type: 'test_ping',
      timestamp: Date.now(),
      from: this.currentAnydeskId || 'unknown'
    };

    this.relayWs.send(JSON.stringify(testMessage));
    document.getElementById('debugLastMessage').textContent = `📤 Teste enviado: ${new Date().toLocaleTimeString()}`;
    this.showNotification('Mensagem de teste enviada', 'info');
  }

  // Função para lidar com fim de sessão
  handleSessionEnded(sessionId) {
    console.log('Sessão encerrada:', sessionId);
    
    // Parar captura de tela se ativa
    if (this.relayScreenInterval) {
      clearInterval(this.relayScreenInterval);
      this.relayScreenInterval = null;
    }
    
    // Limpar sessão atual
    this.currentRelaySession = null;
    
    // Resetar interface
    document.getElementById('sessionControls').style.display = 'none';
    document.getElementById('remoteScreen').style.display = 'none';
    document.getElementById('connectionRequests').style.display = 'none';
    document.getElementById('connectionStatus').style.display = 'none';
    
    this.showNotification('Sessão encerrada', 'info');
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.remoteControlClient = new RemoteControlClient();
});