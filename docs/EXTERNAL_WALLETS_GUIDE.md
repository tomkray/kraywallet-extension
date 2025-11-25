# 🌐 GUIA: Como Listar no Kray Station com Outras Wallets

## 🎯 Para Usuários de Unisat, Xverse, Leather

Você pode listar suas inscriptions no **Kray Station Marketplace** mesmo sem usar a Kray Wallet!

**Wallets Compatíveis:**
- 🟠 Unisat Wallet
- 🟠 Xverse Wallet  
- 🟠 Leather Wallet
- 🟠 Qualquer wallet com ORD CLI

---

## 📋 REQUISITOS

### 1. **ORD CLI Instalado**
```bash
# macOS/Linux
curl --proto '=https' --tlsv1.2 -fsLS https://ordinals.com/install.sh | bash

# Verificar instalação
ord --version
```

### 2. **Bitcoin Core Sincronizado**
- Bitcoin Core rodando
- RPC habilitado
- Totalmente sincronizado

### 3. **Wallet ORD Configurada**
```bash
# Restaurar sua wallet no ORD
ord wallet restore "your twelve word mnemonic phrase here"

# Verificar saldo
ord wallet balance
```

---

## 🚀 CRIAR OFERTA NO KRAY STATION

### Passo 1: Listar sua inscription
```bash
ord wallet offer create \
  --inscription <INSCRIPTION_ID> \
  --price <PRICE_IN_SATS> \
  --fee-rate 10

# Exemplo:
ord wallet offer create \
  --inscription abc123def456...i0 \
  --price 50000 \
  --fee-rate 10
```

### Passo 2: Aguardar indexação
- Kray Station indexa ofertas **a cada 5 minutos**
- Sua oferta aparecerá automaticamente no Browse Ordinals
- Badge laranja: **⚡ ORD CLI • 1% Fee**

### Passo 3: Pronto!
- Sua inscription está listada
- Qualquer pessoa pode comprar
- Você recebe o pagamento automaticamente

---

## 💰 TAXAS

| Item | Valor |
|------|-------|
| **Taxa de Listagem** | GRÁTIS |
| **Taxa de Serviço** | 1% (descontado do preço de venda) |
| **Taxa de Rede** | Você escolhe (fee-rate) |

**Exemplo:**
- Preço: 100,000 sats
- Taxa Kray Station (1%): 1,000 sats
- **Você recebe: 99,000 sats** ✅

---

## 🔍 VERIFICAR SUAS OFERTAS

```bash
# Listar todas as suas ofertas ativas
ord wallet offers

# Ver detalhes de uma oferta
ord wallet offer info <OFFER_ID>

# Cancelar uma oferta
ord wallet offer cancel <OFFER_ID>
```

---

## 🌐 ACOMPANHAR NO KRAY STATION

1. Acesse: **https://kraystation.com/ordinals.html**
2. Suas ofertas terão o badge: **⚡ ORD CLI • 1% Fee**
3. Quando alguém comprar, você recebe o pagamento direto na sua wallet!

---

## ❓ FAQ

### **P: Por que usar ORD CLI ao invés de Kray Wallet?**
**R:** Se você já usa Unisat, Xverse ou Leather e não quer trocar de wallet, pode listar via ORD CLI. É totalmente compatível!

### **P: Por que 1% de taxa?**
**R:** 
- Ofertas **Kray Wallet nativas**: 0% taxa
- Ofertas **ORD CLI externas**: 1% taxa (para manter a infraestrutura)

### **P: Minha oferta é segura?**
**R:** SIM! O PSBT é assinado pela sua wallet. O Kray Station apenas facilita o match entre comprador e vendedor. Atomic swap = trustless!

### **P: Quanto tempo para indexar?**
**R:** Máximo 5 minutos (cron job automático).

### **P: Posso cancelar a oferta?**
**R:** SIM!
```bash
ord wallet offer cancel <OFFER_ID>
```

---

## 🎉 VANTAGENS

✅ Não precisa instalar nova wallet
✅ Usa sua wallet favorita (Unisat, Xverse, etc)
✅ Padrão ORD = máxima segurança
✅ Listagem em 1 comando
✅ Alcance o público do Kray Station!

---

## 🔗 LINKS ÚTEIS

- **Kray Station:** https://kraystation.com
- **ORD Docs:** https://docs.ordinals.com
- **Bitcoin Core:** https://bitcoin.org/en/download
- **Suporte:** https://t.me/kraystation

---

## 💡 DICA PRO

Para **melhor UX** e **0% de taxa**, considere usar a **Kray Wallet**! 🚀

- Browser extension
- 1 clique para listar
- Social marketplace (likes, comments)
- BitChat integrado
- Zero taxas

Baixe em: **https://kraystation.com/wallet**

---

**🎯 Bem-vindo ao Kray Station Marketplace!**

