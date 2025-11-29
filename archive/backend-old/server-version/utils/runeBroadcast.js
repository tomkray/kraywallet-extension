/**
 * 🔥 RUNE BROADCAST SERVICE - MINING POOL PRIORITY
 * 
 * Submete transações de Runes DIRETAMENTE para pools de mineração
 * que aceitam transações non-standard (OP_RETURN OP_13)
 * 
 * ESTRATÉGIA: Igual a Unisat e Xverse
 * 1. F2Pool (maior pool, prioridade máxima)
 * 2. ViaBTC (aceita runes)
 * 3. Luxor (pro-ordinals/runes)
 * 4. Fallback para APIs públicas
 */

import axios from 'axios';

/**
 * PRIORIDADE 1: MINING POOLS QUE ACEITAM RUNES
 * ⚠️ DESABILITADO: Causando erros HTML gigantes nos logs
 * Usar apenas APIs públicas
 */
const MINING_POOL_SERVICES = [
    // ❌ DESABILITADO - Causando erro HTML gigante
    // {
    //     name: 'F2Pool (Priority)',
    //     url: 'https://explorer.f2pool.com/api/v1/tx/submit',
    //     ...
    // },
    // {
    //     name: 'ViaBTC',
    //     url: 'https://www.viabtc.com/tools/tx_submit',
    //     ...
    // },
    // {
    //     name: 'Luxor Mining',
    //     url: 'https://api.luxor.tech/broadcast',
    //     ...
    // }
];

/**
 * PRIORIDADE 2: PUBLIC BROADCAST APIS
 * Fallback se as pools não aceitarem
 */
const PUBLIC_BROADCAST_SERVICES = [
    {
        name: 'Mempool.space',
        url: 'https://mempool.space/api/tx',
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        dataFormat: 'raw',
        priority: 4,
        timeout: 15000
    },
    {
        name: 'Blockstream.info',
        url: 'https://blockstream.info/api/tx',
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        dataFormat: 'raw',
        priority: 5,
        timeout: 15000
    }
];

/**
 * TODOS OS SERVIÇOS COMBINADOS (pools primeiro, depois APIs públicas)
 */
const RUNE_BROADCAST_SERVICES = [
    ...MINING_POOL_SERVICES,
    ...PUBLIC_BROADCAST_SERVICES
];

/**
 * Tenta broadcast em um serviço específico
 */
async function tryBroadcastToService(service, txHex) {
    try {
        console.log(`\n🌐 [Priority ${service.priority}] Tentando ${service.name}...`);
        
        let data;
        let headers = service.headers;
        
        if (service.dataFormat === 'raw') {
            data = txHex;
        } else if (service.dataFormat === 'form') {
            data = `${service.field}=${txHex}`;
        } else if (service.dataFormat === 'json') {
            data = { [service.field]: txHex };
        }
        
        const response = await axios({
            method: service.method,
            url: service.url,
            data,
            headers,
            timeout: service.timeout || 15000,
            validateStatus: null // não lançar erro em status != 2xx
        });
        
        // Diferentes serviços retornam o txid de formas diferentes
        if (response.status === 200 || response.status === 201) {
            let txid;
            
            // Mempool.space e Blockstream retornam o txid direto
            if (typeof response.data === 'string' && response.data.length === 64) {
                txid = response.data;
            }
            // Blockcypher retorna JSON com tx.hash
            else if (response.data && response.data.tx && response.data.tx.hash) {
                txid = response.data.tx.hash;
            }
            // Blockchain.info pode retornar mensagem
            else if (response.data && typeof response.data === 'string') {
                txid = response.data;
            }
            
            if (txid && txid.length === 64) {
                console.log(`✅ ${service.name} SUCESSO!`);
                console.log(`   TXID: ${txid}`);
                return { success: true, txid, service: service.name };
            }
        }
        
        console.log(`❌ ${service.name} falhou:`, response.status, response.data);
        return {
            success: false,
            service: service.name,
            priority: service.priority,
            error: response.data || `HTTP ${response.status}`
        };
        
    } catch (error) {
        console.log(`❌ ${service.name} erro:`, error.message);
        return {
            success: false,
            service: service.name,
            priority: service.priority,
            error: error.message
        };
    }
}

