# 📝 DEPOIS DO REINÍCIO DO MAC

## 🚀 **ORDEM DE INICIALIZAÇÃO:**

### **1️⃣ Iniciar Bitcoin Core (se necessário)**
```bash
# Se não iniciar automaticamente
bitcoind -daemon
```

Aguarde alguns segundos para sincronizar.

---

### **2️⃣ Iniciar ORD Server**
```bash
cd /Volumes/D1/Ord
sudo ./start_ord.sh
```

**OU** com cache reduzido (recomendado):
```bash
sudo ./ord --data-dir /Volumes/D1/Ord/data \
  --bitcoin-rpc-username Tomkray7 \
  --bitcoin-rpc-password bobeternallove77$ \
  --index-cache-size 2147483648 \
  --index-runes --index-sats \
  server --http-port 80
```

Aguarde alguns segundos...

---

### **3️⃣ Iniciar Backend Node.js**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
npm start
```

**OU** em background:
```bash
npm start > server.log 2>&1 &
```

---

### **4️⃣ Recarregar MyWallet Extension**
```
1. Abra: chrome://extensions
2. Encontre: MyWallet
3. Clique: 🔄 Reload
```

---

### **5️⃣ Testar**
```
1. Abra MyWallet popup
2. Faça unlock
3. ✅ Ordinals tab → Deve mostrar inscription
4. ✅ Runes tab → Deve mostrar DOG•GO•TO•THE•MOON
5. ✅ Activity tab → Deve mostrar transações
```

---

## 🔍 **VERIFICAR SE TUDO ESTÁ RODANDO:**

```bash
# Bitcoin Core
ps aux | grep bitcoind

# ORD Server
lsof -ti:80

# Backend Node
lsof -ti:3000

# Memória livre
vm_stat | grep "Pages free"

# Load average (deve estar < 5)
uptime
```

---

## ✅ **STATUS ESPERADO APÓS REINÍCIO:**

```
✅ Load Average: 2-4 (antes era 60!)
✅ Memória livre: >2GB (antes era 350MB)
✅ CPU idle: >50% (antes era 0%)
✅ Bitcoin Core: Rodando
✅ ORD Server: Rodando (porta 80)
✅ Backend: Rodando (porta 3000)
✅ MyWallet: Funcionando perfeitamente!
```

---

## 💡 **DICAS PÓS-REINÍCIO:**

1. **Feche apps que não está usando:**
   - Discord (se não precisar)
   - Adobe apps
   - Chrome tabs extras

2. **Monitore a memória:**
   ```bash
   top -l 1 | head -10
   ```

3. **Se ORD ainda consumir muito:**
   - Reduza o cache para 2GB ou 4GB
   - Ajuste no comando de inicialização

---

## 🆘 **SE DER PROBLEMA:**

### **ORD não inicia:**
```bash
# Verificar se Bitcoin Core está rodando
bitcoin-cli getblockchaininfo

# Ver logs do ORD
tail -50 /Volumes/D1/Ord/data/ord.log
```

### **Backend não inicia:**
```bash
# Limpar porta 3000
lsof -ti:3000 | xargs kill -9

# Tentar novamente
npm start
```

### **MyWallet não funciona:**
```
1. Recarregue a extensão (chrome://extensions)
2. Verifique console do background (service worker)
3. Verifique se APIs estão respondendo:
   curl http://localhost:3000/api/health
```

---

**BOA SORTE COM O REINÍCIO!** 🚀

Quando voltar, tudo deve estar muito mais rápido! 💨


