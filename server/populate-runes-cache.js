import quicknode from './utils/quicknode.js';

const address = 'bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag';
const outpoint = '1fb2eff3ba07d6addf0b484e5b8371ed6ee323f44c66cd66045210b758d75c46:1';

(async () => {
    try {
        console.log('🪙 Buscando runes via QuickNode...\n');
        
        // Verificar output específico que sabemos que tem rune
        console.log('📡 Checking known UTXO with rune:', outpoint);
        const outputData = await quicknode.getOutput(outpoint);
        
        console.log('Output data:');
        console.log(JSON.stringify(outputData, null, 2));
        
        if (outputData.runes && Object.keys(outputData.runes).length > 0) {
            console.log('\n✅ FOUND RUNES!');
            
            for (const [runeName, runeInfo] of Object.entries(outputData.runes)) {
                console.log(`\n🪙 ${runeName}:`);
                console.log('   Amount:', runeInfo.amount);
                console.log('   Divisibility:', runeInfo.divisibility);
                console.log('   Symbol:', runeInfo.symbol);
                console.log('   Display:', runeInfo.amount / Math.pow(10, runeInfo.divisibility));
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
