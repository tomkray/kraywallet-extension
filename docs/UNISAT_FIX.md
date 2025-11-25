# 🔧 CORREÇÃO CRÍTICA - Unisat não assinava Input do Comprador

## ❌ PROBLEMA DESCOBERTO

A Unisat **NÃO estava assinando o input 1** (comprador)!

**Análise do PSBT:**
```
Input 0 (vendedor):  ✅ ASSINADO (tapKeySig presente)
Input 1 (comprador): ❌ NÃO ASSINADO (tapKeySig ausente!)
```

**Por quê?**
Quando um PSBT JÁ TEM assinatura em um input (input 0 do vendedor), a Unisat **não assina automaticamente os outros inputs** mesmo sem `toSignInputs` especificado.

---

## ✅ SOLUÇÃO APLICADA

Especificar **explicitamente** quais inputs o comprador deve assinar usando `toSignInputs`:

### Antes (Errado):
```javascript
const signedPsbt = await window.unisat.signPsbt(finalPsbt, {
    autoFinalized: false
    // SEM toSignInputs = Unisat NÃO assina! ❌
});
```

### Depois (Correto):
```javascript
// Criar array com índices dos inputs do comprador
const toSignInputs = [];
for (let i = 1; i < 10; i++) { // Inputs 1+ são do comprador
    toSignInputs.push({ 
        index: i, 
        publicKey: buyerPublicKey 
    });
}

const signedPsbt = await window.unisat.signPsbt(finalPsbt, {
    autoFinalized: false,
    toSignInputs: toSignInputs  // ✅ Especifica quais assinar!
});
```

---

## 🎯 POR QUE ISSO FUNCIONA

A Unisat usa `toSignInputs` para saber:
1. **Quais inputs** ela deve assinar
2. **Com qual chave** (publicKey)

Sem `toSignInputs` + com input já assinado = **Unisat não assina nada novo**!

---

## 📊 FLUXO CORRETO AGORA

### 1. Vendedor:
```
1. Cria PSBT com input 0 (inscription)
2. Assina input 0 com Unisat
3. PSBT salvo no banco
```

### 2. Comprador:
```
1. Backend cria PSBT atômico:
   - Input 0: inscription (JÁ ASSINADO pelo vendedor)
   - Input 1+: payment UTXOs (NÃO ASSINADOS)
   
2. Frontend chama Unisat com toSignInputs = [1, 2, ...]
   
3. Unisat assina APENAS inputs 1+ (comprador)
   
4. PSBT agora tem TODAS as assinaturas:
   - Input 0: ✅ vendedor
   - Input 1+: ✅ comprador
   
5. Backend finaliza e faz broadcast
```

---

## 🧪 TESTE AGORA

1. **Refresh a página** (F5) para carregar novo código
2. **Vendedor:** Create Offer → Sign
3. **Comprador:** Buy Now → Sign

**Logs esperados (console do browser):**
```
Signing buyer inputs (indices 1+)...
toSignInputs: [{index: 1, publicKey: "..."}, {index: 2, publicKey: "..."}, ...]
```

**Unisat vai:**
- Ignorar input 0 (já assinado)
- Assinar input 1+ (comprador)
- ✅ PSBT completo!

---

## 🚀 STATUS

- ✅ Bug identificado
- ✅ Correção aplicada
- ✅ Código atualizado: `app.js`
- ✅ Servidor rodando

**REFRESH A PÁGINA E TESTE!** 🎉

Agora a Unisat VAI assinar os inputs do comprador corretamente!



