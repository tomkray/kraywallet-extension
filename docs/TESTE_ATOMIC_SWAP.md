━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 TESTE COMPLETO: ATOMIC SWAP COM MYWALLET

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SISTEMA PRONTO!

- ✅ Banco de dados limpo (0 offers)
- ✅ Servidor rodando (http://localhost:3000)
- ✅ MyWallet extension funcionando
- ✅ SIGHASH_SINGLE|ANYONECANPAY implementado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PASSO 1: PREPARAR WALLETS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você precisa de 2 wallets MyWallet:

1. WALLET A (SELLER) - com inscription
   - Tem a inscription: 0f1519057f8704...i831
   - Tem saldo suficiente para fees

2. WALLET B (BUYER) - com BTC
   - Tem BTC suficiente para:
     * Preço da inscription
     * Fee da transação
     * Change output (mínimo 546 sats)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PASSO 2: CRIAR OFERTA (SELLER)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Abrir marketplace: http://localhost:3000

2. Click "Connect Wallet" → Selecionar "MyWallet"

3. Conectar WALLET A (Seller)

4. Ir para "Your Ordinals" (sidebar)

5. Preencher formulário:
   ┌─────────────────────────────────────────────────┐
   │ Inscription ID:                                 │
   │ 0f1519057f8704cb94ab2680523d82461849958622775d758e75d1976e339948i831 │
   │                                                 │
   │ Amount (sats): 50000                            │
   │ Fee Rate: 1                                     │
   │ ☑ Auto Submit to Marketplace                   │
   └─────────────────────────────────────────────────┘

6. Click "List for Sale"

7. Popup MyWallet vai abrir automaticamente!

8. Verificar detalhes no popup:
   - Input 0: Inscription UTXO (você assina)
   - Output 0: Payment (50000 sats para você)
   - SIGHASH: SINGLE|ANYONECANPAY

9. Digitar password

10. Click "Sign & Send"

11. ✅ Verificar console do marketplace:
    ```
    🔏 Signing with MyWallet (SIGHASH_SINGLE|ANYONECANPAY)...
    ✅ PSBT signed with MyWallet (SIGHASH_SINGLE|ANYONECANPAY)
    ✅ Offer created successfully!
    ```

12. ✅ Oferta deve aparecer em "Browse Ordinals"!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PASSO 3: COMPRAR INSCRIPTION (BUYER)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Desconectar WALLET A (Click no endereço → Disconnect)

2. Click "Connect Wallet" → Selecionar "MyWallet"

3. Conectar WALLET B (Buyer)

4. Ir para "Browse Ordinals"

5. Ver oferta disponível:
   ┌─────────────────────────────────────────────────┐
   │ [Imagem da inscription]                         │
   │                                                 │
   │ Inscription #78630547                           │
   │ Price: 50000 sats                               │
   │ Seller: bc1p... (WALLET A)                     │
   │                                                 │
   │ [Buy Now]                                       │
   └─────────────────────────────────────────────────┘

6. Click "Buy Now"

7. Selecionar fee rate:
   - Fast: 5 sat/vB
   - Normal: 3 sat/vB
   - Slow: 1 sat/vB
   - Custom: [valor]

8. Click "Confirm Purchase"

9. Popup MyWallet vai abrir automaticamente!

10. Verificar detalhes no popup:
    ┌─────────────────────────────────────────────────┐
    │ 📥 Inputs (2+)                                  │
    │ Input #0: Inscription (Seller, assinado) ✅     │
    │ Input #1+: Payment UTXOs (Você assina) ✍️       │
    │                                                 │
    │ 📤 Outputs (3)                                  │
    │ Output #0: Payment → Seller (50000 sats)       │
    │ Output #1: Inscription → Você                   │
    │ Output #2: Change → Você                        │
    │                                                 │
    │ Network Fee: [calculado] sats                   │
    └─────────────────────────────────────────────────┘

11. Digitar password

12. Click "Sign & Send"

13. ✅ Verificar console do marketplace:
    ```
    🔨 Building atomic PSBT with buyer inputs...
    ✅ Atomic PSBT created
    🔏 Signing with MyWallet...
    ✅ PSBT signed
    🔨 Finalizing PSBT...
    ✅ PSBT finalized
    📡 Broadcasting transaction...
    ✅ Transaction broadcasted! txid: [txid]
    ```

14. ✅ Verificar no popup MyWallet (WALLET B):
    - Tab "Activity": Transação pendente
    - Tab "Ordinals": Inscription aparece após confirmação

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PASSO 4: VERIFICAR CONFIRMAÇÃO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copiar txid da transação

2. Abrir mempool.space:
   https://mempool.space/tx/[txid]

3. Verificar:
   - ✅ Inputs: Inscription (seller) + Payment UTXOs (buyer)
   - ✅ Outputs: Payment (seller) + Inscription (buyer) + Change (buyer)
   - ✅ Fee rate correto
   - ✅ Status: Pendente → Confirmado

4. Aguardar 1+ confirmação

5. Verificar nas wallets:
   - WALLET A (Seller):
     * Tab "Activity": Received 50000 sats
     * Tab "Ordinals": Inscription sumiu (vendida)
   
   - WALLET B (Buyer):
     * Tab "Activity": Sent [total] sats
     * Tab "Ordinals": Inscription aparece! ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  TROUBLESHOOTING

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEMA: Popup não abre ao criar oferta
SOLUÇÃO:
- Verificar se MyWallet está conectada (não Unisat!)
- Recarregar extensão: chrome://extensions/
- Ver logs do background: chrome://extensions/ → MyWallet → Service Worker

PROBLEMA: "Failed to sign PSBT"
SOLUÇÃO:
- Verificar password está correto
- Ver console do popup (Right-click → Inspect)
- Verificar servidor rodando: http://localhost:3000

PROBLEMA: "Insufficient balance"
SOLUÇÃO:
- Verificar balance da WALLET B (Buyer)
- Precisa ter: price + fee + change (mínimo 546 sats)
- Exemplo: 50000 + 1000 + 546 = 51546 sats mínimo

PROBLEMA: "Broadcast failed"
SOLUÇÃO:
- Ver logs do servidor (server.log)
- Verificar Bitcoin Core está rodando
- Verificar UTXO não foi gasto

PROBLEMA: Inscription não aparece após compra
SOLUÇÃO:
- Aguardar 1+ confirmação
- Reabrir popup MyWallet
- Verificar se transação foi confirmada no mempool.space

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎊 SUCESSO!

Se todos os passos funcionarem, você acabou de fazer um ATOMIC SWAP REAL
usando MyWallet com SIGHASH_SINGLE|ANYONECANPAY!

Parabéns! 🚀🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

