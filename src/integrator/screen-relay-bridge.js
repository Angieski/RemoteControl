class ScreenRelayBridge {
  constructor(relayClient, screenCapture, inputController) {
    this.relayClient = relayClient;
    this.screenCapture = screenCapture;
    this.inputController = inputController;
    this.isCapturing = false;
    this.captureInterval = null;
    
    this.setupIntegration();
  }

  setupIntegration() {
    // Integrar captura de tela com relay
    this.relayClient.originalStartHostSession = this.relayClient.startHostSession;
    this.relayClient.startHostSession = (sessionId) => {
      this.relayClient.originalStartHostSession(sessionId);
      this.startScreenCaptureRelay(sessionId);
    };

    // Integrar controle de input com relay
    this.relayClient.originalProcessRemoteInput = this.relayClient.processRemoteInput || (() => {});
    this.relayClient.processRemoteInput = (inputData) => {
      this.processInputFromRelay(inputData);
    };

    // Integrar exibição de tela remota
    this.relayClient.originalDisplayRemoteScreen = this.relayClient.displayRemoteScreen || (() => {});
    this.relayClient.displayRemoteScreen = (screenData) => {
      this.displayScreenFromRelay(screenData);
    };
  }

  async startScreenCaptureRelay(sessionId) {
    if (this.isCapturing) return;
    
    this.isCapturing = true;
    console.log('Iniciando captura de tela para relay...');
    
    try {
      // Usar ScreenCapture existente via Electron API
      this.captureInterval = setInterval(async () => {
        try {
          if (!this.isCapturing) return;
          
          // Capturar tela usando API existente
          const screenshot = await this.captureScreenForRelay();
          
          if (screenshot) {
            // Enviar para relay
            this.relayClient.sendToRelay({
              type: 'relay_data',
              sessionId: sessionId,
              dataType: 'screen',
              data: screenshot
            });
          }
        } catch (error) {
          console.error('Erro na captura para relay:', error);
        }
      }, 150); // ~6.5 FPS - Performance otimizada
      
    } catch (error) {
      console.error('Erro ao iniciar captura para relay:', error);
      this.isCapturing = false;
    }
  }

  async captureScreenForRelay() {
    try {
      // Integrar com o sistema existente
      if (window.electronAPI) {
        // Simular captura - você precisa expor a captura via IPC
        return await this.captureViaElectronAPI();
      } else {
        // Fallback para browser API
        return await this.captureViaWebAPI();
      }
    } catch (error) {
      console.error('Erro na captura:', error);
      return null;
    }
  }

  async captureViaElectronAPI() {
    try {
      // Usar a API real do Electron
      if (window.electronAPI && window.electronAPI.captureScreenRelay) {
        const screenshot = await window.electronAPI.captureScreenRelay();
        return screenshot;
      } else {
        console.error('electronAPI.captureScreenRelay não disponível');
        return null;
      }
    } catch (error) {
      console.error('Erro na captura via Electron API:', error);
      return null;
    }
  }

  async captureViaWebAPI() {
    try {
      // Usar Screen Capture API do browser
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          
          stream.getTracks().forEach(track => track.stop());
          
          resolve({
            type: 'image/jpeg',
            data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1],
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

  stopScreenCapture() {
    this.isCapturing = false;
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  processInputFromRelay(inputData) {
    try {
      // Integrar com InputController via Electron IPC
      if (window.electronAPI && window.electronAPI.sendInputRelay) {
        window.electronAPI.sendInputRelay(inputData)
          .then(result => {
            if (!result) {
              console.warn('Falha ao processar input:', inputData);
            }
          })
          .catch(error => {
            console.error('Erro ao processar input via IPC:', error);
          });
      } else {
        console.error('electronAPI.sendInputRelay não disponível');
        // Fallback para eventos DOM (limitado)
        this.processInputViaDom(inputData);
      }
    } catch (error) {
      console.error('Erro ao processar input do relay:', error);
    }
  }

  processInputViaDom(inputData) {
    // Simular eventos no DOM (limitado, mas funcional)
    switch (inputData.type) {
      case 'mouseMove':
        // Mover cursor virtual ou indicador
        this.updateVirtualCursor(inputData.x, inputData.y);
        break;
        
      case 'mouseClick':
        console.log(`Click simulado em ${inputData.x}, ${inputData.y}`);
        break;
        
      case 'keyPress':
        console.log(`Tecla simulada: ${inputData.key}`);
        break;
    }
  }

  updateVirtualCursor(x, y) {
    // Criar ou atualizar cursor virtual
    let cursor = document.getElementById('virtual-cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'virtual-cursor';
      cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: red;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transition: all 0.1s;
      `;
      document.body.appendChild(cursor);
    }
    
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  }

  displayScreenFromRelay(screenData) {
    try {
      // Exibir tela remota no canvas existente
      const canvas = document.getElementById('screenCanvas');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      if (screenData.type === 'image/jpeg' && screenData.data) {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // Mostrar canvas se não estiver visível
          const remoteScreen = document.getElementById('remoteScreen');
          if (remoteScreen) {
            remoteScreen.style.display = 'block';
          }
        };
        
        img.src = `data:${screenData.type};base64,${screenData.data}`;
      }
    } catch (error) {
      console.error('Erro ao exibir tela do relay:', error);
    }
  }
}

// Auto-inicializar quando relay client estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Aguardar relay client estar disponível
  setTimeout(() => {
    if (window.relayClient) {
      window.screenRelayBridge = new ScreenRelayBridge(
        window.relayClient,
        null, // ScreenCapture será integrado via Electron
        null  // InputController será integrado via Electron
      );
      console.log('Screen Relay Bridge inicializado');
    }
  }, 1000);
});