/**
 * Broadcast de transação Rune para múltiplos serviços
 * ESTRATÉGIA UNISAT/XVERSE:
 * 1. Tenta MINING POOLS primeiro (sequencial - F2Pool prioritário)
 * 2. Se pools falharem, tenta APIs públicas (paralelo)
 */
export async function broadcastRuneTransaction(txHex) {
    console.log('\n🔥 ========== RUNE BROADCAST SERVICE ==========');
    console.log('📡 Estratégia: Mining Pools primeiro (como Unisat/Xverse)');
    console.log(`📦 Tamanho da transação: ${txHex.length / 2} bytes`);
    
    const allResults = [];
    
    // FASE 1: Tentar MINING POOLS sequencialmente (F2Pool primeiro!)
    console.log('\n⛏️  === FASE 1: MINING POOLS (PRIORIDADE) ===');
    for (const pool of MINING_POOL_SERVICES) {
        const result = await tryBroadcastToService(pool, txHex);
        allResults.push(result);
        
        if (result.success) {
            console.log('\n✅ ========== BROADCAST BEM-SUCEDIDO NA POOL! ==========');
            console.log(`🎉 Mining Pool: ${result.service}`);
            console.log(`🔗 TXID: ${result.txid}`);
            console.log(`⛏️  Transação enviada DIRETAMENTE para mineradores`);
            console.log(`🌐 Ver na mempool: https://mempool.space/tx/${result.txid}`);
            
            return {
                success: true,
                txid: result.txid,
                service: result.service,
                method: 'mining_pool'
            };
        }
    }
    
    console.log('\n⚠️  Mining pools não aceitaram. Tentando APIs públicas...');
    
    // FASE 2: Se pools falharem, tentar APIs públicas em PARALELO
    console.log('\n🌐 === FASE 2: PUBLIC BROADCAST APIS (FALLBACK) ===');
    const publicPromises = PUBLIC_BROADCAST_SERVICES.map(service => 
        tryBroadcastToService(service, txHex)
    );
    
    const publicResults = await Promise.all(publicPromises);
    allResults.push(...publicResults);
    
    // Procura sucesso nas APIs públicas
    const publicSuccess = publicResults.find(r => r.success);
    
    if (publicSuccess) {
        console.log('\n✅ ========== BROADCAST BEM-SUCEDIDO VIA API PÚBLICA ==========');
        console.log(`🎉 Serviço: ${publicSuccess.service}`);
        console.log(`🔗 TXID: ${publicSuccess.txid}`);
        console.log(`🌐 Ver na mempool: https://mempool.space/tx/${publicSuccess.txid}`);
        
        return {
            success: true,
            txid: publicSuccess.txid,
            service: publicSuccess.service,
            method: 'public_api'
        };
    }
    
    // Se TUDO falhou, retorna todos os erros
    console.log('\n❌ ========== TODOS OS BROADCASTS FALHARAM ==========');
    console.log('\n⛏️  Mining Pools:');
    allResults.filter(r => r.priority <= 3).forEach(r => {
        console.log(`   ❌ ${r.service}: ${r.error}`);
    });
    console.log('\n🌐 Public APIs:');
    allResults.filter(r => r.priority > 3).forEach(r => {
        console.log(`   ❌ ${r.service}: ${r.error}`);
    });
    
    throw new Error(
        `❌ Broadcast falhou em TODAS as mining pools E APIs públicas:\n\n` +
        `⛏️  Mining Pools:\n` +
        allResults.filter(r => r.priority <= 3).map(r => `  - ${r.service}: ${r.error}`).join('\n') +
        `\n\n🌐 Public APIs:\n` +
        allResults.filter(r => r.priority > 3).map(r => `  - ${r.service}: ${r.error}`).join('\n')
    );
}

/**
 * Verifica se uma transação está na mempool
 */
export async function checkTransactionInMempool(txid) {
    try {
        const response = await axios.get(`https://mempool.space/api/tx/${txid}`, {
            timeout: 10000
        });
        
        return {
            found: true,
            status: response.data.status
        };
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return { found: false };
        }
        throw error;
    }
}

