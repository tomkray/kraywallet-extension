# 🔓 COMO DESBLOQUEAR A WALLET LND MANUALMENTE

## 📋 PASSO A PASSO:

### 1️⃣ Abra um NOVO Terminal (fora do Cursor)

```bash
# No macOS: Abra o Terminal.app
# Ou use qualquer terminal de sua preferência
```

### 2️⃣ Navegue até o diretório do projeto

```bash
cd "/Volumes/D2/KRAY WALLET- V1"
```

### 3️⃣ Execute o comando de unlock

```bash
./lnd/lncli --lnddir=./lnd-data --rpcserver=localhost:10009 unlock
```

### 4️⃣ Digite sua senha

```
Input wallet password: [DIGITE SUA SENHA AQUI]
```

**⚠️ IMPORTANTE:** 
- A senha NÃO será exibida enquanto você digita (isso é normal por segurança)
- Apenas digite e pressione ENTER

### 5️⃣ Aguarde a confirmação

Se tudo der certo, você verá:
```
✅ Wallet unlocked successfully!
```

### 6️⃣ Verifique se está funcionando

```bash
./lnd/lncli --lnddir=./lnd-data --rpcserver=localhost:10009 getinfo
```

Você deve ver informações sobre o seu nó Lightning!

---

## 🔄 ALTERNATIVA: Usar o Script Node.js

Se preferir, você pode usar o script que criamos:

```bash
cd "/Volumes/D2/KRAY WALLET- V1"
node unlock-lnd-api.js "SUA_SENHA_AQUI"
```

**Substitua `"SUA_SENHA_AQUI"` pela sua senha real.**

---

## ✅ DEPOIS DE DESBLOQUEAR

Volte aqui no Cursor e me avise que desbloqueou! Vou verificar se tudo está funcionando e começar os testes! 🚀

---

## ❌ SE DER ERRO

Possíveis problemas:

1. **Senha incorreta:** Tente novamente com a senha correta
2. **LND não está rodando:** Verifique os processos com `ps aux | grep lnd`
3. **Porta ocupada:** Reinicie o LND com `pkill -f lnd && ./start-lnd.sh`

---

## 📞 PRECISA DE AJUDA?

Me avise e vou te ajudar a resolver! 😊

