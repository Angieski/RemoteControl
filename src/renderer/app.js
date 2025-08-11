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
    
    // Aguardar relay-client.js carregar e conectar automaticamente
    setTimeout(() => {
      if (window.relayClient && !window.relayClient.isConnected) {
        console.log('Iniciando conexão relay via relay-client.js...');
        window.relayClient.connectToRelay();
      }
    }, 1000);
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

    // REMOVIDO: Event listeners movidos para relay-client.js

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

    // REMOVIDO: Event listeners duplicados movidos para relay-client.js

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

    // Fullscreen controls
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      this.maximizeRemoteScreen();
    });

    document.getElementById('minimizeBtn').addEventListener('click', () => {
      this.minimizeRemoteScreen();
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
    
    // Fechar todas as telas remotas
    this.closeAllRemoteScreens();
    
    // Reset UI
    document.getElementById('connectBtn').style.display = 'inline-block';
    document.getElementById('disconnectBtn').style.display = 'none';
    document.getElementById('connectionStatus').style.display = 'none';
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
    }, 150); // ~6.5 FPS - Melhorar performance
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

    // Focus canvas para receber eventos de teclado
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.focus();
    
    console.log('🎮 Configurando controles do canvas...');

    // Mouse move
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isViewer && !this.currentRelaySession) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      
      this.sendInputEvent({
        type: 'mouseMove',
        x: x,
        y: y
      });
    });

    // Mouse click (left)
    this.canvas.addEventListener('click', (e) => {
      if (!this.isViewer && !this.currentRelaySession) return;
      e.preventDefault();
      
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      
      this.sendInputEvent({
        type: 'mouseClick',
        x: x,
        y: y,
        button: 'left'
      });
      
      console.log(`🖱️ Click esquerdo em (${x}, ${y})`);
    });

    // Mouse right click
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.isViewer && !this.currentRelaySession) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      
      this.sendInputEvent({
        type: 'mouseClick',
        x: x,
        y: y,
        button: 'right'
      });
      
      console.log(`🖱️ Click direito em (${x}, ${y})`);
    });

    // Mouse wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.isViewer && !this.currentRelaySession) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      
      this.sendInputEvent({
        type: 'mouseWheel',
        x: x,
        y: y,
        deltaX: e.deltaX,
        deltaY: e.deltaY
      });
    });

    // Keyboard events
    this.canvas.addEventListener('keydown', (e) => {
      if (!this.isViewer && !this.currentRelaySession) return;
      e.preventDefault();
      
      this.sendInputEvent({
        type: 'keyDown',
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        modifiers: this.getModifiers(e)
      });
      
      console.log(`⌨️ Tecla pressionada: ${e.key}`);
    });

    this.canvas.addEventListener('keyup', (e) => {
      if (!this.isViewer && !this.currentRelaySession) return;
      e.preventDefault();
      
      this.sendInputEvent({
        type: 'keyUp',
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        modifiers: this.getModifiers(e)
      });
    });

    // Focus no canvas quando clicado
    this.canvas.addEventListener('mousedown', () => {
      this.canvas.focus();
    });
    
    console.log('✅ Controles do canvas configurados');
  }

  sendInputEvent(event) {
    // Tentar enviar via relay client primeiro (conexão via internet)
    if (window.relayClient && window.relayClient.currentSession) {
      window.relayClient.sendToRelay({
        type: 'relay_data',
        sessionId: window.relayClient.currentSession.sessionId,
        dataType: 'input',
        data: event
      });
      console.log('📡 Input enviado via relay:', event.type);
      return;
    }
    
    // Fallback para conexão WebSocket local
    const activeWs = this.remoteWs || this.ws;
    if (activeWs && activeWs.readyState === WebSocket.OPEN && this.isViewer) {
      activeWs.send(JSON.stringify({
        type: 'input_event',
        event: event
      }));
      console.log('🌐 Input enviado via WebSocket local:', event.type);
      return;
    }
    
    console.warn('❌ Nenhuma conexão disponível para enviar input');
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
    const localServerStatusHost = document.getElementById('localServerStatusHost');
    
    if (isOnline) {
      if (indicator) indicator.classList.add('online');
      if (info) info.textContent = 'Servidor Online';
      
      // Atualizar status na aba viewer
      if (localStatus) {
        localStatus.textContent = '🟢 Online';
        localStatus.style.color = '#38a169';
      }
      
      // Atualizar status na aba host
      if (localServerStatusHost) {
        localServerStatusHost.textContent = '🟢 Online';
        localServerStatusHost.style.color = '#38a169';
      }
    } else {
      if (indicator) indicator.classList.remove('online');
      if (info) info.textContent = 'Servidor Offline';
      
      // Atualizar status na aba viewer
      if (localStatus) {
        localStatus.textContent = '❌ Offline';
        localStatus.style.color = '#e53e3e';
      }
      
      // Atualizar status na aba host
      if (localServerStatusHost) {
        localServerStatusHost.textContent = '❌ Offline';
        localServerStatusHost.style.color = '#e53e3e';
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

  // === INTEGRAÇÃO COM RELAY CLIENT ===
  
  connectViaRelayId() {
    const remoteIdInput = document.getElementById('remoteId');
    const remoteId = remoteIdInput.value.replace(/\s/g, ''); // Remover espaços
    
    if (!remoteId || remoteId.length !== 9) {
      alert('Por favor, digite um ID válido de 9 dígitos');
      remoteIdInput.focus();
      return;
    }
    
    // Usar o relayClient global se disponível
    if (window.relayClient) {
      // Simular input no campo do relay client
      const relayRemoteInput = document.getElementById('remoteId');
      if (relayRemoteInput) {
        relayRemoteInput.value = remoteId;
      }
      
      // Chamar método do relay client
      window.relayClient.connectToRemoteId();
      
      // Mostrar status
      const connectionStatus = document.getElementById('connectionStatus');
      if (connectionStatus) {
        connectionStatus.style.display = 'block';
        document.getElementById('targetIdDisplay').textContent = remoteId;
      }
      
      console.log('Tentativa de conexão via relay para ID:', remoteId);
    } else {
      alert('Relay client não inicializado. Aguarde e tente novamente.');
      console.error('Relay client não disponível');
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

  // REMOVIDO: registerWithRelayServer() - agora só no relay-client.js

  // REMOVIDO: connectToRelayServer() - agora só no relay-client.js

  // REMOVIDO: handleRelayMessage() - agora só no relay-client.js

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
    
    // Sistema agora usa screen_request/response em vez de captura automática
    console.log('Conexão estabelecida - aguardando screen_requests');
    
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
    }, 250); // 4 FPS - Performance otimizada
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

  // Enviar captura de tela via relay
  async sendScreenToRelay(sessionId) {
    try {
      if (window.electronAPI && window.electronAPI.captureScreenRelay) {
        // Usar API específica do Electron para relay
        const screenshot = await window.electronAPI.captureScreenRelay();
        
        if (screenshot && this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
          this.relayWs.send(JSON.stringify({
            type: 'relay_data',
            sessionId: sessionId,
            dataType: 'screen',
            data: screenshot
          }));
        }
      } else {
        console.error('electronAPI.captureScreenRelay não disponível');
      }
    } catch (error) {
      console.error('Erro ao enviar tela via relay:', error);
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
        
      case 'screen_request':
        // Host responde com captura de tela
        this.sendScreenToRelay(message.sessionId);
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

  // REMOVIDO: updateRelayStatus() - agora só no relay-client.js

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

  // REMOVIDO: showConnectionRequest() - agora só no relay-client.js

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
    // Usar informações do relay-client se disponível
    if (window.relayClient) {
      const relayStatus = window.relayClient.isConnected ? '🟢 Conectado' : '❌ Desconectado';
      document.getElementById('debugRelayStatus').textContent = relayStatus;
      document.getElementById('debugMyId').textContent = window.relayClient.clientId || 'Não gerado';
      document.getElementById('debugActiveSession').textContent = window.relayClient.currentSession?.sessionId || 'Nenhuma';
    } else {
      document.getElementById('debugRelayStatus').textContent = '❌ Relay client não carregado';
      document.getElementById('debugMyId').textContent = 'N/A';
      document.getElementById('debugActiveSession').textContent = 'N/A';
    }
    
    // Contar clientes conectados no servidor (estimativa)
    if (this.relayWs && this.relayWs.readyState === 1) {
      // Enviar mensagem para pedir estatísticas
      this.relayWs.send(JSON.stringify({
        type: 'get_stats'
      }));
    }
  }

  testRelayConnection() {
    // Usar relay client global em vez de WebSocket direto
    if (window.relayClient && window.relayClient.isConnected) {
      document.getElementById('debugLastMessage').textContent = `✅ Relay conectado: ${new Date().toLocaleTimeString()}`;
      this.showNotification('Sistema relay está funcionando!', 'success');
    } else {
      document.getElementById('debugLastMessage').textContent = '❌ Sistema relay desconectado';
      this.showNotification('Sistema relay não está conectado', 'error');
    }
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
    
    // Fechar TODAS as telas remotas de forma robusta
    this.closeAllRemoteScreens();
    
    // Resetar interface
    document.getElementById('sessionControls').style.display = 'none';
    document.getElementById('connectionRequests').style.display = 'none';
    document.getElementById('connectionStatus').style.display = 'none';
    
    this.showNotification('Sessão encerrada', 'info');
  }

  // Função para fechar TODAS as telas remotas (duplicada para compatibilidade)
  closeAllRemoteScreens() {
    console.log('🔄 [app.js] Fechando todas as telas remotas...');
    
    // 1. Fechar tela remota do HTML principal
    const remoteScreen = document.getElementById('remoteScreen');
    if (remoteScreen) {
      remoteScreen.style.display = 'none';
      console.log('✅ Tela remota HTML fechada');
    }
    
    // 2. Limpar canvas
    const screenCanvas = document.getElementById('screenCanvas');
    if (screenCanvas) {
      const ctx = screenCanvas.getContext('2d');
      ctx.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
      screenCanvas.style.display = 'none';
      console.log('✅ Canvas limpo e oculto');
    }
    
    // 3. Usar relay client se disponível
    if (window.relayClient && typeof window.relayClient.closeAllRemoteScreens === 'function') {
      window.relayClient.closeAllRemoteScreens();
    }
    
    console.log('🎯 [app.js] Limpeza de tela remota concluída');
  }

  // Função para maximizar a tela remota
  maximizeRemoteScreen() {
    const remoteScreen = document.getElementById('remoteScreen');
    const canvas = document.getElementById('screenCanvas');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    
    if (!remoteScreen || !canvas) return;
    
    console.log('🔍 Maximizando tela remota...');
    
    // Aplicar estilo de tela cheia
    remoteScreen.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 10000 !important;
      background: #000 !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
    `;
    
    // Maximizar canvas
    canvas.style.cssText = `
      width: 100vw !important;
      height: calc(100vh - 80px) !important;
      border: none !important;
      border-radius: 0 !important;
      object-fit: contain !important;
      background: #000 !important;
    `;
    
    // Trocar botões
    if (fullscreenBtn) fullscreenBtn.style.display = 'none';
    if (minimizeBtn) minimizeBtn.style.display = 'inline-block';
    
    // Focus no canvas para controles
    canvas.focus();
    
    // Bloquear scroll da página
    document.body.style.overflow = 'hidden';
    
    console.log('✅ Tela maximizada');
  }

  // Função para minimizar a tela remota
  minimizeRemoteScreen() {
    const remoteScreen = document.getElementById('remoteScreen');
    const canvas = document.getElementById('screenCanvas');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    
    if (!remoteScreen || !canvas) return;
    
    console.log('🗗 Minimizando tela remota...');
    
    // Restaurar estilo normal
    remoteScreen.style.cssText = `
      display: block;
      margin-top: 1rem;
      position: relative;
      width: auto;
      height: auto;
      z-index: auto;
      background: auto;
    `;
    
    // Restaurar canvas
    canvas.style.cssText = `
      border: 2px solid #333;
      border-top: none;
      border-radius: 0 0 8px 8px;
      max-width: 100%;
      height: auto;
      width: auto;
      object-fit: contain;
    `;
    
    // Trocar botões
    if (fullscreenBtn) fullscreenBtn.style.display = 'inline-block';
    if (minimizeBtn) minimizeBtn.style.display = 'none';
    
    // Restaurar scroll da página
    document.body.style.overflow = 'auto';
    
    console.log('✅ Tela minimizada');
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.remoteControlClient = new RemoteControlClient();
});