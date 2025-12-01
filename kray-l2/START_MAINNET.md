# 🚀 START KRAY L2 MAINNET

**Configuração final para usar com KRAY real!**

---

## ✅ O Que Foi Feito:

1. ✅ Geradas chaves NOVAS específicas para MAINNET
2. ✅ Configurado QuickNode MAINNET
3. ✅ Database separado (mainnet.db)
4. ✅ Tudo pronto para KRAY real

---

## 🔑 Chaves MAINNET (NOVAS):

```
Validator 1: famous glass way stock loan correct help example ranch gaze castle pudding
Validator 2: cement blue stable cart hero hat physical powder family surge eyebrow priority
Validator 3: near grow mind analyst faint lamp song soon beauty kangaroo buyer hire
```

**⚠️ GUARDE ESSAS CHAVES COM SEGURANÇA!**

Estas são as chaves do multisig que vai guardar TODO o KRAY depositado!

---

## 🚀 Como Iniciar:

```bash
cd "/Volumes/D2/KRAY WALLET- V1/kray-l2"
npm start
```

**Aguarde ver:**
```
✅ KRAY SPACE L2 is running!
   Port: 5001
   Bridge: bc1p...
   Network: kray-mainnet-1
```

---

## 🔍 Verificar Se Funcionou:

```bash
# Outro terminal:
curl http://localhost:5001/api/bridge/info
```

**Deve mostrar:**
```json
{
  "multisig_address": "bc1p...",
  "network": "mainnet"  ← IMPORTANTE!
}
```

---

## 📋 Novo Bridge Address (MAINNET):

Com as chaves novas, o multisig address será **DIFERENTE**!

Será gerado quando você iniciar o servidor.

**Copie esse address e guarde!**

---

## ⚠️ SEGURANÇA MAINNET:

### ANTES de Depositar:

- [ ] Servidor rodando sem erros
- [ ] Bridge address verificado
- [ ] Extension mostrando address correto
- [ ] Teste com POUCO KRAY primeiro (1-10)
- [ ] Monitor logs em tempo real
- [ ] Tenha backup das chaves validators

### Durante Deposit:

- [ ] Monitor servidor L2 (ver logs)
- [ ] Aguarde 6 confirmações (~60 min)
- [ ] Veja se detectou o deposit
- [ ] Veja se decodificou KRAY correto
- [ ] Veja se mintou credits

### Se Der Erro:

- NÃO entre em pânico
- Verifique logs
- KRAY está no multisig (seguro)
- Pode recuperar com as 3 chaves validators

---

## 🎯 Próximos Passos:

1. **Inicie servidor:** `npm start`
2. **Veja novo bridge address**
3. **Copie e guarde**
4. **Recarregue extension**
5. **Vá para deposit screen**
6. **Veja novo address**
7. **Teste com 1 KRAY primeiro**

---

## 💾 BACKUP DAS CHAVES:

**GUARDE ESTAS 3 FRASES EM LOCAL SEGURO:**

```
1. famous glass way stock loan correct help example ranch gaze castle pudding
2. cement blue stable cart hero hat physical powder family surge eyebrow priority
3. near grow mind analyst faint lamp song soon beauty kangaroo buyer hire
```

**Se perder, perde TODO o KRAY no multisig!** 🚨

---

## 🎊 Pronto!

**Você está fazendo CERTO!**

Separar chaves testnet/mainnet = profissional e seguro! ✅

**Agora:**
```bash
npm start
```

**E me diga o novo bridge address que aparecer!** 😊




