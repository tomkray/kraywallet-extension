# 🚀 COMO INICIAR O SERVIDOR KRAY STATION

## ⚡ Método Rápido (Recomendado)

```bash
./START-SERVIDOR-FULL.sh
```

Este script faz **TUDO automaticamente**:
- ✅ Para processos Node antigos
- ✅ Limpa a porta 3000
- ✅ Verifica o ORD server
- ✅ Limpa logs antigos
- ✅ Inicia o servidor Node.js
- ✅ Testa APIs e Frontend
- ✅ Mostra status completo

---

## 📋 Método Manual (Passo a Passo)

### 1️⃣ Parar Servidor Atual

```bash
pkill -9 node
```

### 2️⃣ Iniciar Servidor

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start
```

### 3️⃣ Verificar se Está Funcionando

```bash
# Testar API
curl http://localhost:3000/api/health

# Testar Frontend
curl http://localhost:3000
```

---

## 🔧 ORD Server (Opcional mas Recomendado)

Para que as **inscriptions e runes sejam indexadas do blockchain**, você precisa ter o ORD server rodando:

```bash
# Iniciar ORD server na porta 80 (precisa de sudo)
sudo ord --index-runes --index-sats server --http-port 80
```

**Importante:**
- ⚠️ Sem o ORD server, a MyWallet não mostrará inscriptions/runes do blockchain
- ✅ Com o ORD server, tudo funciona perfeitamente!

---

## 📊 Serviços Disponíveis

| Serviço | URL | Descrição |
|---------|-----|-----------|
| 🌐 **Home** | http://localhost:3000 | Página principal |
| 🖼️ **Ordinals Market** | http://localhost:3000/ordinals.html | Marketplace de Ordinals |
| 🪙 **Runes Swap** | http://localhost:3000/runes-swap.html | Swap de Runes (Layer 1) |
| ⚡ **Lightning DEX** | http://localhost:3000/lightning-hub.html | Lightning Network DEX |
| 🔌 **API Health** | http://localhost:3000/api/health | Status da API |
| 📦 **API Ordinals** | http://localhost:3000/api/ordinals | Listar Ordinals |
| 🪙 **API Runes** | http://localhost:3000/api/runes | Listar Runes |

---

## 🛑 Parar o Servidor

```bash
pkill -9 node
```

---

## 📝 Ver Logs em Tempo Real

```bash
tail -f server-full.log
```

---

## 🐛 Troubleshooting

### "Porta 3000 já está em uso"

```bash
# Matar processo na porta 3000
lsof -ti:3000 | xargs kill -9

# Tentar iniciar novamente
./START-SERVIDOR-FULL.sh
```

### "ORD server não está respondendo"

```bash
# Verificar se está rodando
lsof -ti:80

# Se não estiver, iniciar:
sudo ord --index-runes --index-sats server --http-port 80
```

### "Frontend não abre"

1. Verifique se o servidor está rodando: `lsof -ti:3000`
2. Verifique os logs: `tail -50 server-full.log`
3. Tente reiniciar: `./START-SERVIDOR-FULL.sh`

### "MyWallet não mostra inscriptions/runes"

1. ✅ Verifique se o ORD server está rodando: `lsof -ti:80`
2. ✅ Recarregue a extensão MyWallet no Chrome
3. ✅ Reconecte a wallet no frontend

---

## ✨ Status Atual do Sistema

Após executar `./START-SERVIDOR-FULL.sh`, você verá:

```
✅ KRAY STATION INICIADO COM SUCESSO!

📊 SERVIÇOS DISPONÍVEIS:
   🌐 Frontend Home:        http://localhost:3000
   🖼️  Ordinals Market:     http://localhost:3000/ordinals.html
   ...

✨ Tudo pronto para usar! ✨
```

---

## 🎯 Próximos Passos

1. **Abra o browser:** http://localhost:3000
2. **Recarregue a extensão MyWallet** (chrome://extensions)
3. **Conecte sua wallet** e comece a usar!

---

**Criado em:** 23/10/2024  
**Versão:** 1.0  
**Sistema:** KRAY STATION - Bitcoin Ordinals & Runes Platform


