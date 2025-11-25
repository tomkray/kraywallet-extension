# 🎨 Como Instalar MyWallet Extension - Guia Visual

## 🚀 Instalação em 5 Passos Simples:

---

### Passo 1: Abrir Chrome Extensions

Digite na barra de endereços:
```
chrome://extensions/
```

Ou:
- Menu (⋮) → Mais ferramentas → Extensões

---

### Passo 2: Ativar Modo Desenvolvedor

No canto superior direito, você verá:
```
[ ] Modo do desenvolvedor
```

Clique para ativar:
```
[✓] Modo do desenvolvedor
```

---

### Passo 3: Carregar Extensão

Três novos botões aparecerão. Clique em:
```
📦 Carregar sem compactação
```

---

### Passo 4: Selecionar Pasta

Navegue até:
```
/Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension
```

Clique em **"Selecionar"**

---

### Passo 5: Confirmar Instalação

Você verá a extensão instalada:

```
┌─────────────────────────────────────────┐
│  🔥                                      │
│  MyWallet - Bitcoin Ordinals & Runes    │
│  ID: abc123...                           │
│  Versão: 1.0.0                          │
│  [🔄] [🗑️] [ℹ️]                         │
└─────────────────────────────────────────┘
```

✅ **PRONTO!** Extensão instalada!

---

## 🎯 Usar a Extensão:

### 1. Clicar no Ícone

No canto superior direito do Chrome, clique no ícone da extensão:
```
🔥 MW
```

Se não aparecer:
- Clique no ícone de puzzle (🧩)
- Fixe a MyWallet clicando no pin (📌)

---

### 2. Popup Abrirá

Você verá a tela de boas-vindas:

```
┌─────────────────────────────────────┐
│  🔥 MyWallet         [Mainnet]      │
├─────────────────────────────────────┤
│                                      │
│    Welcome to MyWallet               │
│    Bitcoin wallet com suporte a      │
│    SIGHASH customizado               │
│                                      │
│    ✅ Taproot (Ordinals)             │
│    ✅ SIGHASH customizado            │
│    ✅ Atomic Swaps                   │
│                                      │
│  [ Create New Wallet ]               │
│  [ Restore Wallet    ]               │
│                                      │
└─────────────────────────────────────┘
```

---

### 3. Criar Wallet

Clique "Create New Wallet":

```
┌─────────────────────────────────────┐
│  Create New Wallet                   │
├─────────────────────────────────────┤
│                                      │
│  Choose mnemonic length:             │
│  [12 words ▼]                        │
│                                      │
│  Create a password:                  │
│  [••••••••]                          │
│                                      │
│  Confirm Password:                   │
│  [••••••••]                          │
│                                      │
│  [ Generate Wallet ]                 │
│  [ Back ]                            │
│                                      │
└─────────────────────────────────────┘
```

Após gerar, você verá o **mnemonic**:

```
┌─────────────────────────────────────┐
│  ⚠️ Save Your Mnemonic              │
├─────────────────────────────────────┤
│                                      │
│  ⚠️ IMPORTANT: Write down these     │
│     words and keep them safe!        │
│                                      │
│  ┌─────────────────────────────┐    │
│  │ word1 word2 word3 word4     │    │
│  │ word5 word6 word7 word8     │    │
│  │ word9 word10 word11 word12  │    │
│  └─────────────────────────────┘    │
│                                      │
│  [✓] I have saved my mnemonic       │
│                                      │
│  [ Continue ]                        │
│                                      │
└─────────────────────────────────────┘
```

---

### 4. Wallet Principal

Após salvar, você verá:

```
┌─────────────────────────────────────┐
│  🔥 MyWallet         [Mainnet] ⚙️   │
├─────────────────────────────────────┤
│                                      │
│  bc1px9geu9q...kdh3us 📋            │
│                                      │
│        Total Balance                 │
│         0 sats                       │
│      0.00000000 BTC                  │
│                                      │
│  [ Send ]      [ Receive ]           │
│                                      │
│  [ Assets ] [ Activity ]             │
│                                      │
│  No assets yet                       │
│                                      │
└─────────────────────────────────────┘
```

