# 🐛 BUG FIX - Botões Send/Receive Sobrepondo Modal

## 🔍 PROBLEMA IDENTIFICADO

### **Descrição**
Ao clicar em uma rune na tab "Runes", os botões "Send" e "Receive" do Bitcoin tab apareciam **enormes e desconexos** na frente da modal de detalhes da rune.

### **Causa Raiz**
No arquivo `mywallet-extension/popup/popup.css`, três classes tinham `z-index: 9999 !important`:

1. **`.action-btn`** (linha 563) - Botões Send/Receive do Bitcoin
2. **`.btn-icon-only`** (linha 274) - Botões de ícone
3. **`.btn-icon-copy`** (linha 289) - Botões de copiar

Isso fazia com que esses elementos aparecessem **acima de qualquer modal** (que tem `z-index: 1000`).

---

## ✅ SOLUÇÃO IMPLEMENTADA

### **Arquivos Modificados**
- `mywallet-extension/popup/popup.css`

### **Mudanças Realizadas**

#### 1. `.action-btn` (Bitcoin Send/Receive)
**ANTES** (linha 551-566):
```css
.action-btn {
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 14px;
    font-weight: 600;
    position: relative;
    z-index: 9999 !important;      /* ❌ PROBLEMA */
    cursor: pointer !important;
    pointer-events: auto !important;
    color: var(--color-text-primary);
    transition: all var(--transition-base);
}
```

**DEPOIS**:
```css
.action-btn {
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 14px;
    font-weight: 600;
    position: relative;
    cursor: pointer;              /* ✅ CORRIGIDO */
    color: var(--color-text-primary);
    transition: all var(--transition-base);
}
```

#### 2. `.btn-icon-only`
**ANTES** (linha 262-277):
```css
.btn-icon-only {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-base);
    position: relative;
    z-index: 9999 !important;      /* ❌ PROBLEMA */
    cursor: pointer !important;
    pointer-events: auto !important;
}
```

**DEPOIS**:
```css
.btn-icon-only {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-base);
    position: relative;
    cursor: pointer;              /* ✅ CORRIGIDO */
}
```

#### 3. `.btn-icon-copy`
**ANTES** (linha 282-294):
```css
.btn-icon-copy {
    padding: var(--spacing-sm);
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 16px;
    transition: all var(--transition-fast);
    position: relative;
    z-index: 9999 !important;      /* ❌ PROBLEMA */
    cursor: pointer !important;
    pointer-events: auto !important;
}
```

**DEPOIS**:
```css
.btn-icon-copy {
    padding: var(--spacing-sm);
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 16px;
    transition: all var(--transition-fast);
    position: relative;
    cursor: pointer;              /* ✅ CORRIGIDO */
}
```

---

## 🎯 HIERARQUIA DE Z-INDEX CORRETA

Agora a hierarquia de camadas está correta:

```
Layer 1 (z-index: auto/1)
├── Elementos normais
├── Botões (.action-btn, .btn-icon-only, etc)
└── Conteúdo principal

Layer 2 (z-index: 1000)
├── Modals de detalhes (.rune-details-screen)
└── Telas de envio/recebimento

Layer 3 (z-index: 9999)
└── Overlays de modal (.modal-overlay)
```

---

## 🧪 COMO TESTAR

### 1. **Recarregar Extension**
```
chrome://extensions/ → MyWallet → 🔄 Reload
```

### 2. **Testar Fluxo Normal**
1. Abrir MyWallet
2. Tab "Bitcoin" → Os botões Send/Receive devem funcionar normalmente
3. Tab "Runes" → Clicar em uma rune
4. ✅ Modal abre sem botões sobrepostos
5. Clicar em "Send" na modal
6. ✅ Tela de envio abre corretamente

### 3. **Verificar Ausência do Bug**
- ❌ NÃO deve haver botões grandes do Bitcoin aparecendo na modal
- ✅ Apenas os botões da modal devem estar visíveis
- ✅ Z-index respeitando a hierarquia correta

---

## 📊 IMPACTO

### **Antes**
- ❌ Botões Send/Receive do Bitcoin apareciam sobre a modal de runes
- ❌ UX confusa e quebrada
- ❌ Impossível usar a modal corretamente

### **Depois**
- ✅ Modais funcionam perfeitamente
- ✅ Botões aparecem apenas onde devem
- ✅ Hierarquia visual correta
- ✅ UX profissional e fluida

---

## 🔒 PREVENÇÃO FUTURA

### **Regras de Z-Index**
1. **Elementos normais**: `z-index: auto` ou `z-index: 1`
2. **Modals e popups**: `z-index: 1000` - `z-index: 5000`
3. **Overlays e toasts**: `z-index: 9000+`

### **Evitar**
- ❌ Nunca usar `!important` em z-index sem necessidade absoluta
- ❌ Nunca dar z-index alto para elementos não-modais
- ❌ Sempre considerar a hierarquia visual

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [x] Bug identificado
- [x] Causa raiz encontrada
- [x] Solução implementada
- [x] CSS corrigido (3 classes)
- [x] Linter errors: 0
- [x] Hierarquia de z-index estabelecida
- [x] Documentação criada
- [x] Guia de teste criado

---

## 📝 NOTAS TÉCNICAS

### **Por que `z-index: 9999` era um problema?**

O `z-index` controla a ordem de empilhamento dos elementos na página. Um valor muito alto (`9999`) faz com que o elemento apareça **acima de tudo**, inclusive modais que precisam estar no topo.

### **Por que `!important` é problemático?**

O `!important` força o CSS a aplicar uma regra independentemente da especificidade. Isso torna difícil sobrescrever o estilo quando necessário e cria problemas de manutenção.

### **Solução Ideal**

Usar valores de z-index **moderados** e **organizados em camadas lógicas**, sem `!important`, permitindo flexibilidade e manutenção fácil.

---

**Status**: ✅ **BUG CORRIGIDO**  
**Data**: Hoje  
**Arquivo**: `mywallet-extension/popup/popup.css`  
**Linhas modificadas**: 274, 289, 563  


