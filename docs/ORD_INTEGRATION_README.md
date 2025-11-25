# 🎯 INTEGRAÇÃO ORD + TAXA DE SERVIÇO 1%

## 📋 RESUMO

Implementamos a integração com ofertas criadas via **ORD CLI externo** (`ord wallet offer create`), permitindo que apareçam no nosso mercado com uma taxa de serviço de **1%**.

---

## ✅ O QUE FOI IMPLEMENTADO:

### 1️⃣ **DATABASE SCHEMA** ✅

Adicionadas 3 novas colunas na tabela `offers`:

```sql
ALTER TABLE offers ADD COLUMN source TEXT DEFAULT 'kraywallet';
ALTER TABLE offers ADD COLUMN service_fee_percentage REAL DEFAULT 0.0;
ALTER TABLE offers ADD COLUMN service_fee_address TEXT;
```

- **`source`**: Identifica de onde vem a oferta (`kraywallet` ou `ord-cli`)
- **`service_fee_percentage`**: Porcentagem da taxa (1.0 = 1%)
- **`service_fee_address`**: Endereço para receber a taxa

### 2️⃣ **API ROUTES** ✅

**Novo arquivo:** `server/routes/ord-offers.js`

**Endpoints:**

- `GET /api/ord-offers/index` - Indexar ofertas do ORD CLI
- `GET /api/ord-offers/config` - Ver configurações de service fee

**Como usar:**
```bash
curl http://localhost:3000/api/ord-offers/index
```

### 3️⃣ **CRON JOB** ✅

**Novo arquivo:** `server/jobs/index-ord-offers.js`

- Auto-indexa ofertas ORD a cada 5 minutos (configurável)
- Detecta novas ofertas criadas via `ord wallet offer create`
- Salva no banco com flag `source = 'ord-cli'`

### 4️⃣ **PURCHASE LOGIC** ✅

**Modificado:** `server/routes/purchase.js`

Quando o buyer clica "Buy Now":

1. Busca a oferta no banco
2. Verifica se `source === 'ord-cli'`
3. Se sim, calcula taxa de serviço
4. Adiciona Output extra no PSBT:

```
Output 0: Payment → Seller (preço original)
Output 1: Inscription → Buyer
Output 2: Service Fee → Kray Station (1% do preço) ✨
Output 3: Change → Buyer
```

### 5️⃣ **CONFIGURAÇÃO** ✅

**Novo arquivo:** `.env.example`

Variáveis de ambiente necessárias:

```bash
# Service Fee Configuration
SERVICE_FEE_ADDRESS=bc1qyour_kray_station_address_here
SERVICE_FEE_PERCENTAGE=1.0
SERVICE_FEE_MIN_AMOUNT=100

# ORD CLI Configuration
ORD_CLI_PATH=/usr/local/bin/ord
ORD_INDEXING_ENABLED=true
ORD_INDEXING_INTERVAL=300000
```

---

## 🚀 COMO USAR:

### **1. Configurar o `.env`:**

```bash
cp .env.example .env
```

Edite o `.env` e coloque seu endereço Bitcoin para receber as taxas:

```bash
SERVICE_FEE_ADDRESS=bc1qSEU_ENDERECO_AQUI
SERVICE_FEE_PERCENTAGE=1.0
ORD_INDEXING_ENABLED=true
```

### **2. Instalar dependências:**

```bash
npm install
```

### **3. Iniciar o servidor:**

```bash
npm start
```

O servidor vai:
- ✅ Rodar migrations (adicionar colunas no banco)
- ✅ Iniciar cron job para indexar ofertas ORD
- ✅ Auto-indexar ofertas a cada 5 minutos

### **4. Indexar ofertas manualmente (opcional):**

```bash
curl http://localhost:3000/api/ord-offers/index
```

---

## 📊 WORKFLOW COMPLETO:

### **Cenário 1: Usuário cria oferta via KrayWallet**

```
User → KrayWallet → Backend → DB
                                ↓
                        source: 'kraywallet'
                        service_fee: 0%
```

**Resultado:** ✅ **0% taxa** (nossa plataforma)

---

### **Cenário 2: Usuário externo cria oferta via ORD CLI**

```
External User → ORD CLI
                  ↓
            ord wallet offer create
                  ↓
      Nosso cron job detecta
                  ↓
        Salva no nosso DB
                  ↓
        source: 'ord-cli'
        service_fee: 1%
```

