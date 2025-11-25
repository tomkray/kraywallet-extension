# 🏗️ Arquitetura do Sistema - Ordinals Marketplace

## 📊 Visão Geral

Este documento explica como o marketplace de Ordinals funciona, incluindo o mecanismo de ofertas PSBT e swap de Runes.

## 🔄 Fluxo de Funcionamento

### 1. Marketplace de Ordinals

#### Como funciona a listagem de Inscriptions:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Owner      │────>│  Frontend    │────>│   Backend    │
│ (Seller)     │     │  (Browser)   │     │   API        │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                   │
                                                   v
                                          ┌────────────────┐
                                          │   Database     │
                                          │  inscriptions  │
                                          │  listed = true │
                                          └────────────────┘
```

**Passos:**
1. Dono da inscription conecta wallet
2. Escolhe inscription para vender
3. Define preço em satoshis
4. Sistema marca como "listed" no database
5. Aparece no marketplace para compradores

#### Como funciona a criação de ofertas (PSBT):

```
┌──────────────┐                           ┌──────────────┐
│   Buyer      │                           │   Seller     │
│ (Comprador)  │                           │  (Vendedor)  │
└──────┬───────┘                           └──────┬───────┘
       │                                          │
       │ 1. Cria oferta                          │
       │    - Inscription ID                     │
       │    - Valor (sats)                       │
       │    - Fee rate                           │
       v                                          │
┌──────────────┐                                 │
│   Backend    │                                 │
│  /psbt/create│                                 │
└──────┬───────┘                                 │
       │                                          │
       │ 2. Gera PSBT                            │
       │    (Partially Signed Bitcoin Tx)        │
       v                                          │
┌──────────────┐                                 │
│    PSBT      │ ───────────────────────────────>│
│  (unsigned)  │  3. Compartilha PSBT            │
└──────────────┘                                 │
                                                  │
                                                  │ 4. Assina PSBT
                                                  │    (com chave privada)
                                                  v
                                          ┌──────────────┐
                                          │    PSBT      │
                                          │  (signed)    │
                                          └──────┬───────┘
                                                  │
                                                  │ 5. Broadcast
                                                  v
                                          ┌──────────────┐
                                          │   Bitcoin    │
                                          │   Network    │
                                          └──────────────┘
```

**Vantagens do PSBT:**
- ✅ Comprador nunca tem acesso às chaves do vendedor
- ✅ Vendedor pode revisar transação antes de assinar
- ✅ Pode ser assinado em hardware wallet
- ✅ Mais seguro que transferências diretas

#### Novo na v0.23.3: Auto-Submit

```
┌──────────────┐
│   Buyer      │
└──────┬───────┘
       │
       │ ord wallet offer create <ID> --submit
       v
┌──────────────────────────────────┐
│  PSBT criado + Assinado + Enviado│
│  Tudo em um comando!             │
└──────────────────────────────────┘
```

### 2. Runes Swap

#### Como funciona o swap de Runes:

Runes são tokens fungíveis no Bitcoin. O swap funciona através de **Liquidity Pools** (AMM - Automated Market Maker).

```
                    ┌──────────────────────┐
                    │   Liquidity Pool     │
                    │                      │
                    │  Reserve A: 1,000    │
                    │  Reserve B: 2,000    │
                    │  (RUNE_A / RUNE_B)   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
    ┌─────────v────────┐              ┌────────v─────────┐
    │   User wants     │              │  Pool sends      │
    │   swap 100 A     │              │  ~198 B back     │
    │   for B          │              │  (minus fee)     │
    └──────────────────┘              └──────────────────┘
```

**Fórmula de Constant Product (x * y = k):**
```
reserve_a * reserve_b = k (constante)

Quando adiciona 100 A:
(1000 + 100) * reserve_b_new = 1000 * 2000
reserve_b_new = 2,000,000 / 1,100 = 1,818

B enviado ao user = 2000 - 1818 = 182
Fee (0.3%) = 182 * 0.003 = 0.55
User recebe: ~181.45 B
```

#### Processo de Swap com PSBT:

```
┌──────────────┐
│   Trader     │
└──────┬───────┘
       │
       │ 1. Quote
       │    "Quantos B por 100 A?"
       v
┌──────────────────┐
│   Backend        │
│ /runes/quote     │  ────> Calcula usando fórmula AMM
└──────┬───────────┘
       │
       │ 2. Exibir cotação
       │    Rate: 1 A = 1.8145 B
       │    Impact: 4.55%
       v
┌──────────────┐
│   Frontend   │
│ Confirma?    │
└──────┬───────┘
       │ Sim
       │
       │ 3. Criar PSBT de swap
       v
┌──────────────────┐
│   Backend        │
│ /psbt/create     │  ────> Cria PSBT com:
└──────────────────┘        - Input: 100 A
                            - Output: ~181 B
                            │
                            │ 4. PSBT gerado
                            v
                    ┌──────────────┐
                    │  Assinar     │
                    │  (wallet)    │
                    └──────┬───────┘
                           │
                           │ 5. Broadcast
                           v
                    ┌──────────────┐
                    │   Bitcoin    │
                    │   Mempool    │
                    └──────────────┘
```

### 3. Wallet Sweep (Novo v0.23.3)

Consolida todos os UTXOs de uma wallet em um único endereço.

```
┌────────────────────────────────┐
│   Wallet Original              │
│                                │
│   UTXO 1: 0.001 BTC           │
│   UTXO 2: 0.0005 BTC          │
│   UTXO 3: 0.002 BTC           │
│   UTXO 4: 0.0003 BTC          │
│   ...                          │
│   UTXO 50: 0.0001 BTC         │
└────────┬───────────────────────┘
         │
         │ ord wallet sweep <NEW_ADDRESS> --fee-rate 10
         │
         v
