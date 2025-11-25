/**
 * 🧪 COPIE E COLE ESTE CÓDIGO NO CONSOLE DO BROWSER
 * Para testar se a lógica do Activity Tab está funcionando
 */

console.log('🧪 ========== TESTE DO ACTIVITY TAB ==========');
console.log('');

// 1. Verificar se a extensão está carregada
console.log('1️⃣ Verificando MyWallet...');
if (window.myWallet) {
    console.log('   ✅ MyWallet API disponível!');
} else {
    console.error('   ❌ MyWallet NÃO encontrada! Recarregue a extensão!');
}
console.log('');

// 2. Verificar elementos DOM
console.log('2️⃣ Verificando elementos DOM...');
const activityTab = document.getElementById('activity-tab');
const activityList = document.getElementById('activity-list');

if (activityTab) {
    console.log('   ✅ Activity tab encontrada!');
    console.log('      Hidden?', activityTab.classList.contains('hidden'));
} else {
    console.error('   ❌ Activity tab NÃO encontrada!');
}

if (activityList) {
    console.log('   ✅ Activity list encontrada!');
    console.log('      Children:', activityList.children.length);
    console.log('      Inner HTML length:', activityList.innerHTML.length);
} else {
    console.error('   ❌ Activity list NÃO encontrada!');
}
console.log('');

// 3. Verificar itens de activity
console.log('3️⃣ Verificando itens de transação...');
if (activityList && activityList.children.length > 0) {
    console.log(`   ✅ Encontrados ${activityList.children.length} itens!`);
    
    for (let i = 0; i < activityList.children.length; i++) {
        const item = activityList.children[i];
        console.log(`   📋 Item ${i + 1}:`);
        console.log(`      - Classes: ${item.className}`);
        console.log(`      - Has inscription-tx? ${item.classList.contains('inscription-tx')}`);
        
        // Verificar se tem thumbnail
        const thumbnail = item.querySelector('.activity-thumbnail');
        if (thumbnail) {
            console.log(`      - ✅ HAS THUMBNAIL! (inscription)`);
            const img = thumbnail.querySelector('img');
            if (img) {
                console.log(`         Image src: ${img.src.substring(0, 50)}...`);
            }
        } else {
            console.log(`      - ❌ No thumbnail (normal bitcoin TX)`);
        }
        
        // Verificar título
        const title = item.querySelector('.activity-title');
        if (title) {
            console.log(`      - Title: "${title.textContent}"`);
        }
        
        console.log('');
    }
} else {
    console.warn('   ⚠️  Nenhum item encontrado! Talvez ainda não carregou?');
}
console.log('');

// 4. Forçar reload do Activity Tab
console.log('4️⃣ Deseja recarregar o Activity Tab agora?');
console.log('   Execute: switchTab("activity")');
console.log('');

console.log('✅ ========== FIM DO TESTE ==========');
console.log('');
console.log('📝 PRÓXIMOS PASSOS:');
console.log('   1. Se MyWallet não foi encontrada → Recarregue extensão');
console.log('   2. Se Activity list está vazia → Execute: switchTab("activity")');
console.log('   3. Se tem itens mas sem thumbnail → Verifique logs acima');
console.log('   4. Envie screenshot deste console!');



