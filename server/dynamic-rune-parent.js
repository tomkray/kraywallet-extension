import quicknode from './utils/quicknode.js';

(async () => {
    try {
        console.log('🔍 Testando busca dinâmica de parent...\n');
        
        // Lista de runes para testar
        const runes = [
            { name: 'DOG•GO•TO•THE•MOON', id: '840000:3' },
            { name: 'BILLION•DOLLAR•CAT', id: '845764:84' }
        ];
        
        for (const rune of runes) {
            console.log(`\n🪙 ${rune.name}:`);
            
            const details = await quicknode.getRune(rune.id);
            
            console.log(`   Symbol: ${details.entry.symbol}`);
            console.log(`   Divisibility: ${details.entry.divisibility}`);
            console.log(`   Parent: ${details.parent || 'NONE'}`);
            
            if (details.parent) {
                console.log(`   Thumbnail: http://localhost:4000/api/rune-thumbnail/${details.parent}`);
            } else {
                console.log(`   Fallback: Use emoji ${details.entry.symbol}`);
            }
        }
        
        console.log('\n✅ Estratégia:');
        console.log('   1. Buscar rune via ord_getRune(runeId)');
        console.log('   2. Se tem parent → Usar thumbnail');
        console.log('   3. Se NÃO tem parent → Usar emoji do symbol');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
