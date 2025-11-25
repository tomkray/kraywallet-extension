# 🎯 ATOMIC SWAP com SIGHASH_SINGLE | ANYONECANPAY

## ✅ IMPLEMENTADO!

O marketplace agora suporta **atomic swaps verdadeiros** usando `SIGHASH_SINGLE | ANYONECANPAY`.

---

## 🔑 Como Funciona:

1. **Vendedor** assina PSBT com chave privada → Backend usa SIGHASH_SINGLE|ANYONECANPAY
2. **Comprador** adiciona inputs/outputs sem invalidar assinatura do vendedor
3. **Broadcast** instantâneo após ambos assinarem

---

## 🧪 TESTAR AGORA:

### 1. Resetar banco:
```bash
curl -X DELETE http://localhost:3000/api/offers
```

### 2. Vendedor: Criar Listing
- Abrir `http://localhost:3000`
- Conectar wallet Unisat
- Criar oferta
- **Quando pedir, colar sua PRIVATE KEY (WIF format)**
  - ⚠️ APENAS PARA TESTE! Nunca use em produção!

### 3. Comprador: Comprar
- Conectar outra wallet
- Clicar "Buy Now"
- Assinar com Unisat

### 4. Verificar:
- Ver TXID no console
- Abrir no mempool.space

---

## 📚 Documentos:

- **`SOLUCAO_FINAL_SIGHASH.md`**: Explicação técnica completa
- **`TESTE_SIGHASH_COMPLETO.md`**: Guia de teste passo-a-passo
- **`NOVA_ARQUITETURA.md`**: Como marketplaces reais funcionam

---

## ⚠️ Segurança:

**AGORA (Teste):**
- Vendedor fornece private key no frontend
- Backend assina com JavaScript

**PRODUÇÃO (Depois):**
- Usar Bitcoin Core wallet
- Private keys ficam no servidor
- Assinar via `walletprocesspsbt` RPC

---

## 🎉 Pronto para testar!

Servidor está rodando em `http://localhost:3000` 🚀

Qualquer problema, verifique os documentos acima.
