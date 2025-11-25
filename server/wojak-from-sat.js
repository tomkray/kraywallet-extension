import quicknode from './utils/quicknode.js';

(async () => {
    try {
        console.log('🔍 Buscando WOJAK via sat ranges...\n');
        
        const outpoint = '0f2ca43d743029abf0a4a6f94168e24c9ab5a178ffc778e091a73276da1f4a8b:2';
        const outputData = await quicknode.getOutput(outpoint);
        
        console.log('Sat ranges:', outputData.sat_ranges);
        
        // Sat range aproximado: 810935045730675
        // Block height aproximado: 810935 (primeiros 6 dígitos)
        const approxBlock = 810935;
        
        console.log(`\nBuscando em bloco ${approxBlock}...`);
        
        for (let tx = 0; tx < 200; tx += 10) {
            try {
                const testId = `${approxBlock}:${tx}`;
                const details = await quicknode.getRune(testId);
                
                if (details.entry.spaced_rune.includes('WOJAK')) {
                    console.log('\n✅ FOUND!');
                    console.log('  Name:', details.entry.spaced_rune);
                    console.log('  ID:', testId);
                    console.log('  Parent:', details.parent || 'NONE');
                    break;
                }
            } catch (e) {
                // Continuar
            }
            
            await new Promise(r => setTimeout(r, 150));
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
