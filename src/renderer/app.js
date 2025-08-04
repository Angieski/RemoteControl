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
    
    this.initializeUI();
    this.connectToServer();
    this.startStatusUpdates();
    this.detectLocalIP();
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RemoteControlClient();
});