---

## 🧪 Testar window.myWallet:

### 1. Abrir Marketplace

```
http://localhost:3000
```

### 2. Abrir Console

```
F12 (ou Cmd+Option+I no Mac)
```

### 3. Verificar API

```javascript
// Deve mostrar objeto com métodos
console.log(window.myWallet);

// Output esperado:
{
  connect: ƒ connect()
  requestAccounts: ƒ requestAccounts()
  getAccounts: ƒ getAccounts()
  getPublicKey: ƒ getPublicKey()
  getBalance: ƒ getBalance()
  signPsbt: ƒ signPsbt(psbt, options)  // ⭐
  pushTx: ƒ pushTx(txHex)
  pushPsbt: ƒ pushPsbt(psbt)
  sendBitcoin: ƒ sendBitcoin(...)
  ...
}
```

### 4. Testar Conexão

```javascript
const accounts = await window.myWallet.connect();
console.log('✅ Connected:', accounts);
```

### 5. Testar SIGHASH

```javascript
// Criar PSBT fake para teste
const testPsbt = 'cHNidP8BAHECAAAAASaBcTc...';

// Assinar com SIGHASH customizado
const signed = await window.myWallet.signPsbt(testPsbt, {
    sighashType: 'SINGLE|ANYONECANPAY'
});

console.log('✅ SIGHASH customizado funciona!');
```

---

## 🔧 Debug:

### Ver Logs da Extensão:

**Popup:**
- Clique direito no popup
- "Inspecionar"
- Console mostra logs do popup

**Background:**
- Vá para `chrome://extensions/`
- Encontre MyWallet
- Clique "service worker" (em azul)
- Console mostra logs do background

**Content Script:**
- Console da página (`F12`)
- Mostra logs do content script
- Deve ver: "🔥 MyWallet API injected!"

---

## 🐛 Troubleshooting:

### Problema: Extensão não instala

**Solução:**
1. Verificar pasta existe:
   ```bash
   ls /Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension/
   ```
2. Verificar manifest.json existe
3. Tentar recarregar

---

### Problema: window.myWallet undefined

**Solução:**
1. Recarregar página (`Cmd+R`)
2. Verificar extensão ativa
3. Ver console: "MyWallet API injected!"
4. Se não aparecer, recarregar extensão

---

### Problema: Popup não abre

**Solução:**
1. Clicar no ícone novamente
2. Se erro, ver console do background
3. Recarregar extensão

---

### Problema: Erro ao criar wallet

**Nota:**
- Versão atual usa dados simulados
- Para produção, integrar MyWallet real
- Por enquanto, serve para testar UI

---

## ✅ Checklist de Instalação:

```
[ ] Chrome aberto em chrome://extensions/
[ ] Modo desenvolvedor ativado
[ ] Extensão carregada
[ ] Ícone aparece na barra
[ ] Popup abre corretamente
[ ] Wallet criada
[ ] Mnemonic salvo
[ ] window.myWallet disponível no marketplace
[ ] Console mostra "MyWallet API injected!"
[ ] Teste de conexão funcionou
```

---

## 🎉 Sucesso!

Você agora tem:
- ✅ Extensão instalada
- ✅ Wallet criada
- ✅ window.myWallet disponível
- ✅ API compatível com Unisat
- ✅ Suporte a SIGHASH (interface)

**Próximo passo:**
Integrar com o marketplace e testar atomic swap!

---

## 📞 Ajuda:

Se tiver problemas:
1. Leia `README.md` na pasta da extensão
2. Veja `INSTALAR_EXTENSAO.md` para troubleshooting
3. Verifique logs no console

---

**🔥 Divirta-se testando!** 🚀



