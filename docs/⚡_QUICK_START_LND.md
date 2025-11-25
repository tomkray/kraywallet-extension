# ⚡ LIGHTNING QUICK START!

## 🚀 **3 COMANDOS PARA COMEÇAR:**

### **1. Corrigir npm + Instalar biblioteca:**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
sudo chown -R 501:20 "/Users/tomkray/.npm"
npm install lightning --save
```

### **2. Iniciar LND (NOVO TERMINAL):**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
./start-lnd.sh
```
**Deixe rodando!** ⚡

### **3. Criar wallet (OUTRO TERMINAL):**
```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
./lnd/lncli create
```
- Password: `[sua senha]`
- Usar seed existente? `n`
- **GUARDAR AS 24 PALAVRAS!** ✍️
- Digitar novamente para confirmar

---

## ✅ **VERIFICAR SE FUNCIONOU:**

```bash
./lnd/lncli getinfo
```

**Deve mostrar:**
```json
{
    "alias": "MyWallet-DEX-Node",
    "identity_pubkey": "03abc...",
    "num_active_channels": 0,
    "synced_to_chain": true
}
```

✅ **Funcionou!**

---

## 💰 **GERAR ENDEREÇO PARA RECEBER:**

```bash
./lnd/lncli newaddress p2tr
```

**Resultado:**
```json
{
    "address": "bc1p..."
}
```

**Envie 0.01 BTC (~1M sats) para este endereço!**

---

## 🎯 **DEPOIS:**

**Me avise quando:**
1. ✅ LND estiver rodando
2. ✅ Wallet criada
3. ✅ `getinfo` funcionar

**Vou conectar o backend ao LND!** 🔥

---

## 📊 **COMANDOS ÚTEIS:**

```bash
# Ver balance
./lnd/lncli walletbalance

# Ver channels
./lnd/lncli listchannels

# Parar LND
pkill lnd
```

---

**COMECE AGORA!** ⚡🚀