**Resultado:** ✅ **1% taxa** (oferta externa)

---

### **Cenário 3: Comprador compra oferta externa**

```
Buyer → Buy Now → Backend cria PSBT:
                       ↓
            Output 0: Seller (10,000 sats)
            Output 1: Buyer (inscription)
            Output 2: Kray Station (100 sats) ← 1% taxa! ✨
            Output 3: Buyer (change)
                       ↓
              Buyer assina → Broadcast
```

**Resultado:** ✅ **Kray Station recebe 1% automaticamente!**

---

## 🎨 FRONTEND (PRÓXIMO PASSO):

Para mostrar no UI que é uma oferta externa, adicione no `app.js`:

```javascript
function createOfferCard(offer) {
    const isExternal = offer.source === 'ord-cli';
    const serviceFee = isExternal ? offer.service_fee_percentage : 0;
    
    return `
        <div class="offer-card">
            ${isExternal ? `
                <div class="service-fee-badge">
                    🏷️ External Offer
                    <span>+${serviceFee}% service fee</span>
                </div>
            ` : `
                <div class="kraywallet-badge">
                    ✅ KrayWallet Offer
                    <span>No service fee</span>
                </div>
            `}
            ...
        </div>
    `;
}
```

---

## 🛠️ REQUISITOS:

### **Para funcionar 100%:**

1. ✅ ORD CLI instalado (`ord` no PATH)
2. ✅ `node-cron` instalado (já está no `package.json`)
3. ✅ Endereço Bitcoin configurado no `.env`
4. ✅ Cron job habilitado (`ORD_INDEXING_ENABLED=true`)

### **Se ORD CLI não estiver instalado:**

Não tem problema! O cron job vai falhar silenciosamente e o resto do sistema continua funcionando normalmente.

Você só não vai indexar ofertas externas, mas KrayWallet continua funcionando 100%.

---

## 💰 MONETIZAÇÃO:

### **Ofertas KrayWallet:**
- ✅ 0% taxa
- ✅ Incentiva uso da nossa wallet
- ✅ Liquidez garantida

### **Ofertas Externas (ORD CLI):**
- 💰 1% taxa automática
- ✅ Marketplace unificado
- ✅ Interoperabilidade com ORD oficial
- ✅ Receita passiva

---

## 📈 BENEFÍCIOS:

1. **Liquidez**: Mais ofertas = mais atividade
2. **Interoperabilidade**: Compatível com ORD CLI oficial
3. **Monetização**: 1% de taxa em ofertas externas
4. **Incentivo**: 0% para KrayWallet = mais usuários
5. **Automatização**: Cron job indexa sozinho

---

## 🔧 TROUBLESHOOTING:

### **Erro: "command not found: ord"**

Solução: Instalar ORD CLI ou desabilitar indexing:

```bash
ORD_INDEXING_ENABLED=false
```

### **Erro: "EPERM" ao rodar `npm install`**

Solução: Executar manualmente no terminal:

```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

### **Ofertas ORD não aparecem:**

1. Verificar se cron job está rodando:
   - Deve aparecer no log: `🔄 Starting ORD indexing cron job`

2. Indexar manualmente:
   ```bash
   curl http://localhost:3000/api/ord-offers/index
   ```

3. Verificar configuração:
   ```bash
   curl http://localhost:3000/api/ord-offers/config
   ```

---

## 🎯 PRÓXIMOS PASSOS:

1. ✅ **Finalizar bug do KrayWallet marketplace** (atomic swap)
2. 🎨 **Adicionar badges no frontend** (External vs KrayWallet)
3. 📊 **Dashboard de analytics** (quantas ofertas externas, revenue)
4. 🔔 **Notificações** quando novas ofertas ORD são detectadas
5. 🌐 **API pública** para listar ofertas (para outros marketplaces usarem)

---

## 📚 DOCUMENTAÇÃO RELACIONADA:

- [ORD Wallet Offers](https://github.com/ordinals/ord/pull/4408)
- [ORD 0.23.3 Release](https://github.com/ordinals/ord/releases/tag/0.23.3)
- [Satscards Guide](https://docs.ordinals.com/guides/satscards.html)

---

**🚀 IMPLEMENTAÇÃO COMPLETA! AGORA É SÓ CONFIGURAR E TESTAR!**

