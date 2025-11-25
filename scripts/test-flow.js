#!/usr/bin/env node

/**
 * 🧪 Script de Teste do Fluxo Completo
 * 
 * Testa o fluxo de compra de ordinal e swap de runes
 */

import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function apiRequest(endpoint, options = {}) {
    try {
        const url = `${API_URL}${endpoint}`;
        const response = await axios({
            url,
            method: options.method || 'GET',
            data: options.body,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}

async function testInscriptionPurchase() {
    log('\n╔════════════════════════════════════════════╗', 'cyan');
    log('║  🎨 Teste: Compra de Inscription          ║', 'cyan');
    log('╚════════════════════════════════════════════╝\n', 'cyan');
    
    try {
        // 1. Listar inscriptions disponíveis
        log('1️⃣  Buscando inscriptions disponíveis...', 'blue');
        const inscriptions = await apiRequest('/ordinals?limit=5');
        
        if (inscriptions.inscriptions.length === 0) {
            log('   ⚠️  Nenhuma inscription no banco. Execute: npm run sync-inscriptions', 'yellow');
            return false;
        }
        
        log(`   ✅ Encontradas ${inscriptions.pagination.total} inscriptions`, 'green');
        const inscription = inscriptions.inscriptions[0];
        log(`   📝 Usando: #${inscription.inscription_number}`, 'blue');
        
        // 2. Criar oferta de venda (vendedor)
        log('\n2️⃣  Criando oferta de venda (Vendedor)...', 'blue');
        const offer = await apiRequest('/offers', {
            method: 'POST',
            body: JSON.stringify({
                type: 'inscription',
                inscriptionId: inscription.id,
                offerAmount: 50000,
                feeRate: 10,
                creatorAddress: 'bc1qvendedor123...',
                psbt: 'cHNidP8BAMockPSBTDataHere...',
                expiresIn: 86400000 // 24h
            })
        });
        
        log(`   ✅ Oferta criada: ${offer.offer.id}`, 'green');
        log(`   💰 Preço: ${offer.offer.offer_amount} sats`, 'blue');
        
        // 3. Ativar oferta (simular broadcast)
        log('\n3️⃣  Ativando oferta (Vendedor assina e publica)...', 'blue');
        await apiRequest(`/offers/${offer.offer.id}/submit`, {
            method: 'PUT',
            body: JSON.stringify({
                txid: 'mock_txid_' + Date.now()
            })
        });
        
        log('   ✅ Oferta ativa no marketplace!', 'green');
        
        // 4. Listar ofertas ativas
        log('\n4️⃣  Listando ofertas ativas...', 'blue');
        const activeOffers = await apiRequest('/offers?status=active&type=inscription');
        log(`   ✅ ${activeOffers.pagination.total} ofertas ativas`, 'green');
        
        // 5. Comprador aceita (simulado)
        log('\n5️⃣  Comprador aceita a oferta...', 'blue');
        log('   📝 Comprador assina PSBT com seus UTXOs', 'blue');
        log('   📡 Broadcast da transação completa', 'blue');
        
        // Simular conclusão
        await apiRequest(`/offers/${offer.offer.id}/complete`, {
            method: 'PUT',
            body: JSON.stringify({
                txid: 'real_txid_' + Date.now()
            })
        });
        
        log('   ✅ Compra concluída com sucesso!', 'green');
        log('   🎉 Inscription transferida para o comprador!', 'green');
        
        return true;
        
    } catch (error) {
        log(`   ❌ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testRuneSwap() {
    log('\n╔════════════════════════════════════════════╗', 'cyan');
    log('║  🎭 Teste: Swap de Runes                  ║', 'cyan');
    log('╚════════════════════════════════════════════╝\n', 'cyan');
    
    try {
        // 1. Listar runes disponíveis
        log('1️⃣  Buscando runes disponíveis...', 'blue');
        const runes = await apiRequest('/runes');
        
        if (runes.runes.length === 0) {
            log('   ⚠️  Nenhuma rune encontrada no Ord Server', 'yellow');
            log('   ℹ️  Isso é normal se não houver runes no seu node', 'blue');
        } else {
            log(`   ✅ Encontradas ${runes.runes.length} runes`, 'green');
        }
        
        // 2. Criar oferta de swap (Trader A)
        log('\n2️⃣  Criando oferta de swap (Trader A)...', 'blue');
        const swapOffer = await apiRequest('/offers', {
            method: 'POST',
            body: JSON.stringify({
                type: 'rune_swap',
                fromRune: 'BITCOIN•RUNE',
                toRune: 'OTHER•RUNE',
                fromAmount: 1000000,
                toAmount: 1500000,
                feeRate: 10,
                creatorAddress: 'bc1qtraderA...',
                psbt: 'cHNidP8BAMockPSBTRuneSwap...'
            })
        });
        
        log(`   ✅ Oferta de swap criada: ${swapOffer.offer.id}`, 'green');
        log(`   📤 Oferece: 1,000,000 BITCOIN•RUNE`, 'blue');
        log(`   📥 Recebe: 1,500,000 OTHER•RUNE`, 'blue');
        log(`   📊 Taxa: 1.5`, 'blue');
        
        // 3. Ativar oferta
        log('\n3️⃣  Ativando oferta de swap...', 'blue');
        await apiRequest(`/offers/${swapOffer.offer.id}/submit`, {
            method: 'PUT',
            body: JSON.stringify({
                txid: 'mock_swap_txid_' + Date.now()
            })
        });
        
        log('   ✅ Oferta de swap ativa!', 'green');
        
        // 4. Ver dados de mercado
        log('\n4️⃣  Consultando dados de mercado...', 'blue');
        const market = await apiRequest('/runes/market/BITCOIN•RUNE/OTHER•RUNE');
        log(`   ✅ Preço médio: ${market.market.price.toFixed(4)}`, 'green');
        log(`   📊 Trades: ${market.market.tradesCount}`, 'blue');
        log(`   💼 Ofertas ativas: ${market.market.activeOffers}`, 'blue');
        
        // 5. Trader B aceita (simulado)
        log('\n5️⃣  Trader B aceita o swap...', 'blue');
        log('   📝 Trader B assina PSBT com suas runes', 'blue');
        log('   📡 Broadcast da transação de swap', 'blue');
        
        await apiRequest(`/offers/${swapOffer.offer.id}/complete`, {
            method: 'PUT',
            body: JSON.stringify({
                txid: 'real_swap_txid_' + Date.now()
            })
        });
        
        log('   ✅ Swap concluído com sucesso!', 'green');
        log('   🎉 Runes trocadas entre os traders!', 'green');
        
        // 6. Ver histórico de trades
        log('\n6️⃣  Consultando histórico de trades...', 'blue');
        const trades = await apiRequest('/runes/trades?limit=5');
        log(`   ✅ ${trades.pagination.total} trades registrados`, 'green');
        
        return true;
        
    } catch (error) {
        log(`   ❌ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testFeesAndStatus() {
    log('\n╔════════════════════════════════════════════╗', 'cyan');
    log('║  📊 Teste: Fees e Status                  ║', 'cyan');
    log('╚════════════════════════════════════════════╝\n', 'cyan');
    
    try {
        // Fees
        log('💰 Consultando fees recomendadas...', 'blue');
        const fees = await apiRequest('/psbt/fees');
        log(`   Fast: ${fees.fees.fast} sat/vB`, 'green');
        log(`   Medium: ${fees.fees.medium} sat/vB`, 'green');
        log(`   Slow: ${fees.fees.slow} sat/vB`, 'green');
        
        // Status dos nodes
        log('\n🔍 Verificando status dos nodes...', 'blue');
        const status = await apiRequest('/status');
        log(`   Bitcoin Core: ${status.nodes.bitcoin.connected ? '✅' : '❌'}`, 'green');
        log(`   Blocks: ${status.nodes.bitcoin.blocks}`, 'blue');
        log(`   Ord Server: ${status.nodes.ord.connected ? '✅' : '❌'}`, 'green');
        
        return true;
    } catch (error) {
        log(`   ❌ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function main() {
    log('\n╔══════════════════════════════════════════════╗', 'cyan');
    log('║  🧪 Teste Completo do Marketplace           ║', 'cyan');
    log('╚══════════════════════════════════════════════╝', 'cyan');
    
    const results = {
        fees: false,
        inscription: false,
        rune: false
    };
    
    // Testar fees e status
    results.fees = await testFeesAndStatus();
    
    // Testar compra de inscription
    results.inscription = await testInscriptionPurchase();
    
    // Testar swap de runes
    results.rune = await testRuneSwap();
    
    // Resumo
    log('\n╔════════════════════════════════════════════╗', 'cyan');
    log('║  📊 Resumo dos Testes                      ║', 'cyan');
    log('╚════════════════════════════════════════════╝\n', 'cyan');
    
    log(`Fees & Status:        ${results.fees ? '✅ PASSOU' : '❌ FALHOU'}`, results.fees ? 'green' : 'red');
    log(`Compra de Inscription: ${results.inscription ? '✅ PASSOU' : '❌ FALHOU'}`, results.inscription ? 'green' : 'red');
    log(`Swap de Runes:         ${results.rune ? '✅ PASSOU' : '❌ FALHOU'}`, results.rune ? 'green' : 'red');
    
    const allPassed = results.fees && results.inscription && results.rune;
    
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    if (allPassed) {
        log('🎉 Todos os testes passaram! Sistema funcionando!', 'green');
    } else {
        log('⚠️  Alguns testes falharam. Verifique os logs acima.', 'yellow');
    }
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
    
    process.exit(allPassed ? 0 : 1);
}

// Executar
main().catch(error => {
    log(`\n❌ Erro fatal: ${error.message}\n`, 'red');
    process.exit(1);
});








