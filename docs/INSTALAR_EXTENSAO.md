# 🚀 Como Instalar a MyWallet Extension

## ⚡ Guia Rápido (5 minutos)

### 1️⃣  Instalar no Chrome:

1. Abra Chrome
2. Digite na barra de endereço: `chrome://extensions/`
3. Ative o **"Modo do desenvolvedor"** (toggle no canto superior direito)
4. Clique em **"Carregar sem compactação"**
5. Navegue até: `/Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension`
6. Clique em "Selecionar"
7. ✅ **Extensão instalada!**

### 2️⃣  Verificar Instalação:

Você verá:
- Ícone da extensão na barra do Chrome (🔥 MW)
- Status: "MyWallet - Bitcoin Ordinals & Runes"
- Versão: 1.0.0

### 3️⃣  Criar Wallet:

1. Clique no ícone da extensão
2. Clique "Create New Wallet"
3. Escolha 12 ou 24 palavras
4. Crie uma senha
5. **COPIE E GUARDE SEU MNEMONIC!**
6. Marque a checkbox "I have saved..."
7. Clique "Continue"
8. ✅ **Wallet criada!**

---

## 🧪 Testar no Marketplace:

### 1️⃣  Abrir Console:

```
F12 (ou Cmd+Option+I no Mac)
```

### 2️⃣  Verificar window.myWallet:

Cole no console:
```javascript
console.log(window.myWallet);
```

Você deve ver:
```
{
  connect: ƒ connect()
  signPsbt: ƒ signPsbt(psbt, options)
  getAccounts: ƒ getAccounts()
  ...
}
```

### 3️⃣  Testar Conexão:

```javascript
const accounts = await window.myWallet.connect();
console.log('Connected:', accounts);
```

### 4️⃣  Testar signPsbt com SIGHASH:

```javascript
// Criar um PSBT de teste (simulado)
const testPsbt = 'cHNidP8BAHECAAAAASaBcTc...';

// Assinar com SIGHASH customizado
const signed = await window.myWallet.signPsbt(testPsbt, {
    sighashType: 'SINGLE|ANYONECANPAY' // ⭐ FUNCIONA!
});

console.log('✅ Signed with SIGHASH_SINGLE|ANYONECANPAY');
```

---

## 🔄 Atualizar Marketplace:

### No `index.html`, adicione:

```html
<!-- Antes do </body> -->
<script>
// Detectar MyWallet
window.addEventListener('myWalletReady', () => {
    console.log('🔥 MyWallet detected!');
});

// Fallback para Unisat se MyWallet não estiver disponível
if (!window.myWallet && window.unisat) {
    console.log('⚠️  Using Unisat fallback');
}
</script>
```

### No `app.js`, substitua Unisat:

```javascript
// Função helper para detectar wallet
function getWallet() {
    if (window.myWallet) {
        console.log('🔥 Using MyWallet');
        return window.myWallet;
    } else if (window.unisat) {
        console.log('⚠️  Fallback to Unisat');
        return window.unisat;
    } else {
        throw new Error('No wallet found');
    }
}

// Usar no código
const wallet = getWallet();
const accounts = await wallet.connect();
const signedPsbt = await wallet.signPsbt(psbt, {
    sighashType: 'SINGLE|ANYONECANPAY' // ⭐ MyWallet suporta!
});
```

---

## 🐛 Troubleshooting:

### Extensão não aparece:
```bash
# Verificar se a pasta está correta
ls -la /Users/tomkray/Desktop/PSBT-Ordinals/mywallet-extension/

# Deve ter:
# - manifest.json
# - popup/
# - background/
# - content/
# - assets/
```

### window.myWallet undefined:
1. Recarregue a página (`Cmd+R` ou `F5`)
2. Verifique se a extensão está ativa em `chrome://extensions/`
3. Veja console: deve aparecer "🔥 MyWallet API injected!"

### Erro ao criar wallet:
- Por enquanto, a lógica é simulada (dados fake)
- Para produção, precisa integrar código da `/mywallet/`

### Erro ao assinar:
- Versão atual usa dados simulados
- Integre a MyWallet real para assinar de verdade

---

## 🎯 Próximos Passos:

### ⏳ AGORA (versão dev):
- ✅ Extensão instalada
- ✅ window.myWallet disponível
- ✅ API compatível com Unisat
- ⚠️  Dados simulados (para teste de UI)

### 🔧 DEPOIS (integrar lógica real):
1. Copiar código de `/mywallet/` para background
2. Usar bundler (webpack) para compilar
3. Implementar PSBT signing real
4. Integrar com mempool.space API
5. Testar atomic swap completo

### 🚀 FUTURO:
1. Publicar na Chrome Web Store
2. Adicionar Ordinals/Runes
3. Mobile app
4. Hardware wallet support

---

## 📊 Status Atual:

| Componente | Status | Notas |
|------------|--------|-------|
| Extensão | ✅ Pronta | Instalável no Chrome |
| UI | ✅ Completa | Popup bonito como Unisat |
| window.myWallet | ✅ Funcional | API compatível |
| SIGHASH support | ✅ Interface | Dados simulados |
| Lógica real | ⏳ Pendente | Integrar `/mywallet/` |

---

## 🎉 SUCESSO!

Você agora tem:
- ✅ Extensão de browser instalada
- ✅ window.myWallet disponível
- ✅ Interface bonita como Unisat/Xverse
- ✅ API compatível com marketplace

**Próximo passo**: Testar no marketplace! 🚀

---

## 📞 Debug:

### Ver logs da extensão:

1. **Popup**: Clique direito no popup → "Inspecionar"
2. **Background**: `chrome://extensions/` → Clique "service worker"
3. **Content Script**: Console da página (`F12`)

### Reload extensão após mudanças:

1. Vá para `chrome://extensions/`
2. Clique no ícone de reload (🔄) da MyWallet
3. Recarregue a página de teste

---

**🔥 Pronto para testar!** 🎉



