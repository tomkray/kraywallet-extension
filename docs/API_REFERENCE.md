# 📖 API Reference - Ordinals Marketplace

Documentação completa das APIs disponíveis no marketplace.

Base URL: `http://localhost:3000/api`

---

## 🏥 Status & Health

### GET `/api/health`

Health check básico do servidor.

**Response:**
```json
{
  "status": "ok",
  "version": "0.23.3",
  "timestamp": "2025-10-09T12:00:00.000Z"
}
```

### GET `/api/status`

Status completo incluindo conexão com Bitcoin Core e Ord Server.

**Response:**
```json
{
  "status": "ok",
  "version": "0.23.3",
  "timestamp": "2025-10-09T12:00:00.000Z",
  "nodes": {
    "bitcoin": {
      "connected": true,
      "chain": "main",
      "blocks": 867234,
      "headers": 867234,
      "sync": "100.00%",
      "error": null
    },
    "ord": {
      "connected": true,
      "status": "ok",
      "error": null
    }
  }
}
```

---

## 🎨 Ordinals (Inscriptions)

### GET `/api/ordinals`

Listar inscriptions com filtros.

**Query Parameters:**
- `search` (string): Buscar por ID ou número
- `sort` (string): `recent` | `price-low` | `price-high` | `number`
- `listed` (string): `all` | `true` | `false`
- `limit` (number): Limite de resultados (default: 50)
- `offset` (number): Offset para paginação (default: 0)

