# 🛠️ Comandos de Build - Remote Control

## 📦 **Comandos Principais**

### **Build para Produção**
```bash
# Windows (atual)
npm run build:win

# Linux (Ubuntu/Debian)
npm run build:linux

# macOS (requer macOS)
npm run build:mac

# Todas as plataformas
npm run build:alla
```

### **Desenvolvimento**
```bash
# Executar localmente
npm start

# Modo desenvolvimento com hot-reload
npm run dev

# Apenas servidor backend
npm run server
```

### **Testes e Verificação**
```bash
# Instalar dependências
npm install

# Verificar dependências nativas
npm run postinstall

# Gerar apenas pacote (sem instalador)
npm run pack
```

## 🎯 **Arquivos Resultantes**

### **Windows**
- `dist/Remote Control-1.0.0-x64.exe` (80MB) - Instalador
- `dist/win-unpacked/` - Versão portátil

### **Linux** (quando executado)
- `dist/Remote Control-1.0.0-x64.AppImage` - Portátil
- `dist/Remote Control-1.0.0-x64.deb` - Instalável

### **macOS** (quando executado)
- `dist/Remote Control-1.0.0-x64.dmg` - Intel
- `dist/Remote Control-1.0.0-arm64.dmg` - Apple Silicon

## ⚡ **Build Rápido**

```bash
# Apenas executar estas duas linhas para distribuir:
npm install
npm run build:win
```

## 🔧 **Resolução de Problemas**

```bash
# Limpar cache de build
rm -rf dist/
rm -rf node_modules/
npm install

# Recompilar dependências nativas
npm rebuild

# Verificar configuração
npm run pack --dry-run
```

## 📁 **Estrutura Final**
```
RemoteControl/
├── dist/
│   ├── Remote Control-1.0.0-x64.exe    # DISTRIBUIR ESTE ARQUIVO
│   └── win-unpacked/                    # Ou esta pasta (portátil)
├── src/                                 # Código fonte
├── build/                               # Ícones e recursos
├── package.json                         # Configuração
├── DISTRIBUTION.md                      # Guia de distribuição
└─  README.md                           # Documentação
```

## 🚀 **Pronto para Distribuição!**

O executável `Remote Control-1.0.0-x64.exe` está pronto para ser distribuído aos usuários finais!