import quicknode from './utils/quicknode.js';

const address = 'bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag';

(async () => {
    try {
        console.log('💰 Implementando balance via QuickNode...\n');
        
        // Usar listunspent para buscar UTXOs
        console.log('📡 Step 1: Scanning UTXOs via Bitcoin RPC...');
        
        // Criar descriptor para o endereço
        const descriptor = `addr(${address})`;
        
        try {
            const scanResult = await quicknode.call('scantxoutset', ['start', [descriptor]]);
            
            if (scanResult && scanResult.unspents) {
                let total = 0;
                for (const utxo of scanResult.unspents) {
                    total += Math.round(utxo.amount * 100000000);
                }
                
                console.log('✅ Balance via scantxoutset:');
                console.log('   UTXOs:', scanResult.unspents.length);
                console.log('   Total:', total, 'sats');
            }
        } catch (e) {
            console.log('❌ scantxoutset failed:', e.message);
            
            // Alternativa: somar UTXOs manualmente via getrawtransaction
            console.log('\n📡 Alternative: Calculate from transactions...');
            
            // Buscar transações do Mempool.space
            const txsResponse = await fetch(`https://mempool.space/api/address/${address}`);
            const txsData = await txsResponse.json();
            
            const balance = {
                confirmed: txsData.chain_stats.funded_txo_sum - txsData.chain_stats.spent_txo_sum,
                unconfirmed: txsData.mempool_stats.funded_txo_sum - txsData.mempool_stats.spent_txo_sum,
                total: 0
            };
            balance.total = balance.confirmed + balance.unconfirmed;
            
            console.log('✅ Balance via Mempool.space:');
            console.log('   Confirmed:', balance.confirmed);
            console.log('   Unconfirmed:', balance.unconfirmed);
            console.log('   Total:', balance.total, 'sats');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
