const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Geração de código
  generateAccessCode: () => ipcRenderer.invoke('generate-access-code'),
  
  // Informações do servidor
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  
  // Estatísticas de autenticação
  getAuthStats: () => ipcRenderer.invoke('get-auth-stats'),
  
  // Gerenciamento de códigos
  revokeCode: (code) => ipcRenderer.invoke('revoke-code', code),
  getActiveCodes: () => ipcRenderer.invoke('get-active-codes'),
  
  // Listeners para eventos do menu
  onGenerateCode: (callback) => {
    ipcRenderer.on('generate-code', callback);
  },
  
  onStartHost: (callback) => {
    ipcRenderer.on('start-host', callback);
  },
  
  onConnectViewer: (callback) => {
    ipcRenderer.on('connect-viewer', callback);
  },
  
  onDisconnect: (callback) => {
    ipcRenderer.on('disconnect', callback);
  },
  
  onShowAbout: (callback) => {
    ipcRenderer.on('show-about', callback);
  },
  
  // Remover listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Captura de tela para relay (nome correto)
  captureScreenRelay: () => ipcRenderer.invoke('capture-screen-relay'),
  
  // Enviar input para controle remoto (nome correto)
  sendInputRelay: (inputData) => ipcRenderer.invoke('send-input-relay', inputData)
});