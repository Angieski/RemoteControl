const crypto = require('crypto');

class Authentication {
  constructor() {
    this.activeCodes = new Map();
    this.codeExpiration = 5 * 60 * 1000; // 5 minutos em milissegundos
    
    // Limpar códigos expirados a cada minuto
    setInterval(() => {
      this.cleanExpiredCodes();
    }, 60000);
  }

  generateAccessCode() {
    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + this.codeExpiration;
    
    this.activeCodes.set(code, {
      createdAt: Date.now(),
      expiresAt: expiresAt,
      used: false
    });

    console.log(`Código gerado: ${code}, expira em: ${new Date(expiresAt).toLocaleString()}`);
    
    return code;
  }

  validateAccessCode(code) {
    const codeData = this.activeCodes.get(code);
    
    if (!codeData) {
      console.log(`Código inválido: ${code}`);
      return false;
    }

    if (Date.now() > codeData.expiresAt) {
      console.log(`Código expirado: ${code}`);
      this.activeCodes.delete(code);
      return false;
    }

    if (codeData.used) {
      console.log(`Código já utilizado: ${code}`);
      return false;
    }

    // Marcar código como usado (opcional - remova se quiser permitir múltiplas conexões)
    // codeData.used = true;
    
    console.log(`Código válido: ${code}`);
    return true;
  }

  revokeAccessCode(code) {
    if (this.activeCodes.has(code)) {
      this.activeCodes.delete(code);
      console.log(`Código revogado: ${code}`);
      return true;
    }
    return false;
  }

  cleanExpiredCodes() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [code, data] of this.activeCodes.entries()) {
      if (now > data.expiresAt) {
        this.activeCodes.delete(code);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`${cleanedCount} códigos expirados removidos`);
    }
  }

  getActiveCodes() {
    const now = Date.now();
    const active = [];
    
    for (const [code, data] of this.activeCodes.entries()) {
      if (now <= data.expiresAt) {
        active.push({
          code: code,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          timeRemaining: data.expiresAt - now,
          used: data.used
        });
      }
    }
    
    return active;
  }

  // Método para gerar hash de sessão (para uso futuro com autenticação mais robusta)
  generateSessionHash(data) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  // Método para validar hash de sessão
  validateSessionHash(data, hash) {
    const computedHash = this.generateSessionHash(data);
    return computedHash === hash;
  }

  // Configurar tempo de expiração dos códigos
  setCodeExpiration(minutes) {
    this.codeExpiration = minutes * 60 * 1000;
    console.log(`Tempo de expiração dos códigos definido para: ${minutes} minutos`);
  }

  // Estatísticas
  getStats() {
    const now = Date.now();
    const total = this.activeCodes.size;
    let expired = 0;
    let used = 0;
    
    for (const [code, data] of this.activeCodes.entries()) {
      if (now > data.expiresAt) expired++;
      if (data.used) used++;
    }
    
    return {
      total: total,
      active: total - expired,
      expired: expired,
      used: used
    };
  }
}

module.exports = Authentication;