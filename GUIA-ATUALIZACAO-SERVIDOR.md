# 🚀 GUIA DE ATUALIZAÇÃO DO SERVIDOR AWS RELAY

**Objetivo:** Atualizar o servidor AWS com a versão correta do código relay que funciona com a aplicação cliente.

---

## 📋 PRÉ-REQUISITOS

✅ **Chave SSH configurada** para conectar ao servidor AWS  
✅ **Servidor AWS rodando** (54.232.138.198:8080)  
✅ **Arquivo atualizado** (`relay-server/server.js`) pronto  
✅ **Terminal/PowerShell** aberto na pasta do projeto  

---

## 🔧 OPÇÃO 1: COMANDOS MANUAIS (RECOMENDADO)

### **Passo 1: Conectar ao servidor**
```bash
ssh ubuntu@54.232.138.198
```

### **Passo 2: Fazer backup do código atual**
```bash
cp /home/ubuntu/remote-control-relay/server.js /home/ubuntu/remote-control-relay/server.js.backup-$(date +%Y%m%d_%H%M%S)
ls -la /home/ubuntu/remote-control-relay/server.js*
```

### **Passo 3: Parar o serviço atual**
```bash
sudo systemctl stop remote-relay
sudo systemctl status remote-relay
```

### **Passo 4: Sair do SSH e fazer upload** 
```bash
exit
```

**No seu computador local:**
```bash
cd C:\dev\RemoteControl
scp .\relay-server\server.js ubuntu@54.232.138.198:/home/ubuntu/remote-control-relay/server.js
```

### **Passo 5: Reconectar e iniciar o serviço**
```bash
ssh ubuntu@54.232.138.198
sudo systemctl start remote-relay
sudo systemctl status remote-relay
```

### **Passo 6: Verificar logs**
```bash
sudo journalctl -u remote-relay -f
```
*Pressione Ctrl+C para sair dos logs*

---

## 🛠️ OPÇÃO 2: SCRIPT AUTOMATIZADO

### **Para Linux/Mac:**
```bash
chmod +x update-aws-server.sh
./update-aws-server.sh
```

### **Para Windows PowerShell:**
```powershell
.\update-aws-server.ps1
```
*O script PowerShell mostra os comandos para executar manualmente*

---

## ✅ VALIDAÇÃO DA ATUALIZAÇÃO

### **1. Teste Health Check**
```bash
curl http://54.232.138.198:8080/health
```
**Resposta esperada:**
```json
{"status":"ok","timestamp":"...","clients":0,"sessions":0,"server":"AWS EC2"}
```

### **2. Teste WebSocket completo**
```bash
cd C:\dev\RemoteControl
node test-aws-updated.js
```

**Resultado esperado:**
```
✅ Testes aprovados: 5/5
📈 Taxa de sucesso: 100.0%
🎉 SERVIDOR AWS ESTÁ FUNCIONANDO PERFEITAMENTE!
```

### **3. Teste com aplicação real**
1. Abrir aplicação Remote Control
2. Verificar se conecta ao relay (🟢 Conectado)
3. Verificar se gera ID automaticamente
4. Testar botão "🧪 Teste Conexão" → deve retornar sucesso

---

## 🚨 SOLUÇÃO DE PROBLEMAS

### **Se o serviço não iniciar:**
```bash
# Ver logs detalhados
sudo journalctl -u remote-relay -n 50

# Verificar arquivo de configuração
sudo systemctl cat remote-relay

# Testar manualmente
cd /home/ubuntu/remote-control-relay
node server.js
```

### **Se ainda não funcionar:**
```bash
# Restaurar backup
cp /home/ubuntu/remote-control-relay/server.js.backup-* /home/ubuntu/remote-control-relay/server.js
sudo systemctl start remote-relay
```

### **Verificar dependências:**
```bash
cd /home/ubuntu/remote-control-relay
npm list
# Se precisar reinstalar:
npm install
```

---

## 📊 CHECKLIST DE VERIFICAÇÃO

- [ ] Backup criado com sucesso
- [ ] Serviço parado sem erros  
- [ ] Upload do arquivo concluído
- [ ] Serviço reiniciado com sucesso
- [ ] Health check retorna "ok"
- [ ] WebSocket conecta e responde
- [ ] Teste completo passa (5/5)
- [ ] Aplicação cliente conecta com sucesso

---

## ⚡ COMANDOS RÁPIDOS DE EMERGÊNCIA

**Verificar se servidor está rodando:**
```bash
curl -I http://54.232.138.198:8080/health
```

**Restart rápido do serviço:**
```bash
ssh ubuntu@54.232.138.198 "sudo systemctl restart remote-relay"
```

**Ver logs em tempo real:**
```bash
ssh ubuntu@54.232.138.198 "sudo journalctl -u remote-relay -f"
```

---

## 🎯 RESULTADO ESPERADO

Após a atualização, o servidor deve:

✅ **Responder ao Health Check**  
✅ **Aceitar conexões WebSocket**  
✅ **Enviar `server_hello` automaticamente**  
✅ **Processar `register_client` corretamente**  
✅ **Gerar IDs únicos de 9 dígitos**  
✅ **Suportar fluxo completo de conexão**  
✅ **Fazer relay de dados entre clientes**  

**Status Final Esperado:** 🟢 **SERVIDOR 100% FUNCIONAL**