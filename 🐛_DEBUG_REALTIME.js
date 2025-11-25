// ========================================
// 🐛 DEBUG SCRIPT - MONITORA MYWALLET EM TEMPO REAL
// ========================================
// Cole este código no CONSOLE do POPUP da MyWallet
// (Clique direito no popup → Inspect → Console)
// ========================================

console.log('🚀 DEBUG SCRIPT ATIVADO!');
console.log('');
console.log('📊 Este script vai monitorar:');
console.log('  1. Quando loadOrdinals() é chamado');
console.log('  2. Quando containers são adicionados/removidos');
console.log('  3. Mudanças no DOM em tempo real');
console.log('');

// ========================================
// 1. MONITORAR CHAMADAS DE loadOrdinals
// ========================================
const originalLoadOrdinals = window.loadOrdinals;
let loadOrdinalsCallCount = 0;

window.loadOrdinals = async function(...args) {
    loadOrdinalsCallCount++;
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🔔 loadOrdinals() CHAMADO! (Call #${loadOrdinalsCallCount})`);
    console.log('   Address:', args[0]);
    console.trace('   Call stack:');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    
    try {
        const result = await originalLoadOrdinals.apply(this, args);
        console.log(`✅ loadOrdinals() FINISHED (Call #${loadOrdinalsCallCount})`);
        return result;
    } catch (error) {
        console.error(`❌ loadOrdinals() ERROR (Call #${loadOrdinalsCallCount}):`, error);
        throw error;
    }
};

// ========================================
// 2. MONITORAR MUDANÇAS NO CONTAINER
// ========================================
const container = document.getElementById('ordinals-list');

if (container) {
    console.log('✅ Container found! Setting up MutationObserver...');
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                console.log('');
                console.log('🔄 CONTAINER CHANGED!');
                console.log('   Added nodes:', mutation.addedNodes.length);
                console.log('   Removed nodes:', mutation.removedNodes.length);
                console.log('   Current children count:', container.children.length);
                
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            console.log('   ➕ Added:', node.className, node.textContent?.substring(0, 50));
                        }
                    });
                }
                
                if (mutation.removedNodes.length > 0) {
                    console.warn('   ⚠️  NODES REMOVED!');
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            console.warn('   ➖ Removed:', node.className, node.textContent?.substring(0, 50));
                        }
                    });
                    console.trace('   Removal call stack:');
                }
                
                console.log('');
            }
        });
    });
    
    observer.observe(container, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ MutationObserver active!');
    
} else {
    console.error('❌ Container NOT found!');
}

// ========================================
// 3. MONITORAR innerHTML CHANGES
// ========================================
if (container) {
    let originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    
    Object.defineProperty(container, 'innerHTML', {
        get: function() {
            return originalInnerHTML.get.call(this);
        },
        set: function(value) {
            console.log('');
            console.log('⚠️  ⚠️  ⚠️  CONTAINER.innerHTML CHANGED! ⚠️  ⚠️  ⚠️');
            console.log('   New value:', value.substring(0, 100));
            console.trace('   Call stack:');
            console.log('');
            return originalInnerHTML.set.call(this, value);
        }
    });
    
    console.log('✅ innerHTML monitor active!');
}

// ========================================
// 4. SNAPSHOT DO ESTADO ATUAL
// ========================================
setInterval(() => {
    const currentChildren = container?.children.length || 0;
    if (currentChildren > 0) {
        console.log(`📊 Snapshot: ${currentChildren} children in container`);
    }
}, 5000); // A cada 5 segundos

console.log('');
console.log('✅ DEBUG SCRIPT PRONTO!');
console.log('   Agora abra a aba Ordinals e observe os logs...');
console.log('');


