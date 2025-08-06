const { app, BrowserWindow, ipcMain, Menu, nativeImage } = require('electron');
const path = require('path');
const RemoteControlServer = require('./server/index');

class RemoteControlApp {
  constructor() {
    this.mainWindow = null;
    this.server = null;
    
    this.initializeApp();
  }

  getIconPath() {
    const fs = require('fs');
    
    // Tentar diferentes caminhos possíveis para o ícone
    const possiblePaths = [
      path.join(__dirname, '..', 'build', 'icon.png'),
      path.join(__dirname, 'build', 'icon.png'),
      path.join(process.resourcesPath, 'build', 'icon.png'),
      path.join(__dirname, '..', '..', 'build', 'icon.png')
    ];
    
    for (const iconPath of possiblePaths) {
      try {
        if (fs.existsSync(iconPath)) {
          console.log(`Ícone encontrado em: ${iconPath}`);
          return iconPath;
        }
      } catch (error) {
        // Ignorar erros de acesso
      }
    }
    
    console.log('Ícone não encontrado, usando padrão do sistema');
    return undefined; // Usa ícone padrão do Electron
  }

  initializeApp() {
    // Aguardar o Electron estar pronto
    app.whenReady().then(() => {
      this.createMainWindow();
      
      // Verificar se deve iniciar servidor (apenas se não especificado modo viewer-only)
      const isViewerOnly = process.argv.includes('--viewer-only');
      if (!isViewerOnly) {
        this.startServer();
      } else {
        console.log('Iniciado em modo viewer-only (sem servidor)');
      }
      
      this.setupIPC();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.stopServer();
        app.quit();
      }
    });

    app.on('before-quit', () => {
      this.stopServer();
    });
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      icon: this.getIconPath(),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Fechar completamente quando a janela for fechada
    this.mainWindow.on('close', (event) => {
      // Parar servidor antes de fechar
      this.stopServer();
      // Permitir fechamento normal da aplicação
      app.quit();
    });

    // Menu da aplicação
    this.createMenu();

    // DevTools habilitado para debug
    this.mainWindow.webContents.openDevTools();
  }


  createMenu() {
    const template = [
      {
        label: 'Arquivo',
        submenu: [
          {
            label: 'Gerar Código',
            accelerator: 'CmdOrCtrl+G',
            click: () => {
              this.mainWindow.webContents.send('generate-code');
            }
          },
          { type: 'separator' },
          {
            label: 'DevTools / Console',
            accelerator: 'F12',
            click: () => {
              this.mainWindow.webContents.toggleDevTools();
            }
          },
          { type: 'separator' },
          {
            label: 'Sair',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              this.stopServer();
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Conexão',
        submenu: [
          {
            label: 'Iniciar como Host',
            click: () => {
              this.mainWindow.webContents.send('start-host');
            }
          },
          {
            label: 'Conectar como Viewer',
            click: () => {
              this.mainWindow.webContents.send('connect-viewer');
            }
          },
          { type: 'separator' },
          {
            label: 'Desconectar',
            click: () => {
              this.mainWindow.webContents.send('disconnect');
            }
          }
        ]
      },
      {
        label: 'Ajuda',
        submenu: [
          {
            label: 'Sobre',
            click: () => {
              this.mainWindow.webContents.send('show-about');
            }
          }
        ]
      }
    ];

    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  startServer() {
    try {
      this.server = new RemoteControlServer(3000);
      this.server.start();
      console.log('Servidor iniciado com sucesso');
    } catch (error) {
      console.error('Erro ao iniciar servidor:', error);
    }
  }

  stopServer() {
    if (this.server && this.server.server) {
      this.server.server.close();
      console.log('Servidor parado');
    }
  }

  setupIPC() {
    // Gerar código de acesso
    ipcMain.handle('generate-access-code', async () => {
      if (!this.server) return null;
      
      try {
        const code = this.server.auth.generateAccessCode();
        return {
          code: code,
          expires: Date.now() + 300000 // 5 minutos
        };
      } catch (error) {
        console.error('Erro ao gerar código:', error);
        return null;
      }
    });

    // Obter informações do servidor
    ipcMain.handle('get-server-info', async () => {
      return {
        port: 3000,
        clients: this.server ? this.server.clients.size : 0,
        sessions: this.server ? this.server.sessions.size : 0
      };
    });

    // Obter estatísticas de autenticação
    ipcMain.handle('get-auth-stats', async () => {
      if (!this.server) return null;
      return this.server.auth.getStats();
    });

    // Revogar código
    ipcMain.handle('revoke-code', async (event, code) => {
      if (!this.server) return false;
      return this.server.auth.revokeAccessCode(code);
    });

    // Obter códigos ativos
    ipcMain.handle('get-active-codes', async () => {
      if (!this.server) return [];
      return this.server.auth.getActiveCodes();
    });

    // Captura de tela para relay
    ipcMain.handle('capture-screen-relay', async () => {
      try {
        const { desktopCapturer } = require('electron');
        
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1280, height: 720 } // Resolução reduzida
        });
        
        if (sources.length > 0) {
          const screenshot = sources[0].thumbnail.toJPEG(60); // Qualidade 60%
          return {
            type: 'image/jpeg',
            data: screenshot.toString('base64'),
            width: 1280,
            height: 720,
            timestamp: Date.now()
          };
        }
        
        return null;
      } catch (error) {
        console.error('Erro na captura de tela:', error);
        return null;
      }
    });

    // Processar input do relay (controle remoto)
    ipcMain.handle('send-input-relay', async (event, inputData) => {
      try {
        const { screen } = require('electron');
        const robot = require('@hurdlegroup/robotjs');
        
        const { type, x, y, button, key, code } = inputData;
        
        switch (type) {
          case 'mouseMove':
            if (x !== undefined && y !== undefined) {
              robot.moveMouse(x, y);
            }
            break;
            
          case 'mouseClick':
            if (x !== undefined && y !== undefined) {
              robot.moveMouse(x, y);
              const mouseButton = button === 2 ? 'right' : 'left';
              robot.mouseClick(mouseButton);
            }
            break;
            
          case 'keyDown':
            if (key) {
              try {
                robot.keyTap(key.toLowerCase());
              } catch (e) {
                console.log('Tecla não suportada:', key);
              }
            }
            break;
            
          case 'keyUp':
            // robotjs não diferencia keyDown/keyUp para teclas simples
            break;
            
          default:
            console.log('Tipo de input desconhecido:', type);
        }
        
        return true;
      } catch (error) {
        console.error('Erro ao processar input:', error);
        return false;
      }
    });
  }
}

// Instanciar aplicação
new RemoteControlApp();