import quicknode from './utils/quicknode.js';

(async () => {
    try {
        console.log('🔍 Buscando IDs de TODAS as runes conhecidas...\n');
        
        // Listar todas as runes
        const allRunes = await quicknode.call('ord_getRunes', []);
        
        console.log(`Total de runes: ${allRunes.ids?.length || 0}`);
        console.log('');
        
        // Buscar detalhes das primeiras 20 (para ver formato)
        const runesToCheck = ['840000:3', '840000:4']; // DOG e BILLION
        
        const runeMap = {};
        
        for (const runeId of runesToCheck) {
            try {
                const details = await quicknode.getRune(runeId);
                
                console.log(`\n🪙 ${details.entry.spaced_rune}:`);
                console.log(`   ID: ${runeId}`);
                console.log(`   Symbol: ${details.entry.symbol}`);
                console.log(`   Divisibility: ${details.entry.divisibility}`);
                console.log(`   Parent: ${details.parent || 'None'}`);
                
                runeMap[details.entry.spaced_rune] = {
                    id: runeId,
                    symbol: details.entry.symbol,
                    divisibility: details.entry.divisibility,
                    parent: details.parent
                };
                
            } catch (e) {
                console.log(`   ❌ Error: ${e.message}`);
            }
        }
        
        console.log('\n📋 MAPA DE RUNES:');
        console.log(JSON.stringify(runeMap, null, 2));
        
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
