# 🎮 GUIA PRÁTICO: Como Testar o Remote Control

## 📋 Pré-requisitos
- Servidor local rodando (`npm run server` ou `npm run dev`)
- Duas janelas: uma como HOST e outra como VIEWER

---

## 🚀 MÉTODO 1: Usando a Aplicação Electron (Recomendado)

### Passo 1: Iniciar a Aplicação
```bash
npm run dev
```
Isso iniciará:
- ✅ Servidor backend na porta 3000
- ✅ Interface Electron

### Passo 2: Modo HOST (Compartilhar Desktop)
1. Na janela Electron que abrir:
   - Clique em **"Gerar Código de Acesso"**
   - Anote o código de 6 dígitos que aparecer
   - Exemplo: `952680`

### Passo 3: Modo VIEWER (Acessar Desktop)
1. Abra um navegador web
2. Vá para: `http://localhost:3000`
3. Digite o código de 6 dígitos
4. Clique em **"Conectar"**

**OU** execute uma segunda instância:
```bash
npm start
```

---

## 🚀 MÉTODO 2: Usando Navegador Web

### Passo 1: Iniciar Servidor
```bash
npm run server
```

### Passo 2: HOST via API
```bash
# Gerar código
curl -X POST http://localhost:3000/generate-code

# Retornará algo como: {"code":"123456","expires":1699999999999}
```

### Passo 3: VIEWER via Navegador
1. Abra: `http://localhost:3000`
2. Digite o código gerado
3. Conecte e teste!

---

## 🖥️ MÉTODO 3: Teste com Scripts (Demonstração)

### Executar Demo Automática
```bash
node demo-conexao-local.js
```

**O que acontece:**
- ✅ Gera código automaticamente
- ✅ Conecta como HOST e VIEWER simultaneamente
- ✅ Captura tela (salva como `screenshot-demo.jpg`)
- ✅ Testa comandos de mouse e teclado
- ✅ Mostra logs detalhados

### Executar Teste com Logs Coloridos
```bash
node test-with-logs.js
```

---

## 📊 Como Observar os Logs do Servidor

### Logs Detalhados do Servidor
```bash
# Terminal 1: Servidor com logs
npm run server

# Você verá:
# ✅ Resolução da tela: 2560x1440
# ✅ Servidor rodando na porta 3000
# ✅ Cliente conectado: uuid-do-cliente
# ✅ Código gerado: 123456, expira em: data/hora
# ✅ Host registrado: uuid, Sessão: uuid-sessão
# ✅ Viewer conectado: uuid à sessão: uuid
```

### Logs de Rede
```bash
# Ver conexões ativas
netstat -ano | findstr :3000

# Monitorar tráfego
# Use Developer Tools (F12) no navegador para ver WebSocket
```

---

## 🎯 Cenários de Teste

### ✅ Teste Básico
1. **Host**: Gerar código → Aguardar conexão
2. **Viewer**: Conectar com código → Ver tela
3. **Ação**: Mover mouse → Verificar movimento na tela host

### ✅ Teste de Performance
```bash
# Monitor de recursos durante teste
taskmgr
```

### ✅ Teste de Qualidade
- Ajustar qualidade de 30% a 100%
- Verificar tamanho dos frames
- Testar diferentes resoluções

---

## 🔍 Informações de Debug

### URLs Importantes
- **Servidor**: `http://localhost:3000`
- **Health**: `http://localhost:3000/health`
- **WebSocket**: `ws://localhost:3000`

### Códigos de Status
- `200`: Conexão OK
- `404`: Endpoint não encontrado
- `500`: Erro interno

### Logs do Servidor
```
✅ Código válido: 123456
✅ Host registrado: uuid, Sessão: uuid-sessão  
✅ Viewer conectado: uuid à sessão: uuid
🖼️ Captura enviada: 198.4KB
🎮 Comando recebido: mouseMove (x, y)
```

---

## 🚨 Troubleshooting

### Problema: Porta ocupada
```bash
netstat -ano | findstr :3000
taskkill /PID xxxx /F
```

### Problema: Código expirado
- Códigos expiram em 5 minutos
- Gerar novo código

### Problema: Tela não aparece
- Verificar permissões de captura de tela
- Testar `node test-screen-capture.js`

---

## 📈 Métricas Esperadas

### Performance Normal
- **Frame size**: ~196KB (qualidade 80)
- **Latência**: <100ms (rede local)
- **FPS**: ~10 frames/segundo
- **CPU**: <10% durante captura

### Indicadores de Sucesso
- ✅ Cliente conectado nos logs
- ✅ Código validado
- ✅ Tela capturada e exibida
- ✅ Mouse/teclado responsivos

---

## 🎉 Exemplo de Sessão Completa

```
[02:01:30] Servidor iniciado porta 3000
[02:01:45] Código gerado: 952680
[02:01:50] Host conectado: uuid-host
[02:01:55] Viewer conectado: uuid-viewer
[02:02:00] Tela capturada: 198.4KB
[02:02:05] Comando mouse: (500,500)
[02:02:10] Comando teclado: Tab
[02:02:15] Nova captura: 197.4KB
```

**🎯 Resultado**: Controle remoto funcionando perfeitamente!