┌────────────────────────────────┐
│   Endereço Novo                │
│                                │
│   UTXO 1: 0.0519 BTC          │
│   (consolidado - fee)          │
└────────────────────────────────┘
```

**Vantagens:**
- Reduz custos de transações futuras
- Melhor privacidade
- Facilita migração de wallets
- Útil para limpeza de dust

## 🗄️ Banco de Dados

### Esquema de Relacionamentos

```
┌─────────────────┐         ┌─────────────────┐
│  inscriptions   │         │     offers      │
│─────────────────│         │─────────────────│
│ id (PK)         │<────┐   │ id (PK)         │
│ number          │     └───│ inscription_id  │
│ content         │         │ offer_amount    │
│ price           │         │ psbt            │
│ listed          │         │ status          │
│ owner           │         │ creator_address │
└─────────────────┘         └─────────────────┘


┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     runes       │         │ liquidity_pools │         │     trades      │
│─────────────────│         │─────────────────│         │─────────────────│
│ id (PK)         │<────┐   │ id (PK)         │         │ id (PK)         │
│ name            │     ├───│ rune_a (FK)     │<────────│ pool_id (FK)    │
│ symbol          │     └───│ rune_b (FK)     │         │ from_rune       │
│ total_supply    │         │ reserve_a       │         │ to_rune         │
└─────────────────┘         │ reserve_b       │         │ from_amount     │
                            └─────────────────┘         │ to_amount       │
                                                         │ price           │
┌─────────────────┐                                     │ txid            │
│ rune_balances   │                                     └─────────────────┘
│─────────────────│
│ address         │
│ rune_id (FK)    │
│ balance         │
└─────────────────┘
```

## 🔐 Segurança

### Princípios de Segurança:

1. **Chaves privadas nunca saem do cliente**
   - Assinatura sempre no browser/wallet
   - Backend nunca vê chaves privadas

2. **PSBT permite auditoria**
   - Usuário pode decodificar e verificar
   - Pode usar ferramentas externas (Sparrow, etc)

3. **Validações múltiplas**
   ```
   ┌──────────────┐
   │   Frontend   │ ──> Valida inputs
   └──────┬───────┘
          │
          v
   ┌──────────────┐
   │   Backend    │ ──> Valida novamente
   └──────┬───────┘
          │
          v
   ┌──────────────┐
   │   Database   │ ──> Constraints SQL
   └──────┬───────┘
          │
          v
   ┌──────────────┐
   │   Bitcoin    │ ──> Valida transação
   └──────────────┘
   ```

4. **Rate limiting**
   - Previne spam de ofertas
   - Protege contra DoS

5. **Expiração de ofertas**
   - Ofertas expiram em 24h
   - Previne ofertas obsoletas

## 🚀 Performance

### Otimizações:

1. **Índices de Banco**
   ```sql
   CREATE INDEX idx_inscriptions_listed ON inscriptions(listed);
   CREATE INDEX idx_offers_status ON offers(status);
   CREATE INDEX idx_trades_pool ON trades(pool_id);
   ```

2. **Cache de Queries**
   - Pools são cached por 30s
   - Inscriptions populares são cached

3. **Paginação**
   - Limite de 50 itens por página
   - Evita carregar todo dataset

4. **WebSocket para updates**
   - Ofertas em tempo real
   - Trades ao vivo

## 📡 API Design

### RESTful Endpoints:

```
GET    /api/ordinals              # Lista inscriptions
POST   /api/ordinals/:id/list     # Listar para venda
GET    /api/runes                 # Lista runes
POST   /api/runes/quote           # Cotação de swap
POST   /api/offers                # Criar oferta
PUT    /api/offers/:id/submit     # Submeter oferta ⭐ NOVO
POST   /api/wallet/sweep          # Criar sweep ⭐ NOVO
POST   /api/psbt/create           # Criar PSBT
POST   /api/psbt/broadcast        # Broadcast PSBT
```

### Response Format:

```json
{
  "success": true,
  "data": {...},
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Error Format:

```json
{
  "error": "Inscription not found",
  "status": 404,
  "code": "INSCRIPTION_NOT_FOUND"
}
```

## 🔄 Integração com ord CLI

### Comandos Principais:

```bash
# Criar oferta
ord wallet offer create <INSCRIPTION_ID> \
  --amount 1000000 \
  --fee-rate 10

# ⭐ NOVO: Submeter diretamente
ord wallet offer create <INSCRIPTION_ID> \
  --amount 1000000 \
  --fee-rate 10 \
  --submit

# ⭐ NOVO: Sweep wallet
ord wallet sweep <ADDRESS> --fee-rate 10

# Ver inscriptions
ord wallet inscriptions

# Ver sats
ord wallet sats
```

## 📈 Escalabilidade

### Para crescer o sistema:

1. **Database**
   - SQLite → PostgreSQL (>100k inscriptions)
   - Add read replicas
   - Shard por range de inscription numbers

2. **Cache**
   - Adicionar Redis
   - Cache de pools, quotes, balances

3. **CDN**
   - Conteúdo de inscriptions via CDN
   - Imagens via IPFS

4. **Queue**
   - Background jobs para indexing
   - Process PSBTs assincronamente

5. **Microservices**
   - Separar ordinals service
   - Runes service
   - PSBT service

---

**Sistema projetado para ser simples, seguro e escalável! 🚀**











