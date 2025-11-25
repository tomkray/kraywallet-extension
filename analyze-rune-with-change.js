import axios from 'axios';

// Vou buscar transações de runes para encontrar uma com change
async function findRuneTransactionWithChange() {
    try {
        // Buscar algumas transações de runes recentes
        const response = await axios.get('https://mempool.space/api/v1/lightning/nodes/rankings');
        
        console.log('🔍 Analisando formato de transações de Runes...\n');
        
        // A transação bem-sucedida que temos como referência
        const successTx = '0990800988bde260568e6ee86de43ee23904df85d90d27335290b541c4229a28';
        
        console.log('📌 Transação de referência:', successTx);
        console.log('   Link: https://mempool.space/tx/' + successTx);
        console.log('\n');
        console.log('💡 ANÁLISE MANUAL NECESSÁRIA:');
        console.log('   1. Abra https://mempool.space/tx/' + successTx);
        console.log('   2. Conte os outputs:');
        console.log('      - Output 0: OP_RETURN (Runestone)');
        console.log('      - Output 1: ?');
        console.log('      - Output 2: ?');
        console.log('      - Output 3: ?');
        console.log('\n');
        console.log('   3. Verifique o Runestone:');
        console.log('      - Hex: 6a5d0a00c0a2330380c2d72f02');
        console.log('      - Decoded: [10, 0, 840000, 3, 100000000, 2]');
        console.log('      - 1 edict: envia 100M units para output 2');
        console.log('\n');
        console.log('🤔 PERGUNTA CRÍTICA:');
        console.log('   Se a TX tem 4 outputs mas o edict aponta para output 2,');
        console.log('   onde estão as runes restantes (se houver)?');
        console.log('\n');
        console.log('   HIPÓTESES:');
        console.log('   A) Output 1 = change de runes (implícito, não no edict)');
        console.log('   B) Output 3 = change de BTC apenas');
        console.log('   C) Protocolo mantém runes não especificadas no input original');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

findRuneTransactionWithChange();

