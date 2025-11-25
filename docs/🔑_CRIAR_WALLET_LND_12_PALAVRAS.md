# 🔑 CRIAR WALLET LND COM 12 PALAVRAS

## ⚠️ **PROBLEMA:**

O LND usa formato aezeed (24 palavras) por padrão.
Mas sua MyWallet usa BIP39 (12 palavras).

## ✅ **SOLUÇÃO:**

Usar extended key (xprv) derivado das suas 12 palavras!

---

## 📋 **EXECUTE ESTE COMANDO:**

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Substitua:
# - "palavra1 palavra2 ... palavra12" pelas suas 12 palavras
# - "suasenha" pela sua senha

node create-lnd-wallet.js "palavra1 palavra2 ... palavra12" "suasenha"
```

---

## 🎯 **EXEMPLO:**

Se suas palavras são:
```
apple banana cat dog elephant frog goat horse iguana jaguar koala lion
```

E sua senha é:
```
12345678
```

Execute:
```bash
node create-lnd-wallet.js "apple banana cat dog elephant frog goat horse iguana jaguar koala lion" "12345678"
```

---

## ✅ **O QUE VAI ACONTECER:**

```
🔑 Criando wallet LND com suas 12 palavras...
✅ Mnemonic válido (12 palavras)
📝 Senha: ********
✅ Extended private key derivada
📋 Criando wallet LND...
⏳ Aguarde...

✅ Wallet LND criada com sucesso!

🎉 SUCESSO!
✅ Wallet LND criada com suas 12 palavras
✅ Mesma seed da MyWallet
✅ Mesmo endereço Taproot
```

---

## 🧪 **VERIFICAR:**

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals
./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=./lnd-data --network=mainnet getinfo
```

**Deve aparecer:**
```json
{
    "version": "0.17.0-beta",
    "identity_pubkey": "03...",
    "alias": "MyWallet-DEX-Node",
    ...
}
```

---

## 🎉 **DEPOIS DISSO:**

1. Testar Lightning na MyWallet UI
2. Resetar wallet e fazer restore
3. Ver unlock automático funcionando!

---

**EXECUTE AGORA!** 🚀