**Response:**
```json
{
  "inscriptions": [...],
  "pagination": {
    "total": 1000,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET `/api/ordinals/:id`

Buscar inscription específica por ID ou número.

**Response:**
```json
{
  "id": "abc123...",
  "inscription_number": 1000,
  "content_type": "image/png",
  "owner": "bc1q...",
  "listed": true,
  "price": 1000000
}
```

### GET `/api/ordinals/:id/content`

Obter conteúdo da inscription (imagem, texto, etc).

**Response:** Binary content with appropriate Content-Type header

### GET `/api/ordinals/latest`

Buscar últimas inscriptions criadas.

**Query Parameters:**
- `limit` (number): Limite de resultados (default: 100)

**Response:**
```json
{
  "success": true,
  "inscriptions": [...]
}
```

### POST `/api/ordinals/:id/list`

Listar inscription para venda.

**Body:**
```json
{
  "price": 1000000,
  "address": "bc1q..."
}
```

### DELETE `/api/ordinals/:id/unlist`

Remover inscription da venda.

---

## 🎭 Runes

### GET `/api/runes`

Listar todas as runes.

**Response:**
```json
{
  "success": true,
  "runes": [
    {
      "name": "BITCOIN•RUNE",
      "supply": 21000000,
      "divisibility": 8
    }
  ]
}
```

### GET `/api/runes/:name`

Obter informações de uma rune específica.

**Response:**
```json
{
  "success": true,
  "rune": {
    "name": "BITCOIN•RUNE",
    "supply": 21000000,
    "divisibility": 8,
    "symbol": "₿"
  }
}
```

### GET `/api/runes/:name/balance/:address`

Obter balance de uma rune para um endereço.

**Response:**
```json
{
  "success": true,
  "rune": "BITCOIN•RUNE",
  "address": "bc1q...",
  "balance": 1000000
}
```

### GET `/api/runes/address/:address`

Obter todas as runes de um endereço.

**Response:**
```json
{
  "success": true,
  "address": "bc1q...",
  "runes": [
    {
      "name": "BITCOIN•RUNE",
      "balance": 1000000
    }
  ]
}
```

### GET `/api/runes/trades`

Listar histórico de trades.

**Query Parameters:**
- `fromRune` (string): Filtrar por rune origem
- `toRune` (string): Filtrar por rune destino
- `address` (string): Filtrar por endereço
- `limit` (number): Limite de resultados (default: 50)
- `offset` (number): Offset para paginação

**Response:**
```json
{
  "success": true,
  "trades": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET `/api/runes/market/:fromRune/:toRune`

Obter informações de mercado de um par de runes.

**Response:**
```json
{
  "success": true,
  "market": {
    "fromRune": "BITCOIN•RUNE",
    "toRune": "OTHER•RUNE",
    "price": 1.5,
    "volume24h": 1000000,
    "tradesCount": 42,
    "activeOffers": 10,
    "offers": [...]
  }
}
```

---

## 🤝 Offers

### GET `/api/offers`

Listar ofertas.

**Query Parameters:**
- `type` (string): `inscription` | `rune_swap`
- `status` (string): `pending` | `active` | `completed` | `cancelled`
- `address` (string): Filtrar por criador
- `limit` (number): Limite de resultados
- `offset` (number): Offset para paginação

### GET `/api/offers/:id`

Buscar oferta específica.

### POST `/api/offers`

Criar nova oferta.

**Body:**
```json
{
  "type": "rune_swap",
  "fromRune": "BITCOIN•RUNE",
  "toRune": "OTHER•RUNE",
  "fromAmount": 1000000,
  "toAmount": 1500000,
  "feeRate": 10,
  "psbt": "cHNidP8...",
  "creatorAddress": "bc1q...",
  "expiresIn": 86400000
}
```

### PUT `/api/offers/:id/submit`

Submeter oferta (marcar como ativa).

**Body:**
```json
{
  "txid": "abc123..."
}
```

### PUT `/api/offers/:id/cancel`

Cancelar oferta.

### PUT `/api/offers/:id/complete`

Completar oferta.

**Body:**
```json
{
  "txid": "abc123..."
}
```

---

## 💼 Wallet

### GET `/api/wallet/balance/:address`

Obter balance Bitcoin de um endereço.

**Response:**
```json
{
  "address": "bc1q...",
  "balance": {
    "confirmed": 1000000,
    "unconfirmed": 0,
    "total": 1000000
  },
  "utxoCount": 5
}
```

### GET `/api/wallet/utxos/:address`

Obter UTXOs de um endereço.

**Response:**
```json
{
  "success": true,
  "address": "bc1q...",
  "utxos": [
    {
      "txid": "abc...",
      "vout": 0,
      "value": 500000,
      "height": 867234,
      "scriptPubKey": "0014..."
    }
  ]
}
```

### GET `/api/wallet/inscriptions/:address`

Obter inscriptions de um endereço.

**Response:**
```json
{
  "success": true,
  "address": "bc1q...",
  "inscriptions": [
    {
      "id": "abc123...",
      "inscription_number": 1000
    }
  ]
}
```

### POST `/api/wallet/sweep`

Criar sweep transaction.

**Body:**
```json
{
  "fromAddress": "bc1q...",
  "toAddress": "bc1q...",
  "amount": 1000000,
  "feeRate": 10,
  "utxoCount": 5,
  "psbt": "cHNidP8..."
}
```

### GET `/api/wallet/sweeps/:address`

Buscar sweeps de um endereço.

---

## 🔐 PSBT

### POST `/api/psbt/create`

Criar PSBT.

**Body:**
```json
{
  "inputs": [
    {
      "txid": "abc...",
      "vout": 0
    }
  ],
  "outputs": [
    {
      "bc1q...": 0.001
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "psbt": "cHNidP8...",
  "message": "PSBT created successfully"
}
```

### POST `/api/psbt/decode`

Decodificar PSBT.

**Body:**
```json
{
  "psbt": "cHNidP8..."
}
```

**Response:**
```json
{
  "success": true,
  "decoded": {
    "inputs": [...],
    "outputs": [...],
    "fee": 1000
  }
}
```

### POST `/api/psbt/analyze`

Analisar PSBT.

**Body:**
```json
{
  "psbt": "cHNidP8..."
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "complete": false,
    "next": "signer",
    "fee": 1000
  }
}
```

### POST `/api/psbt/broadcast`

Fazer broadcast de PSBT assinado.

**Body:**
```json
{
  "psbt": "cHNidP8..."
}
```

**Response:**
```json
{
  "success": true,
  "txid": "abc123...",
  "message": "Transaction broadcasted successfully"
}
```

### GET `/api/psbt/fees`

Obter taxas recomendadas.

**Response:**
```json
{
  "success": true,
  "fees": {
    "fast": 20,
    "medium": 10,
    "slow": 1
  }
}
```

### GET `/api/psbt/transaction/:txid`

Obter status de uma transação.

**Response:**
```json
{
  "success": true,
  "txid": "abc123...",
  "confirmed": true,
  "confirmations": 6,
  "blockHeight": 867234,
  "blockTime": 1696867200
}
```

---

## 🔒 Códigos de Status

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## 🔑 Autenticação

Atualmente a API é pública. Para produção, considere implementar:
- API Keys
- JWT tokens
- Rate limiting
- OAuth 2.0

---

## 📊 Rate Limiting

Configurável via `.env`:
```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🧪 Exemplos de Uso

### JavaScript / Fetch

```javascript
// Buscar fees
const fees = await fetch('http://localhost:3000/api/psbt/fees')
  .then(r => r.json());

// Criar oferta
const offer = await fetch('http://localhost:3000/api/offers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'rune_swap',
    fromRune: 'BITCOIN•RUNE',
    toRune: 'OTHER•RUNE',
    fromAmount: 1000000,
    toAmount: 1500000,
    feeRate: 10,
    psbt: 'cHNidP8...',
    creatorAddress: 'bc1q...'
  })
}).then(r => r.json());
```

### cURL

```bash
# Status
curl http://localhost:3000/api/status | jq

# Fees
curl http://localhost:3000/api/psbt/fees | jq

# Balance
curl http://localhost:3000/api/wallet/balance/bc1q... | jq

# Runes
curl http://localhost:3000/api/runes | jq
```

---

**📘 Para mais detalhes, consulte NODE_SETUP.md**








